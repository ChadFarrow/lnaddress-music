import { NextRequest, NextResponse } from 'next/server';
import { findUserByUsername, getPasskeyCredentialsByUsername, initializeDatabase } from '@/lib/db';
import { generatePasskeyAuthenticationOptions, getRequestOrigin } from '@/lib/webauthn-service';
import { createErrorResponse } from '@/lib/session-service';

/**
 * Start passkey login — generate WebAuthn authentication challenge
 * POST /api/auth/passkey/login/start
 */
export async function POST(request: NextRequest) {
  try {
    try {
      await initializeDatabase(false);
    } catch {
      return createErrorResponse('Database not configured', 503);
    }

    const body = await request.json().catch(() => ({}));
    const { username } = body;

    let credentials;

    if (username) {
      const user = await findUserByUsername(username);
      if (!user) {
        return createErrorResponse('User not found', 404);
      }

      const userCredentials = await getPasskeyCredentialsByUsername(username);
      if (userCredentials.length === 0) {
        return createErrorResponse('No passkey registered for this user', 404);
      }

      credentials = userCredentials.map((c) => ({
        credentialId: c.credential_id,
        publicKey: c.public_key,
        counter: c.counter,
        transports: c.transports as any,
      }));
    }

    const requestOrigin = getRequestOrigin(request);
    const { options, challengeToken } = await generatePasskeyAuthenticationOptions(credentials, undefined, requestOrigin);

    return NextResponse.json({
      success: true,
      options,
      challengeToken,
    });
  } catch (error) {
    console.error('Passkey login start error:', error);
    return createErrorResponse('Failed to start passkey login', 500);
  }
}
