import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, createErrorResponse } from '@/lib/session-service';

/**
 * Get current user info endpoint
 * GET /api/auth/me
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    
    if ('error' in authResult) {
      return authResult.response;
    }
    
    return NextResponse.json({
      success: true,
      user: {
        id: authResult.user.userId,
        username: authResult.user.username
      }
    });
    
  } catch (error) {
    console.error('Get user info error:', error);
    return createErrorResponse('Failed to get user info', 500);
  }
}
