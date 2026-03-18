import { NextRequest, NextResponse } from 'next/server';
import { findPasskeyCredential, updatePasskeyCounter, updateUserLastLogin } from '@/lib/db';
import { verifyPasskeyAuthentication, getRequestOrigin } from '@/lib/webauthn-service';
import { generateToken, setAuthCookie, createErrorResponse } from '@/lib/session-service';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';

/**
 * Complete passkey login — verify assertion, issue JWT
 * POST /api/auth/passkey/login/complete
 */
export async function POST(request: NextRequest) {
  try {
    const { challengeToken, credential } = await request.json();

    if (!challengeToken || !credential) {
      return createErrorResponse('Missing required fields', 400);
    }

    const authResponse = credential as AuthenticationResponseJSON;

    // Find the credential in the database
    const storedCredential = await findPasskeyCredential(authResponse.id);
    if (!storedCredential) {
      return createErrorResponse('Unknown credential', 401);
    }

    // Verify the authentication response using the signed challenge token
    const requestOrigin = getRequestOrigin(request);
    const verification = await verifyPasskeyAuthentication(
      challengeToken,
      authResponse,
      {
        credentialId: storedCredential.credential_id,
        publicKey: storedCredential.public_key,
        counter: storedCredential.counter,
        transports: storedCredential.transports as any,
      },
      requestOrigin
    );

    if (!verification.verified) {
      return createErrorResponse(verification.error || 'Authentication failed', 401);
    }

    // Update counter
    if (verification.newCounter !== undefined) {
      await updatePasskeyCounter(storedCredential.credential_id, verification.newCounter);
    }

    // Update last login
    await updateUserLastLogin(storedCredential.user_id);

    // Generate JWT and set cookie
    const token = generateToken(storedCredential.user_id, storedCredential.username);

    const response = NextResponse.json({
      success: true,
      user: {
        id: storedCredential.user_id,
        username: storedCredential.username,
      },
      credentialId: storedCredential.credential_id,
      prfSupported: storedCredential.prf_supported,
    });

    setAuthCookie(response, token);
    return response;
  } catch (error) {
    console.error('Passkey login complete error:', error);
    return createErrorResponse('Failed to complete passkey login', 500);
  }
}
