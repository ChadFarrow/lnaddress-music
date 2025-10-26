import { NextResponse } from 'next/server';
import { clearAuthCookie, createErrorResponse } from '@/lib/session-service';

/**
 * User logout endpoint
 * GET/POST /api/auth/logout
 */
export async function GET() {
  try {
    // Create redirect response to home page
    const response = NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'));

    // Clear auth cookie
    clearAuthCookie(response);

    return response;

  } catch (error) {
    console.error('Logout error:', error);
    return createErrorResponse('Logout failed', 500);
  }
}

export async function POST() {
  try {
    // Create response
    const response = NextResponse.json({
      success: true,
      message: 'Logout successful'
    });

    // Clear auth cookie
    clearAuthCookie(response);

    return response;

  } catch (error) {
    console.error('Logout error:', error);
    return createErrorResponse('Logout failed', 500);
  }
}
