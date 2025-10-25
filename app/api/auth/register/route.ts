import { NextRequest, NextResponse } from 'next/server';
import { createUser, findUserByUsername, initializeDatabase } from '@/lib/db';
import { hashPassword, validatePassword, validateUsername } from '@/lib/encryption-service';
import { generateToken, setAuthCookie, createErrorResponse } from '@/lib/session-service';

/**
 * User registration endpoint
 * POST /api/auth/register
 */
export async function POST(request: NextRequest) {
  try {
    // Initialize database if needed (skip if no database configured)
    try {
      await initializeDatabase(false);
    } catch (dbError) {
      console.warn('Database not available, using demo mode:', dbError);
      // Return demo response for testing
      return NextResponse.json({
        success: false,
        error: 'Database not configured. Please set up POSTGRES_URL environment variable.'
      }, { status: 503 });
    }
    
    const body = await request.json();
    const { username, password, confirmPassword } = body;
    
    // Validate input
    if (!username || !password) {
      return createErrorResponse('Username and password are required', 400);
    }
    
    if (password !== confirmPassword) {
      return createErrorResponse('Passwords do not match', 400);
    }
    
    // Validate username
    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) {
      return createErrorResponse(`Invalid username: ${usernameValidation.errors.join(', ')}`, 400);
    }
    
    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return createErrorResponse(`Invalid password: ${passwordValidation.errors.join(', ')}`, 400);
    }
    
    // Check if user already exists
    const existingUser = await findUserByUsername(username);
    if (existingUser) {
      return createErrorResponse('Username already exists', 409);
    }
    
    // Hash password
    const passwordHash = hashPassword(password, username); // Using username as salt for simplicity
    
    // Create user
    const result = await createUser(username, passwordHash);
    
    if (!result.success) {
      return createErrorResponse(result.error || 'Failed to create user', 500);
    }
    
    // Generate JWT token
    const token = generateToken(result.user!.id, result.user!.username);
    
    // Create response with auth cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: result.user!.id,
        username: result.user!.username
      },
      message: 'User created successfully'
    });
    
    setAuthCookie(response, token);
    
    return response;
    
  } catch (error) {
    console.error('Registration error:', error);
    return createErrorResponse('Registration failed', 500);
  }
}
