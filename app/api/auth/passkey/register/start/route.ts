import { NextRequest, NextResponse } from 'next/server';
import { findUserByUsername, initializeDatabase } from '@/lib/db';
import { generatePasskeyRegistrationOptions } from '@/lib/webauthn-service';
import { validateUsername } from '@/lib/encryption-service';
import { createErrorResponse } from '@/lib/session-service';

/**
 * Start passkey registration — generate WebAuthn challenge
 * POST /api/auth/passkey/register/start
 */
export async function POST(request: NextRequest) {
  try {
    try {
      await initializeDatabase(false);
    } catch {
      return createErrorResponse('Database not configured', 503);
    }

    const { username } = await request.json();

    if (!username) {
      return createErrorResponse('Username is required', 400);
    }

    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) {
      return createErrorResponse(`Invalid username: ${usernameValidation.errors.join(', ')}`, 400);
    }

    // Check if username is taken
    const existingUser = await findUserByUsername(username);
    if (existingUser) {
      return createErrorResponse('Username already exists', 409);
    }

    // Generate a temporary userId for the registration options
    // The actual user record is created after successful registration verification
    const tempUserId = `pending:${username}:${Date.now()}`;

    const options = await generatePasskeyRegistrationOptions(tempUserId, username);

    return NextResponse.json({
      success: true,
      options,
      tempUserId,
    });
  } catch (error) {
    console.error('Passkey registration start error:', error);
    return createErrorResponse('Failed to start passkey registration', 500);
  }
}
