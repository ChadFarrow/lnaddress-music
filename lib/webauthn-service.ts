import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from '@simplewebauthn/server';
import jwt from 'jsonwebtoken';

/**
 * WebAuthn service for passkey registration and authentication
 * Server-side only — handles challenge generation and credential verification
 *
 * Challenge storage uses signed JWTs instead of in-memory Maps so that
 * /start and /complete can hit different serverless function instances
 * (required for Vercel / any stateless deployment).
 */

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const CHALLENGE_TTL_SECONDS = 300; // 5 minutes

// Relying Party configuration
function getRPID(requestOrigin?: string): string {
  if (process.env.NEXT_PUBLIC_WEBAUTHN_RP_ID) {
    return process.env.NEXT_PUBLIC_WEBAUTHN_RP_ID;
  }
  if (requestOrigin) {
    return new URL(requestOrigin).hostname;
  }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  return new URL(siteUrl).hostname;
}

function getRPName(): string {
  return process.env.NEXT_PUBLIC_WEBAUTHN_RP_NAME || 'Lightning Music';
}

function getOrigin(requestOrigin?: string): string {
  if (requestOrigin) {
    return requestOrigin;
  }
  return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
}

/**
 * Extract the origin from a Next.js request using headers.
 * Works on Vercel, localhost, and custom domains.
 */
export function getRequestOrigin(request: Request): string {
  const origin = request.headers.get('origin');
  if (origin) return origin;

  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  if (host) {
    const proto = request.headers.get('x-forwarded-proto') || 'https';
    return `${proto}://${host}`;
  }

  return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
}

/**
 * Create a signed challenge token (JWT) that encodes the challenge string.
 * This replaces in-memory storage so it works across serverless invocations.
 */
function createChallengeToken(challenge: string, context?: Record<string, string>): string {
  return jwt.sign(
    { challenge, ...context },
    JWT_SECRET,
    { expiresIn: CHALLENGE_TTL_SECONDS }
  );
}

/**
 * Verify and extract the challenge from a signed token.
 */
function verifyChallengeToken(token: string): { challenge: string; [key: string]: unknown } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { challenge: string; [key: string]: unknown };
    return decoded;
  } catch {
    return null;
  }
}

export interface StoredCredential {
  credentialId: string;
  publicKey: string; // base64url-encoded
  counter: number;
  transports?: AuthenticatorTransportFuture[];
}

/**
 * Generate registration options for a new passkey.
 * Returns the options + a signed challengeToken to send to the client.
 */
export async function generatePasskeyRegistrationOptions(
  userId: string,
  username: string,
  existingCredentials: StoredCredential[] = [],
  requestOrigin?: string
) {
  const rpID = getRPID(requestOrigin);
  console.log('🔑 WebAuthn registration - rpID:', rpID, 'origin:', requestOrigin);

  const options = await generateRegistrationOptions({
    rpName: getRPName(),
    rpID,
    userName: username,
    userID: new TextEncoder().encode(userId),
    attestationType: 'none',
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'required',
    },
    excludeCredentials: existingCredentials.map((cred) => ({
      id: cred.credentialId,
      transports: cred.transports,
    })),
    extensions: {
      // Request PRF extension for deterministic key derivation
      // @ts-expect-error - PRF extension not yet in SimpleWebAuthn types
      prf: {},
    },
  });

  // Encode challenge in a signed JWT instead of storing in memory
  const challengeToken = createChallengeToken(options.challenge, { type: 'registration', userId });

  return { options, challengeToken };
}

/**
 * Verify passkey registration response
 */
export async function verifyPasskeyRegistration(
  challengeToken: string,
  response: RegistrationResponseJSON,
  requestOrigin?: string
): Promise<{
  verified: boolean;
  credential?: StoredCredential;
  prfSupported?: boolean;
  error?: string;
}> {
  const tokenData = verifyChallengeToken(challengeToken);
  if (!tokenData) {
    return { verified: false, error: 'Challenge expired or invalid' };
  }

  const expectedChallenge = tokenData.challenge;
  const origin = getOrigin(requestOrigin);
  const rpID = getRPID(requestOrigin);
  console.log('🔑 WebAuthn verify registration - origin:', origin, 'rpID:', rpID);

  try {
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return { verified: false, error: 'Verification failed' };
    }

    const { credential } = verification.registrationInfo;

    const clientExtensionResults = response.clientExtensionResults as Record<string, unknown> | undefined;
    const prfSupported = !!(clientExtensionResults?.prf as { enabled?: boolean })?.enabled;

    return {
      verified: true,
      credential: {
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey).toString('base64url'),
        counter: credential.counter,
        transports: response.response.transports as AuthenticatorTransportFuture[] | undefined,
      },
      prfSupported,
    };
  } catch (error) {
    console.error('Registration verification error:', error);
    return { verified: false, error: 'Verification failed' };
  }
}

/**
 * Generate authentication options for passkey login.
 * Returns the options + a signed challengeToken.
 */
export async function generatePasskeyAuthenticationOptions(
  credentials?: StoredCredential[],
  sessionId?: string,
  requestOrigin?: string
) {
  const rpID = getRPID(requestOrigin);
  console.log('🔑 WebAuthn authentication options - rpID:', rpID);

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'required',
    allowCredentials: credentials?.map((cred) => ({
      id: cred.credentialId,
      transports: cred.transports,
    })),
  });

  const challengeToken = createChallengeToken(options.challenge, { type: 'authentication' });

  return { options, challengeToken };
}

/**
 * Verify passkey authentication response
 */
export async function verifyPasskeyAuthentication(
  challengeToken: string,
  response: AuthenticationResponseJSON,
  credential: StoredCredential,
  requestOrigin?: string
): Promise<{
  verified: boolean;
  newCounter?: number;
  error?: string;
}> {
  const tokenData = verifyChallengeToken(challengeToken);
  if (!tokenData) {
    return { verified: false, error: 'Challenge expired or invalid' };
  }

  const expectedChallenge = tokenData.challenge;
  const origin = getOrigin(requestOrigin);
  const rpID = getRPID(requestOrigin);
  console.log('🔑 WebAuthn verify authentication - origin:', origin, 'rpID:', rpID);

  try {
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: credential.credentialId,
        publicKey: Buffer.from(credential.publicKey, 'base64url'),
        counter: credential.counter,
        transports: credential.transports,
      },
    });

    if (!verification.verified) {
      return { verified: false, error: 'Verification failed' };
    }

    return {
      verified: true,
      newCounter: verification.authenticationInfo.newCounter,
    };
  } catch (error) {
    console.error('Authentication verification error:', error);
    return { verified: false, error: 'Verification failed' };
  }
}
