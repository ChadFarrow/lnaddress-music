import jwt from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';
import { findUserById } from '@/lib/db';

/**
 * Session management service for user authentication
 * Uses JWT tokens with secure httpOnly cookies
 */

export interface UserSession {
  userId: number;
  username: string;
  iat: number;
  exp: number;
}

export interface AuthResult {
  success: boolean;
  user?: UserSession;
  error?: string;
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '24h';
const COOKIE_NAME = 'auth-token';

/**
 * Generate JWT token for user session
 */
export function generateToken(userId: number, username: string): string {
  return jwt.sign(
    { userId, username },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): UserSession | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as UserSession;
    return decoded;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

/**
 * Set authentication cookie
 */
export function setAuthCookie(response: NextResponse, token: string): void {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', // Changed from 'strict' to 'lax' for better compatibility
    maxAge: 24 * 60 * 60, // 24 hours in seconds (not milliseconds)
    path: '/'
  });
}

/**
 * Clear authentication cookie
 */
export function clearAuthCookie(response: NextResponse): void {
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
    path: '/'
  });
}

/**
 * Get authentication token from request
 */
export function getAuthToken(request: NextRequest): string | null {
  return request.cookies.get(COOKIE_NAME)?.value || null;
}

/**
 * Authenticate user from request
 */
export async function authenticateUser(request: NextRequest): Promise<AuthResult> {
  try {
    const token = getAuthToken(request);
    
    if (!token) {
      return { success: false, error: 'No authentication token' };
    }
    
    const session = verifyToken(token);
    
    if (!session) {
      return { success: false, error: 'Invalid authentication token' };
    }
    
    // Verify user still exists in database
    const user = await findUserById(session.userId);
    
    if (!user) {
      return { success: false, error: 'User not found' };
    }
    
    return { success: true, user: session };
  } catch (error) {
    console.error('Authentication failed:', error);
    return { success: false, error: 'Authentication failed' };
  }
}

/**
 * Middleware helper for protected routes
 */
export async function requireAuth(request: NextRequest): Promise<{ user: UserSession; response?: NextResponse } | { error: string; response: NextResponse }> {
  const authResult = await authenticateUser(request);
  
  if (!authResult.success || !authResult.user) {
    const response = NextResponse.json(
      { error: authResult.error || 'Authentication required' },
      { status: 401 }
    );
    clearAuthCookie(response);
    return { error: authResult.error || 'Authentication required', response };
  }
  
  return { user: authResult.user };
}

/**
 * Create authenticated response with user data
 */
export function createAuthResponse(user: UserSession, data: any = {}): NextResponse {
  const response = NextResponse.json({
    success: true,
    user: {
      id: user.userId,
      username: user.username
    },
    ...data
  });
  
  return response;
}

/**
 * Create error response
 */
export function createErrorResponse(message: string, status: number = 400): NextResponse {
  return NextResponse.json(
    { success: false, error: message },
    { status }
  );
}

/**
 * Validate session and refresh if needed
 */
export async function validateAndRefreshSession(request: NextRequest): Promise<AuthResult> {
  const authResult = await authenticateUser(request);
  
  if (authResult.success && authResult.user) {
    // Check if token is close to expiring (within 1 hour)
    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = authResult.user.exp - now;
    
    if (timeUntilExpiry < 3600) { // Less than 1 hour
      // Token is close to expiring, we could refresh it here
      // For now, we'll just return the current session
      console.log('Token close to expiry, consider refreshing');
    }
  }
  
  return authResult;
}
