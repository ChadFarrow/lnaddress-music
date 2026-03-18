import { NextRequest, NextResponse } from 'next/server';
import { createUserWithPasskey, storePasskeyCredential, findUserByUsername } from '@/lib/db';
import { verifyPasskeyRegistration, getRequestOrigin } from '@/lib/webauthn-service';
import { generateToken, setAuthCookie, createErrorResponse } from '@/lib/session-service';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';

/**
 * Complete passkey registration — verify attestation, create user + credential
 * POST /api/auth/passkey/register/complete
 */
export async function POST(request: NextRequest) {
  try {
    const { username, tempUserId, credential } = await request.json();

    if (!username || !tempUserId || !credential) {
      return createErrorResponse('Missing required fields', 400);
    }

    // Double-check username isn't taken (race condition protection)
    const existingUser = await findUserByUsername(username);
    if (existingUser) {
      return createErrorResponse('Username already exists', 409);
    }

    // Verify the registration response
    const requestOrigin = getRequestOrigin(request);
    const verification = await verifyPasskeyRegistration(
      tempUserId,
      credential as RegistrationResponseJSON,
      requestOrigin
    );

    if (!verification.verified || !verification.credential) {
      return createErrorResponse(verification.error || 'Passkey verification failed', 400);
    }

    // Create the user (no password)
    const userResult = await createUserWithPasskey(username);
    if (!userResult.success || !userResult.user) {
      return createErrorResponse(userResult.error || 'Failed to create user', 500);
    }

    // Store the passkey credential
    const credResult = await storePasskeyCredential(
      userResult.user.id,
      verification.credential.credentialId,
      verification.credential.publicKey,
      verification.credential.counter,
      verification.credential.transports as string[] | undefined,
      verification.prfSupported || false
    );

    if (!credResult.success) {
      return createErrorResponse(credResult.error || 'Failed to store credential', 500);
    }

    // Generate JWT and set cookie
    const token = generateToken(userResult.user.id, userResult.user.username);

    const response = NextResponse.json({
      success: true,
      user: {
        id: userResult.user.id,
        username: userResult.user.username,
      },
      credentialId: verification.credential.credentialId,
      prfSupported: verification.prfSupported || false,
    });

    setAuthCookie(response, token);
    return response;
  } catch (error) {
    console.error('Passkey registration complete error:', error);
    return createErrorResponse('Failed to complete passkey registration', 500);
  }
}
