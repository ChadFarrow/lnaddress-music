import { useState, useEffect, useCallback } from 'react';
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

  const breezService = getBreezService();

  // Check connection status on mount
  useEffect(() => {
    const checkConnection = async () => {
      try {
        // Check if there's a stored connection
        const BreezServiceClass = getBreezService().constructor as typeof import('@/lib/breez-service').default;
        const storedConfig = BreezServiceClass.getStoredConfig?.();

        if (storedConfig && breezService.isConnected()) {
          setIsConnected(true);
          await refreshBalance();
        } else {
          setIsConnected(false);
        }
      } catch (err) {
        console.error('Error checking Breez connection:', err);
        setIsConnected(false);
      }
    };

    checkConnection();
  }, []);

  /**
   * Connect to Breez SDK
   */
  const connect = useCallback(async (config: BreezConfig) => {
    setLoading(true);
    setError(null);

    try {
      await breezService.connect(config);
      setIsConnected(true);
      await refreshBalance();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect to Breez';
      setError(errorMessage);
      setIsConnected(false);
      throw err;
    } finally {
      setLoading(false);
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
   * Refresh balance
   */
  const refreshBalance = useCallback(async () => {
    if (!breezService.isConnected()) {
      setBalance(null);
      return;
    }

    try {
      const balanceSats = await breezService.getBalance();
      setBalance(balanceSats);
    } catch (err) {
      console.error('Error refreshing Breez balance:', err);
      setError(err instanceof Error ? err.message : 'Failed to get balance');
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
