import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, createErrorResponse } from '@/lib/session-service';
import { getUserWallet } from '@/lib/db';
import { decryptMnemonic } from '@/lib/encryption-service';

/**
 * Get decrypted mnemonic for Breez connection
 * POST /api/auth/wallet/mnemonic
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    
    if ('error' in authResult) {
      return authResult.response;
    }
    
    const body = await request.json();
    const { password } = body;
    
    // Validate input
    if (!password) {
      return createErrorResponse('Password is required', 400);
    }
    
    // Get user's wallet
    const wallet = await getUserWallet(authResult.user.userId);
    
    if (!wallet) {
      return createErrorResponse('No wallet found', 404);
    }
    
    // Decrypt mnemonic
    const decrypted = decryptMnemonic(
      wallet.encrypted_mnemonic,
      password,
      authResult.user.username,
      wallet.encryption_iv,
      wallet.encryption_tag
    );
    
    if (!decrypted.success) {
      return createErrorResponse('Invalid password', 401);
    }
    
    return NextResponse.json({
      success: true,
      mnemonic: decrypted.decrypted,
      network: wallet.network
    });
    
  } catch (error) {
    console.error('Get mnemonic error:', error);
    return createErrorResponse('Failed to get mnemonic', 500);
  }
}
