import { useState, useEffect, useCallback, useRef } from 'react';
import { getBreezService, type BreezConfig, type BreezPaymentRequest, type BreezInvoiceRequest } from '@/lib/breez-service';
import type { Payment } from '@breeztech/breez-sdk-spark/web';

export interface UseBreezReturn {
  isConnected: boolean;
  balance: number | null;
  error: string | null;
  loading: boolean;
  connect: (config: BreezConfig) => Promise<void>;
  disconnect: () => Promise<void>;
  sendPayment: (request: BreezPaymentRequest) => Promise<Payment>;
  receivePayment: (request: BreezInvoiceRequest) => Promise<string>;
  refreshBalance: () => Promise<void>;
  syncWallet: () => Promise<void>;
  listPayments: (filters?: { offset?: number; limit?: number }) => Promise<Payment[]>;
}

/**
 * React hook for using Breez SDK Spark
 */
export function useBreez(): UseBreezReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const reconnectAttempted = useRef(false);

  const breezService = getBreezService();

  // Check connection status on mount and auto-reconnect if needed
  useEffect(() => {
    let isSubscribed = true; // Prevent race conditions

    const checkConnection = async () => {
      if (!isSubscribed) return;

      try {
        // First check if the service is already connected (e.g., after hot reload)
        if (breezService.isConnected()) {
          console.log('🔄 Breez service already connected, updating state...');
          setIsConnected(true);
          await refreshBalance();
          return;
        }

        // Prevent multiple reconnection attempts using ref
        if (reconnectAttempted.current) {
          console.log('⏭️ Skipping reconnect - already attempted (and service not connected)');
          return;
        }

        // Check if there's a stored connection
        const BreezServiceClass = getBreezService().constructor as typeof import('@/lib/breez-service').default;
        const storedConfig = BreezServiceClass.getStoredConfig?.();

        if (storedConfig && isSubscribed) {
          // If we have stored config but not connected, reconnect automatically
          if (!breezService.isConnected()) {
            console.log('🔄 Found stored Breez config, reconnecting...');
            reconnectAttempted.current = true; // Mark that we've attempted reconnection
            await connect(storedConfig);
          } else {
            setIsConnected(true);
            await refreshBalance();
          }
        } else if (isSubscribed) {
          setIsConnected(false);
        }
      } catch (err) {
        if (isSubscribed) {
          console.error('Error checking Breez connection:', err);
          setIsConnected(false);
        }
      }
    };

    checkConnection();

    return () => {
      isSubscribed = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount - connect and refreshBalance are stable callbacks

  /**
   * Refresh balance
   */
  const refreshBalance = useCallback(async () => {
    console.log('🔄 refreshBalance called, isConnected:', breezService.isConnected());

    if (!breezService.isConnected()) {
      console.log('⚠️ Breez not connected, setting balance to null');
      setBalance(null);
      return;
    }

    try {
      // Sync first to ensure we have the latest state
      console.log('🔄 Syncing wallet before balance refresh...');
      try {
        await breezService.syncWallet();
        console.log('✅ Wallet sync completed');
      } catch (syncErr) {
        console.warn('⚠️ Sync during balance refresh failed:', syncErr);
      }

      console.log('📊 Fetching balance from Breez...');
      const balanceSats = await breezService.getBalance();
      console.log('💰 Breez balance fetched:', balanceSats, 'sats (type:', typeof balanceSats, ')');
      setBalance(balanceSats);
      console.log('✅ Balance state updated to:', balanceSats);
    } catch (err) {
      console.error('❌ Error refreshing Breez balance:', err);
      setError(err instanceof Error ? err.message : 'Failed to get balance');
    }
  }, [breezService]);

  /**
   * Connect to Breez SDK
   */
  const connect = useCallback(async (config: BreezConfig) => {
    setLoading(true);
    setError(null);

    try {
      await breezService.connect(config);
      console.log('✅ Breez connected - setting isConnected to TRUE');
      setIsConnected(true);
      console.log('✅ setIsConnected(true) called');

      // Sync wallet with network first to get latest balance
      console.log('🔄 Syncing Breez wallet with network...');
      try {
        await breezService.syncWallet();
        console.log('✅ Wallet synced successfully');
      } catch (syncError) {
        console.warn('⚠️ Wallet sync failed, balance may be outdated:', syncError);
      }

      await refreshBalance();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect to Breez';
      setError(errorMessage);
      setIsConnected(false);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [breezService, refreshBalance]);

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
    connect,
    disconnect,
    sendPayment,
    receivePayment,
    refreshBalance,
    syncWallet,
    listPayments
  };
}
