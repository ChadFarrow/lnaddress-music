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
          // ENABLED: Auto-reconnect to restore wallet session on page reload
          console.log('🔄 Found stored Breez config, attempting auto-reconnect...');
          setLoading(true); // Show loading indicator immediately
          reconnectAttempted.current = true;

          try {
            await connect(storedConfig);
            console.log('✅ Auto-reconnected to Breez wallet successfully');
          } catch (error) {
            console.error('❌ Auto-reconnect failed:', error);
            setIsConnected(false);
          } finally {
            setLoading(false);
          }
        } else if (isSubscribed) {
          setIsConnected(false);
        }
      } catch (err) {
        if (isSubscribed) {
          console.error('Error checking Breez connection:', err);
          setIsConnected(false);
          setLoading(false);
        }
      }
    };

    // Listen for Breez connection events
    const handleBreezConnected = () => {
      console.log('📢 Received breez:connected event in useBreez hook');
      if (breezService.isConnected()) {
        setIsConnected(true);
        refreshBalance();
      }
    };

    // Listen for payment received events to auto-refresh balance
    const handlePaymentReceived = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log('📢 Received breez:payment-received event in useBreez hook');
      console.log('💰 Payment amount:', customEvent.detail?.amount, 'sats');

      // Automatically refresh balance when payment is received
      if (breezService.isConnected()) {
        console.log('🔄 Auto-refreshing balance after payment received...');
        refreshBalance();
      }
    };

    // Listen for boost payment events to auto-refresh balance
    const handleBoostPaymentSent = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log('🚀 Boost payment sent event in useBreez:', customEvent.detail);
      console.log('🚀 Boost amount:', customEvent.detail?.amount, 'sats');
      
      // Automatically refresh balance when boost payment is sent
      if (breezService.isConnected()) {
        console.log('🔄 Auto-refreshing balance after boost payment...');
        refreshBalance();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('breez:connected', handleBreezConnected);
      window.addEventListener('breez:payment-received', handlePaymentReceived);
      window.addEventListener('boost:payment-sent', handleBoostPaymentSent);
    }

    checkConnection();

    return () => {
      isSubscribed = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener('breez:connected', handleBreezConnected);
        window.removeEventListener('breez:payment-received', handlePaymentReceived);
        window.removeEventListener('boost:payment-sent', handleBoostPaymentSent);
      }
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
    console.log('🔌 useBreez.connect() called');
    setLoading(true);
    setError(null);

    try {
      console.log('📡 Calling breezService.connect()...');
      await breezService.connect(config);
      console.log('✅ breezService.connect() completed');

      // Verify we're actually connected
      const actuallyConnected = breezService.isConnected();
      console.log('🔍 Checking connection status:', actuallyConnected);

      setIsConnected(actuallyConnected);
      console.log('✅ setIsConnected(' + actuallyConnected + ') called');

      if (actuallyConnected) {
        // Sync wallet with network first to get latest balance
        console.log('🔄 Syncing Breez wallet with network...');
        try {
          await breezService.syncWallet();
          console.log('✅ Wallet synced successfully');
        } catch (syncError) {
          console.warn('⚠️ Wallet sync failed, balance may be outdated:', syncError);
        }

        // Fetch balance before setting loading=false
        await refreshBalance();
      } else {
        console.error('❌ Connection completed but service reports not connected');
        throw new Error('Connection completed but service is not connected');
      }

      // Only set loading=false after balance is successfully fetched
      setLoading(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect to Breez';
      console.error('❌ Connection error:', errorMessage);
      setError(errorMessage);
      setIsConnected(false);
      setLoading(false);
      throw err;
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
