import { NextRequest, NextResponse } from 'next/server';
import { findUserByUsername, updateUserLastLogin, initializeDatabase } from '@/lib/db';
import { verifyPassword } from '@/lib/encryption-service';
import { generateToken, setAuthCookie, createErrorResponse } from '@/lib/session-service';

/**
 * User login endpoint
 * POST /api/auth/login
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
    const { username, password } = body;
    
    // Validate input
    if (!username || !password) {
      return createErrorResponse('Username and password are required', 400);
    }
    
    // Find user
    const user = await findUserByUsername(username);
    if (!user) {
      return createErrorResponse('Invalid username or password', 401);
    }
    
    // Verify password
    const isValidPassword = verifyPassword(password, user.password_hash, username);
    if (!isValidPassword) {
      return createErrorResponse('Invalid username or password', 401);
    }
    
    // Update last login
    await updateUserLastLogin(user.id);
    
    // Generate JWT token
    const token = generateToken(user.id, user.username);
    
    // Create response with auth cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username
      },
      message: 'Login successful'
    });
    
    setAuthCookie(response, token);
    
    return response;
    
  } catch (error) {
    console.error('Login error:', error);
    return createErrorResponse('Login failed', 500);
  }
}
