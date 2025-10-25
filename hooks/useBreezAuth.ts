import { useState, useEffect, useCallback } from 'react';
import { getBreezService, type BreezConfig, type BreezPaymentRequest, type BreezInvoiceRequest } from '@/lib/breez-service';
import { useAuth } from '@/contexts/AuthContext';
import type { Payment } from '@breeztech/breez-sdk-spark/web';

export interface UseBreezAuthReturn {
  isConnected: boolean;
  balance: number | null;
  error: string | null;
  loading: boolean;
  connectWithUserWallet: (password: string) => Promise<void>;
  disconnect: () => Promise<void>;
  sendPayment: (request: BreezPaymentRequest) => Promise<Payment>;
  receivePayment: (request: BreezInvoiceRequest) => Promise<string>;
  refreshBalance: () => Promise<void>;
  syncWallet: () => Promise<void>;
  listPayments: (filters?: { offset?: number; limit?: number }) => Promise<Payment[]>;
  hasWallet: boolean;
  walletLoading: boolean;
}

/**
 * React hook for using Breez SDK with user authentication
 * Automatically connects to user's stored wallet on login
 */
export function useBreezAuth(): UseBreezAuthReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasWallet, setHasWallet] = useState(false);
  const [walletLoading, setWalletLoading] = useState(false);

  const { user, getMnemonic } = useAuth();
  const breezService = getBreezService();

  // Check if user has a wallet
  useEffect(() => {
    const checkWallet = async () => {
      if (!user) {
        setHasWallet(false);
        return;
      }

      setWalletLoading(true);
      try {
        const response = await fetch('/api/auth/wallet', {
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          setHasWallet(data.wallet !== null);
        } else {
          setHasWallet(false);
        }
      } catch (error) {
        console.error('Failed to check wallet:', error);
        setHasWallet(false);
      } finally {
        setWalletLoading(false);
      }
    };

    checkWallet();
  }, [user]);

  // Auto-connect when user logs in and has a wallet
  useEffect(() => {
    if (user && hasWallet && !isConnected) {
      // Don't auto-connect - require password for security
      console.log('User has wallet but needs to enter password to connect');
    }
  }, [user, hasWallet, isConnected]);

  /**
   * Connect to Breez using user's stored wallet
   */
  const connectWithUserWallet = useCallback(async (password: string) => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    setLoading(true);
    setError(null);

    try {
      // Get user's mnemonic
      const mnemonicResult = await getMnemonic(password);
      
      if (!mnemonicResult.success) {
        throw new Error(mnemonicResult.error || 'Failed to get mnemonic');
      }

      // Connect to Breez with user's mnemonic
      const config: BreezConfig = {
        apiKey: process.env.NEXT_PUBLIC_BREEZ_API_KEY || '',
        mnemonic: mnemonicResult.mnemonic,
        network: mnemonicResult.network as 'mainnet' | 'regtest' || 'mainnet',
        storageDir: `./breez-sdk-data-${user.id}`
      };

      await breezService.connect(config);
      
      const actuallyConnected = breezService.isConnected();
      setIsConnected(actuallyConnected);

      if (actuallyConnected) {
        // Sync wallet and get balance
        try {
          await breezService.syncWallet();
          await refreshBalance();
        } catch (syncError) {
          console.warn('Wallet sync failed:', syncError);
        }
      } else {
        throw new Error('Failed to connect to Breez wallet');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect to wallet';
      setError(errorMessage);
      setIsConnected(false);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user, getMnemonic, breezService]);

  /**
   * Refresh balance
   */
  const refreshBalance = useCallback(async () => {
    if (!breezService.isConnected()) {
      setBalance(null);
      return;
    }

    try {
      await breezService.syncWallet();
      const balanceSats = await breezService.getBalance();
      setBalance(balanceSats);
    } catch (err) {
      console.error('Error refreshing balance:', err);
      setError(err instanceof Error ? err.message : 'Failed to get balance');
    }
  }, [breezService]);

  /**
   * Disconnect from Breez SDK
   */
  const disconnect = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      await breezService.disconnect();
      setIsConnected(false);
      setBalance(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to disconnect from Breez';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [breezService]);

  /**
   * Send a payment
   */
  const sendPayment = useCallback(async (request: BreezPaymentRequest): Promise<Payment> => {
    if (!isConnected) {
      throw new Error('Not connected to Breez');
    }

    setLoading(true);
    setError(null);

    try {
      const payment = await breezService.sendPayment(request);
      await refreshBalance();
      return payment;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Payment failed';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [breezService, isConnected, refreshBalance]);

  /**
   * Receive a payment (create invoice)
   */
  const receivePayment = useCallback(async (request: BreezInvoiceRequest): Promise<string> => {
    if (!isConnected) {
      throw new Error('Not connected to Breez');
    }

    setLoading(true);
    setError(null);

    try {
      const invoice = await breezService.receivePayment(request);
      return invoice;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create invoice';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [breezService, isConnected]);

  /**
   * Sync wallet with network
   */
  const syncWallet = useCallback(async () => {
    if (!isConnected) {
      throw new Error('Not connected to Breez');
    }

    setLoading(true);
    setError(null);

    try {
      await breezService.syncWallet();
      await refreshBalance();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sync wallet';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [breezService, isConnected, refreshBalance]);

  /**
   * List payments
   */
  const listPayments = useCallback(async (filters?: { offset?: number; limit?: number }): Promise<Payment[]> => {
    if (!isConnected) {
      throw new Error('Not connected to Breez');
    }

    setError(null);

    try {
      return await breezService.listPayments(filters);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to list payments';
      setError(errorMessage);
      throw err;
    }
  }, [breezService, isConnected]);

  return {
    isConnected,
    balance,
    error,
    loading,
    connectWithUserWallet,
    disconnect,
    sendPayment,
    receivePayment,
    refreshBalance,
    syncWallet,
    listPayments,
    hasWallet,
    walletLoading
  };
}
