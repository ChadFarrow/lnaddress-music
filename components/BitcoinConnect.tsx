'use client';

import { useEffect, useState } from 'react';
import { Zap, Wallet } from 'lucide-react';
import { useBitcoinConnect } from '@/contexts/BitcoinConnectContext';

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
      <bc-button 
        disable-balance="true"
        hide-balance="true"
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
  className = '',
  recipient = '03740ea02585ed87b83b2f76317a4562b616bd7b8ec3f925be6596932b2003fc9e',
  recipients
}: {
  amount?: number;
  description?: string;
  onSuccess?: (response: any) => void;
  onError?: (error: string) => void;
  className?: string;
  recipient?: string;
  recipients?: Array<{ address: string; split: number; name?: string; fee?: boolean }>;
}) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const { isConnected } = useBitcoinConnect();

  useEffect(() => {
    const loadBitcoinConnect = async () => {
      try {
        await import('@getalby/bitcoin-connect');
        setMounted(true);
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
      
      // Determine recipients to use
      const paymentsToMake = recipients || [{ address: recipient, split: 100, name: 'Single recipient' }];
      console.log(`⚡ Processing payments to ${paymentsToMake.length} recipients:`, paymentsToMake);
      
      // Calculate total split value for proportional payments
      const totalSplit = paymentsToMake.reduce((sum, r) => sum + r.split, 0);
      const results: any[] = [];
      
      // Try WebLN first if available
      if (weblnEnabled && webln.keysend) {
        console.log(`⚡ Bitcoin Connect WebLN keysend: ${amount} sats split among recipients for "${description}"`);
        
        const errors: string[] = [];
        
        for (const recipientData of paymentsToMake) {
          // Calculate proportional amount based on split
          const recipientAmount = Math.floor((amount * recipientData.split) / totalSplit);
          
          if (recipientAmount > 0) {
            console.log(`⚡ Sending ${recipientAmount} sats to ${recipientData.name || recipientData.address.slice(0, 10)}... (${recipientData.split}/${totalSplit} split)`);
            
            try {
              const response = await webln.keysend({
                destination: recipientData.address,
                amount: recipientAmount * 1000,
                customRecords: {
                  7629169: `${description} - ${recipientData.name || 'Recipient'}`
                }
              });
              
              console.log(`✅ Payment to ${recipientData.name || recipientData.address} successful:`, response);
              results.push({ recipient: recipientData.name || recipientData.address, amount: recipientAmount, response });
            } catch (paymentError) {
              console.error(`❌ Payment to ${recipientData.name || recipientData.address} threw error:`, paymentError);
              errors.push(`Payment to ${recipientData.name || recipientData.address} error: ${paymentError instanceof Error ? paymentError.message : String(paymentError)}`);
            }
          } else {
            console.log(`⏭️ Skipping ${recipientData.name || recipientData.address} - calculated amount is 0 sats`);
          }
        }
        
        // Report results
        if (results.length > 0) {
          console.log(`✅ Bitcoin Connect WebLN payments - ${results.length}/${paymentsToMake.length} successful:`, results);
          if (errors.length > 0) {
            console.warn(`⚠️ Some payments failed:`, errors);
          }
          onSuccess?.(results);
        } else if (errors.length > 0) {
          console.error('❌ All payments failed:', errors);
          throw new Error(`All payments failed: ${errors.join(', ')}`);
        }
      } else {
        // Fallback: Use NWC service for real payments
        console.log(`⚡ Bitcoin Connect using NWC backend: ${amount} sats split among recipients`);
        
        // Import NWC service dynamically to avoid circular dependencies
        const { getNWCService } = await import('../lib/nwc-service');
        const nwcService = getNWCService();
        
        if (nwcService.isConnected()) {
          const errors: string[] = [];
          
          for (const recipientData of paymentsToMake) {
            // Calculate proportional amount based on split
            const recipientAmount = Math.floor((amount * recipientData.split) / totalSplit);
            
            if (recipientAmount > 0) {
              console.log(`⚡ Sending ${recipientAmount} sats to ${recipientData.name || recipientData.address.slice(0, 10)}... (${recipientData.split}/${totalSplit} split)`);
              
              try {
                // Make real keysend payment via NWC
                const tlvRecords = [{
                  type: 7629169,
                  value: Buffer.from(`${description} - ${recipientData.name || 'Recipient'}`, 'utf8').toString('hex')
                }];
                
                const response = await nwcService.payKeysend(
                  recipientData.address,
                  recipientAmount,
                  tlvRecords
                );
                
                if (response.error) {
                  console.error(`❌ Payment to ${recipientData.name || recipientData.address} failed:`, response.error);
                  errors.push(`Payment to ${recipientData.name || recipientData.address} failed: ${response.error}`);
                } else {
                  console.log(`✅ Payment to ${recipientData.name || recipientData.address} successful:`, response);
                  results.push({ recipient: recipientData.name || recipientData.address, amount: recipientAmount, response });
                }
              } catch (paymentError) {
                console.error(`❌ Payment to ${recipientData.name || recipientData.address} threw error:`, paymentError);
                errors.push(`Payment to ${recipientData.name || recipientData.address} error: ${paymentError instanceof Error ? paymentError.message : String(paymentError)}`);
              }
            } else {
              console.log(`⏭️ Skipping ${recipientData.name || recipientData.address} - calculated amount is 0 sats`);
            }
          }
          
          // Report results
          if (results.length > 0) {
            console.log(`✅ Bitcoin Connect NWC payments - ${results.length}/${paymentsToMake.length} successful:`, results);
            if (errors.length > 0) {
              console.warn(`⚠️ Some payments failed:`, errors);
            }
            onSuccess?.(results);
          } else if (errors.length > 0) {
            console.error('❌ All payments failed:', errors);
            throw new Error(`All payments failed: ${errors.join(', ')}`);
          }
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