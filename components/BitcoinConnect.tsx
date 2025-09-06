'use client';

import { useEffect, useState } from 'react';
import { Zap, Wallet } from 'lucide-react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'bc-button': any;
      'bc-balance': any;
    }
  }
}

export function BitcoinConnectWallet() {
  const [mounted, setMounted] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Import Bitcoin Connect dynamically to avoid SSR issues
    const loadBitcoinConnect = async () => {
      try {
        await import('@getalby/bitcoin-connect');
        setMounted(true);
        
        // Listen for connection events
        const handleConnected = () => {
          console.log('🔗 Bitcoin Connect wallet connected');
          setIsConnected(true);
        };
        
        const handleDisconnected = () => {
          console.log('🔗 Bitcoin Connect wallet disconnected');
          setIsConnected(false);
        };

        window.addEventListener('bc:connected', handleConnected);
        window.addEventListener('bc:disconnected', handleDisconnected);

        // Check initial connection state
        if ((window as any).webln?.enabled) {
          setIsConnected(true);
        }

        return () => {
          window.removeEventListener('bc:connected', handleConnected);
          window.removeEventListener('bc:disconnected', handleDisconnected);
        };
      } catch (error) {
        console.error('Failed to load Bitcoin Connect:', error);
      }
    };

    loadBitcoinConnect();
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-lg animate-pulse">
        <Zap className="w-4 h-4 text-yellow-500" />
        <span className="text-sm text-gray-400">Loading...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {isConnected && (
        <div className="flex items-center gap-2 px-2 py-1 bg-gray-800 rounded text-sm text-gray-200">
          <Zap className="w-4 h-4 text-yellow-500" />
          <bc-balance />
        </div>
      )}
      
      <bc-button 
        style={{
          '--bc-color-brand': '#eab308',
          '--bc-color-brand-dark': '#ca8a04',
        }}
      />
    </div>
  );
}

export function BitcoinConnectPayment({ 
  amount = 1000, 
  description = 'Support the creator',
  onSuccess,
  onError,
  className = ''
}: {
  amount?: number;
  description?: string;
  onSuccess?: (response: any) => void;
  onError?: (error: string) => void;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadBitcoinConnect = async () => {
      try {
        await import('@getalby/bitcoin-connect');
        setMounted(true);
        
        // Check initial connection state
        if ((window as any).webln?.enabled) {
          setIsConnected(true);
        }

        // Listen for connection events
        const handleConnected = () => setIsConnected(true);
        const handleDisconnected = () => setIsConnected(false);

        window.addEventListener('bc:connected', handleConnected);
        window.addEventListener('bc:disconnected', handleDisconnected);

        // Periodically check connection status
        const checkConnection = () => {
          const weblnEnabled = !!(window as any).webln?.enabled;
          const bcConnected = localStorage.getItem('bc:connectorType');
          const nwcConnected = localStorage.getItem('nwc_connection_string');
          const anyConnection = weblnEnabled || bcConnected || nwcConnected;
          
          console.log('🔄 Bitcoin Connect status - webln:', weblnEnabled, 'bc:', !!bcConnected, 'nwc:', !!nwcConnected, 'enabling:', anyConnection);
          
          // Enable if any wallet is connected
          if (!!anyConnection !== isConnected) {
            setIsConnected(!!anyConnection);
          }
        };

        const interval = setInterval(checkConnection, 1000);

        return () => {
          window.removeEventListener('bc:connected', handleConnected);
          window.removeEventListener('bc:disconnected', handleDisconnected);
          clearInterval(interval);
        };
      } catch (error) {
        console.error('Failed to load Bitcoin Connect:', error);
      }
    };

    loadBitcoinConnect();
  }, []);

  const handlePayment = async () => {
    const weblnEnabled = !!(window as any).webln?.enabled;
    console.log('🔌 Bitcoin Connect payment attempt - isConnected:', isConnected, 'webln.enabled:', weblnEnabled);
    
    setLoading(true);
    try {
      const webln = (window as any).webln;
      
      // Try WebLN first if available
      if (weblnEnabled && webln.keysend) {
        console.log(`⚡ Bitcoin Connect WebLN keysend: ${amount} sats for "${description}"`);
        
        const response = await webln.keysend({
          destination: '03740ea02585ed87b83b2f76317a4562b616bd7b8ec3f925be6596932b2003fc9e',
          amount: amount * 1000,
          customRecords: {
            7629169: description
          }
        });
        
        console.log('✅ Bitcoin Connect WebLN payment successful:', response);
        onSuccess?.(response);
      } else {
        // Fallback: Use NWC service for real payments
        console.log(`⚡ Bitcoin Connect using NWC backend: ${amount} sats to test address`);
        
        // Import NWC service dynamically to avoid circular dependencies
        const { getNWCService } = await import('../lib/nwc-service');
        const nwcService = getNWCService();
        
        if (nwcService.isConnected()) {
          // Make real keysend payment via NWC
          const tlvRecords = [{
            type: 7629169,
            value: Buffer.from(description, 'utf8').toString('hex')
          }];
          
          const response = await nwcService.payKeysend(
            '03740ea02585ed87b83b2f76317a4562b616bd7b8ec3f925be6596932b2003fc9e',
            amount,
            tlvRecords
          );
          
          if (response.error) {
            throw new Error(response.error);
          }
          
          console.log('✅ Bitcoin Connect NWC payment successful:', response);
          onSuccess?.(response.preimage || 'nwc_payment_success');
        } else {
          throw new Error('No wallet connection available');
        }
      }
      
    } catch (error) {
      console.error('Payment failed:', error);
      onError?.(error instanceof Error ? error.message : 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) {
    return (
      <button className={`flex items-center gap-2 px-4 py-2 bg-yellow-500/50 text-black font-semibold rounded-lg animate-pulse ${className}`}>
        Loading...
      </button>
    );
  }

  return (
    <button
      onClick={handlePayment}
      disabled={loading || !isConnected}
      className={`flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-600 disabled:text-gray-400 text-black font-semibold rounded-lg transition-colors ${className}`}
    >
      <Zap className="w-4 h-4" />
      <span>
        {loading ? 'Processing...' : 
         !isConnected ? 'Connect Wallet First' : 
         `Send ${amount} sats`}
      </span>
    </button>
  );
}