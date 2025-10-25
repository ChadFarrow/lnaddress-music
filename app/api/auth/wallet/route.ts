import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, createErrorResponse } from '@/lib/session-service';
import { storeUserWallet, getUserWallet } from '@/lib/db';
import { encryptMnemonic, decryptMnemonic } from '@/lib/encryption-service';

/**
 * Store/update user wallet mnemonic endpoint
 * POST /api/auth/wallet
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    
    if ('error' in authResult) {
      return authResult.response;
    }
    
    const body = await request.json();
    const { mnemonic, password, network = 'mainnet' } = body;
    
    // Validate input
    if (!mnemonic || !password) {
      return createErrorResponse('Mnemonic and password are required', 400);
    }
    
    // Validate mnemonic format (basic check)
    const words = mnemonic.trim().split(/\s+/);
    if (words.length !== 12) {
      return createErrorResponse('Mnemonic must be exactly 12 words', 400);
    }
    
    // Encrypt mnemonic
    const encrypted = encryptMnemonic(mnemonic, password, authResult.user.username);
    
    // Store encrypted wallet
    const result = await storeUserWallet(
      authResult.user.userId,
      encrypted.encrypted,
      encrypted.iv,
      encrypted.tag,
      network as 'mainnet' | 'regtest'
    );
    
    if (!result.success) {
      return createErrorResponse(result.error || 'Failed to store wallet', 500);
    }
    
    return NextResponse.json({
      success: true,
      message: 'Wallet stored successfully'
    });
    
  } catch (error) {
    console.error('Store wallet error:', error);
    return createErrorResponse('Failed to store wallet', 500);
  }
}

/**
 * Get user wallet info endpoint
 * GET /api/auth/wallet
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    
    if ('error' in authResult) {
      return authResult.response;
    }
    
    const wallet = await getUserWallet(authResult.user.userId);
    
    if (!wallet) {
      return NextResponse.json({
        success: true,
        wallet: null,
        message: 'No wallet found'
      });
    }
    
    return NextResponse.json({
      success: true,
      wallet: {
        id: wallet.id,
        network: wallet.network,
        createdAt: wallet.created_at,
        updatedAt: wallet.updated_at
      }
    });
    
  } catch (error) {
    console.error('Get wallet error:', error);
    return createErrorResponse('Failed to get wallet info', 500);
  }
}
