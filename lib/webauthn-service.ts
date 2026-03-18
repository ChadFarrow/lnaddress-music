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

/**
 * WebAuthn service for passkey registration and authentication
 * Server-side only — handles challenge generation and credential verification
 */

// Relying Party configuration
function getRPID(): string {
  if (process.env.NEXT_PUBLIC_WEBAUTHN_RP_ID) {
    return process.env.NEXT_PUBLIC_WEBAUTHN_RP_ID;
  }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  return new URL(siteUrl).hostname;
}

function getRPName(): string {
  return process.env.NEXT_PUBLIC_WEBAUTHN_RP_NAME || 'Lightning Music';
}

function getOrigin(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
}

// In-memory challenge store with TTL (5 minutes)
const challengeStore = new Map<string, { challenge: string; expiresAt: number }>();

// Cleanup expired challenges every minute
setInterval(() => {
  const now = Date.now();
  challengeStore.forEach((value, key) => {
    if (value.expiresAt < now) {
      challengeStore.delete(key);
    }
  });
}, 60_000);

function storeChallenge(key: string, challenge: string): void {
  challengeStore.set(key, {
    challenge,
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
  });
}

function getAndDeleteChallenge(key: string): string | null {
  const entry = challengeStore.get(key);
  if (!entry) return null;
  challengeStore.delete(key);
  if (entry.expiresAt < Date.now()) return null;
  return entry.challenge;
}

export interface StoredCredential {
  credentialId: string;
  publicKey: string; // base64url-encoded
  counter: number;
  transports?: AuthenticatorTransportFuture[];
}

/**
 * Generate registration options for a new passkey
 */
export async function generatePasskeyRegistrationOptions(
  userId: string,
  username: string,
  existingCredentials: StoredCredential[] = []
) {
  const options = await generateRegistrationOptions({
    rpName: getRPName(),
    rpID: getRPID(),
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

  // Store challenge keyed by the generated challenge itself for simplicity
  storeChallenge(`reg:${userId}`, options.challenge);

  return options;
}

/**
 * Verify passkey registration response
 */
export async function verifyPasskeyRegistration(
  userId: string,
  response: RegistrationResponseJSON
): Promise<{
  verified: boolean;
  credential?: StoredCredential;
  prfSupported?: boolean;
  error?: string;
}> {
  const expectedChallenge = getAndDeleteChallenge(`reg:${userId}`);

  if (!expectedChallenge) {
    return { verified: false, error: 'Challenge expired or not found' };
  }

  try {
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: getOrigin(),
      expectedRPID: getRPID(),
    });

    if (!verification.verified || !verification.registrationInfo) {
      return { verified: false, error: 'Verification failed' };
    }

    const { credential } = verification.registrationInfo;

    // Check if PRF was enabled in the response
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
 * Generate authentication options for passkey login
 */
export async function generatePasskeyAuthenticationOptions(
  credentials?: StoredCredential[],
  sessionId?: string
) {
  const challengeKey = sessionId || `auth:${Date.now()}:${Math.random().toString(36).slice(2)}`;

  const options = await generateAuthenticationOptions({
    rpID: getRPID(),
    userVerification: 'required',
    allowCredentials: credentials?.map((cred) => ({
      id: cred.credentialId,
      transports: cred.transports,
    })),
  });

  storeChallenge(challengeKey, options.challenge);

  return { options, challengeKey };
}

/**
 * Verify passkey authentication response
 */
export async function verifyPasskeyAuthentication(
  challengeKey: string,
  response: AuthenticationResponseJSON,
  credential: StoredCredential
): Promise<{
  verified: boolean;
  newCounter?: number;
  error?: string;
}> {
  const expectedChallenge = getAndDeleteChallenge(challengeKey);

  if (!expectedChallenge) {
    return { verified: false, error: 'Challenge expired or not found' };
  }

  try {
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: getOrigin(),
      expectedRPID: getRPID(),
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
