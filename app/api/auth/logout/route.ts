import { NextResponse } from 'next/server';
import { clearAuthCookie, createErrorResponse } from '@/lib/session-service';

/**
 * User logout endpoint
 * POST /api/auth/logout
 */
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
