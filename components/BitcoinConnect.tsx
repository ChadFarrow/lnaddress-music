'use client';

import { useEffect, useState } from 'react';
import { Zap, Wallet } from 'lucide-react';
import { useBitcoinConnect } from '@/contexts/BitcoinConnectContext';
import { useBoostToNostr } from '@/hooks/useBoostToNostr';
import { useLightning } from '@/contexts/LightningContext';
import { useBreez } from '@/hooks/useBreez';
import AlbyGoConnect from './AlbyGoConnect';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'bc-button': any;
      'bc-balance': any;
    }
  }
  interface Window {
    bitcoinConnectInitialized?: boolean;
  }
}

export function BitcoinConnectWallet() {
  const [mounted, setMounted] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const { isLightningEnabled } = useLightning();

  useEffect(() => {
    // Only initialize Bitcoin Connect if Lightning is enabled
    if (!isLightningEnabled) {
      return;
    }
    // Import Bitcoin Connect dynamically to avoid SSR issues
    const loadBitcoinConnect = async () => {
      try {
        const bc = await import('@getalby/bitcoin-connect');
        
        // Initialize Bitcoin Connect with basic configuration
        if (bc.init && !window.bitcoinConnectInitialized) {
          bc.init({
            appName: 'lnaddress music',
            // Remove filters to show all wallet types including browser extensions
            showBalance: false, // Hide balance to keep UI clean
            // Enable all connectors including NWC
            filters: undefined
          });
          window.bitcoinConnectInitialized = true;
          console.log('🔌 Bitcoin Connect initialized with NWC support');
        }
        
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

        // Hide only balance elements, preserve connection status
        const hideBalanceElements = () => {
          setTimeout(() => {
            // Get all bc-button elements
            const bcButtons = document.querySelectorAll('bc-button');
            
            bcButtons.forEach(bcButton => {
              // Try to access shadow root if available
              const shadowRoot = (bcButton as any).shadowRoot;
              if (shadowRoot) {
                // Hide only balance elements in shadow DOM
                const shadowElements = shadowRoot.querySelectorAll('*');
                shadowElements.forEach((el: any) => {
                  const text = el.textContent || '';
                  // Only hide if it contains balance numbers, not general connection text
                  if (text.match(/\d+[,\d]*\s*(sats?|sat)/i)) {
                    el.style.display = 'none';
                    el.style.visibility = 'hidden';
                  }
                });
              }
              
              // Check regular DOM elements - preserve connection status
              const allElements = (bcButton as unknown as HTMLElement).querySelectorAll('*');
              allElements.forEach(el => {
                const text = el.textContent || '';
                // Only hide balance numbers, preserve "Connected", "Disconnected" etc
                if (text.match(/^\d+[,\d]*\s*(sats?|sat)$/i)) {
                  (el as HTMLElement).style.display = 'none';
                  (el as HTMLElement).style.visibility = 'hidden';
                }
              });
            });
            
            // Only hide specific bc-balance elements
            const balanceElements = document.querySelectorAll('bc-balance');
            balanceElements.forEach(el => {
              (el as unknown as HTMLElement).style.display = 'none';
              (el as unknown as HTMLElement).style.visibility = 'hidden';
            });
          }, 500);
        };

        // Run balance hiding less frequently to avoid interfering with connection status
        const hideInterval = setInterval(hideBalanceElements, 3000);
        hideBalanceElements(); // Run once initially

        return () => {
          window.removeEventListener('bc:connected', handleConnected);
          window.removeEventListener('bc:disconnected', handleDisconnected);
          clearInterval(hideInterval);
        };
      } catch (error) {
        console.error('Failed to load Bitcoin Connect:', error);
      }
    };

    loadBitcoinConnect();
  }, [isLightningEnabled]);

  // Don't render anything if Lightning is disabled
  if (!isLightningEnabled) {
    return null;
  }

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
      {/* Standard Bitcoin Connect button */}
      <bc-button 
        disable-balance="true"
        hide-balance="true"
        show-balance="false"
        style={{
          '--bc-color-brand': '#eab308',
          '--bc-color-brand-dark': '#ca8a04',
          '--bc-show-balance': 'none',
          '--bc-balance-display': 'none',
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
  recipients,
  enableBoosts = false,
  boostMetadata
}: {
  amount?: number;
  description?: string;
  onSuccess?: (response: any) => void;
  onError?: (error: string) => void;
  className?: string;
  recipient?: string;
  recipients?: Array<{ address: string; split: number; name?: string; fee?: boolean; type?: string; fixedAmount?: number }>;
  enableBoosts?: boolean;
  boostMetadata?: {
    title?: string;
    artist?: string;
    album?: string;
    imageUrl?: string;
    podcastFeedGuid?: string;
    podcastGuid?: string; // podcast:guid at item level
    episode?: string;
    feedUrl?: string;
    itemGuid?: string;
    timestamp?: number;
    senderName?: string;
    appName?: string;
    url?: string;
    publisherGuid?: string;
    publisherUrl?: string;
    message?: string; // Boostagram message
  };
}) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const { isConnected, connectedWalletType } = useBitcoinConnect();
  const { isLightningEnabled } = useLightning();
  const breez = useBreez();

  // Enhanced connection detection - check multiple sources
  const isActuallyConnected = isConnected || breez.isConnected || !!(window as any).webln?.enabled;

  // Debug: Log when isConnected state changes
  useEffect(() => {
    console.log('🔗 BitcoinConnectPayment - isConnected state changed:', isConnected);
  }, [isConnected]);

  // Force re-render when connection state changes to eliminate React rendering delays
  const [renderKey, setRenderKey] = useState(0);
  useEffect(() => {
    setRenderKey(prev => prev + 1);
  }, [isConnected]);

  // Listen for connection state changes and force re-render
  useEffect(() => {
    const handleConnectionChange = () => {
      console.log('🔄 BitcoinConnectPayment received connection change event');
      setRenderKey(prev => prev + 1);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('bc:connection-changed', handleConnectionChange);
      return () => window.removeEventListener('bc:connection-changed', handleConnectionChange);
    }
  }, []);
  
  // Initialize Nostr boost system if boosts are enabled
  const { postBoost, generateKeys, publicKey } = useBoostToNostr({ 
    autoGenerateKeys: enableBoosts
  });


  // Helper function to create enhanced TLV records for boosts following podcast namespace spec
  const createBoostTLVRecords = async (recipientName?: string) => {
    const tlvRecords = [];
    
    if (boostMetadata) {
      // 7629169 - Podcast metadata JSON (bLIP-10 standard - Breez/Fountain compatible)
      // Fixed to match working Castamatic format
      const podcastMetadata = {
        podcast: boostMetadata.artist || 'Unknown Artist',
        episode: boostMetadata.title || 'Unknown Title',
        action: 'boost',
        app_name: boostMetadata.appName || 'lnaddress music',
        // Use actual feed URL from metadata for proper Helipad recognition
        feed: boostMetadata.feedUrl || 'https://www.doerfelverse.com/feeds/intothedoerfelverse.xml',
        url: boostMetadata.feedUrl || 'https://www.doerfelverse.com/feeds/intothedoerfelverse.xml',
        message: boostMetadata.message || '',
        ...(boostMetadata.timestamp && { ts: boostMetadata.timestamp }),
        // Use proper feedId (lowercase 'd') for Helipad compatibility - it expects feedId not feedID
        feedId: boostMetadata.feedUrl === 'https://www.doerfelverse.com/feeds/bloodshot-lies-album.xml' ? "6590183" : "6590182",
        // Add Helipad-specific GUID fields
        ...(boostMetadata.itemGuid && { episode_guid: boostMetadata.itemGuid }),
        ...(boostMetadata.itemGuid && { remote_item_guid: boostMetadata.itemGuid }),
        ...(boostMetadata.podcastFeedGuid && { remote_feed_guid: boostMetadata.podcastFeedGuid }),
        ...(boostMetadata.album && { album: boostMetadata.album }),
        value_msat_total: amount * 1000,
        sender_name: boostMetadata.senderName || 'Anonymous',
        uuid: `boost-${Date.now()}-${Math.floor(Math.random() * 1000)}`, // Unique identifier
        app_version: '1.0.0', // App version
        value_msat: recipients ? Math.floor((amount * 1000) / recipients.length) : amount * 1000, // Individual payment amount
        name: 'lnaddress music' // App/service name
      };
      
      // Log the exact TLV data for debugging (matching payment-utils.ts)
      console.log('🔍 HELIPAD DEBUG - Exact TLV 7629169 data being sent:');
      console.log(JSON.stringify(podcastMetadata, null, 2));
      
      tlvRecords.push({
        type: 7629169,
        value: Buffer.from(JSON.stringify(podcastMetadata), 'utf8').toString('hex')
      });
      
      // 7629171 - Tip note/message (Lightning spec compliant) - only if custom message provided
      if (boostMetadata.message) {
        tlvRecords.push({
          type: 7629171,
          value: Buffer.from(boostMetadata.message, 'utf8').toString('hex')
        });
      }
      
      // 133773310 - Sphinx compatibility (JSON encoded data)
      const sphinxData = {
        podcast: boostMetadata.artist || 'Unknown Artist',
        episode: boostMetadata.title || 'Unknown Title', 
        action: 'boost',
        app: boostMetadata.appName || 'lnaddress music',
        message: boostMetadata.message || '',
        amount: amount,
        sender: boostMetadata.senderName || 'Anonymous',
        ...(boostMetadata.timestamp && { timestamp: boostMetadata.timestamp })
      };
      
      tlvRecords.push({
        type: 133773310,
        value: Buffer.from(JSON.stringify(sphinxData), 'utf8').toString('hex')
      });
      
    } else {
      // Fallback for non-boost payments - simple message
      const message = `${description}${recipientName ? ` - ${recipientName}` : ''}`;
      tlvRecords.push({
        type: 7629171, // Use tip note format
        value: Buffer.from(message, 'utf8').toString('hex')
      });
    }
    
    // Log total TLV record count for debugging
    console.log(`🔍 HELIPAD DEBUG - Total TLV records created: ${tlvRecords.length}`);
    
    return tlvRecords;
  };

  // Helper function to convert TLV records to WebLN customRecords format  
  const createWebLNCustomRecords = async (recipientName?: string) => {
    const tlvRecords = await createBoostTLVRecords(recipientName);
    const customRecords: { [key: number]: string } = {};
    
    tlvRecords.forEach(record => {
      // Convert hex back to string for WebLN
      const value = Buffer.from(record.value, 'hex').toString('utf8');
      customRecords[record.type] = value;
    });
    
    return customRecords;
  };

  useEffect(() => {
    // Only load Bitcoin Connect if Lightning is enabled
    if (!isLightningEnabled) {
      return;
    }
    
    const loadBitcoinConnect = async () => {
      try {
        await import('@getalby/bitcoin-connect');
        setMounted(true);
      } catch (error) {
        console.error('Failed to load Bitcoin Connect:', error);
      }
    };

    loadBitcoinConnect();
  }, [isLightningEnabled]);

  // Helper function to create Nostr boost notes after successful payments
  const handleBoostCreation = async (paymentResults: any[], totalAmount: number) => {
    if (!enableBoosts || !boostMetadata) {
      console.log('ℹ️ Boosts not enabled or no boost metadata provided');
      return;
    }

    try {
      console.log('🚀 Creating Nostr boost for payment results:', paymentResults);
      
      // Create track metadata for Nostr posting
      const trackMetadata = {
        title: boostMetadata.title,
        artist: boostMetadata.artist,
        album: boostMetadata.album,
        url: boostMetadata.url,
        imageUrl: boostMetadata.imageUrl,
        timestamp: boostMetadata.timestamp,
        duration: undefined, // Not available in boost metadata
        senderName: boostMetadata.senderName,
        guid: boostMetadata.itemGuid,
        podcastGuid: boostMetadata.podcastGuid,
        feedGuid: boostMetadata.podcastFeedGuid,
        feedUrl: boostMetadata.feedUrl,
        publisherGuid: boostMetadata.publisherGuid,
        publisherUrl: boostMetadata.publisherUrl
      };

      // Post boost to Nostr
      const result = await postBoost(
        totalAmount,
        trackMetadata,
        boostMetadata.message
      );

      if (result.success) {
        console.log('✅ Boost posted to Nostr successfully:', result.eventId);
        
        // Trigger a custom event for other components to listen to
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('newBoost', { 
            detail: { 
              event: result.event, 
              track: trackMetadata, 
              amount: totalAmount, 
              comment: boostMetadata.message 
            } 
          }));
        }
      } else {
        console.warn('⚠️ Failed to post boost to Nostr:', result.error);
      }
    } catch (error) {
      console.error('❌ Error creating Nostr boost:', error);
    }
  };

  const handlePayment = async () => {
    // Use enhanced detection logic similar to context
    const weblnExists = !!(window as any).webln;
    const weblnEnabled = weblnExists && !!(window as any).webln?.enabled;
    const hasWeblnMethods = weblnExists && (
      typeof (window as any).webln?.makeInvoice === 'function' ||
      typeof (window as any).webln?.sendPayment === 'function' ||
      typeof (window as any).webln?.keysend === 'function'
    );
    // Only allow WebLN if user explicitly connected a WebLN wallet (not Breez)
    // This prevents WebLN from being used when user connected Breez
    const weblnAvailable = (weblnEnabled || hasWeblnMethods) && connectedWalletType !== 'breez';
    
    console.log('🔌 Bitcoin Connect payment attempt:', {
      isConnected,
      isActuallyConnected,
      connectedWalletType,
      weblnExists,
      weblnEnabled,
      hasWeblnMethods,
      weblnAvailable,
      breezConnected: breez.isConnected
    });

    // If we're not actually connected, show an error
    if (!isActuallyConnected) {
      onError?.('No wallet connection found. Please connect a Lightning wallet first.');
      setLoading(false);
      return;
    }

    console.log('🚀 sendPayment called with:', { recipient, amount, description, enableBoosts, connectedWalletType });
    setLoading(true);
    try {
      // 🎯 PRIORITY 1: Respect the user's explicitly connected wallet type
      console.log('🔍 User connected wallet type:', connectedWalletType);

      // Determine recipients to use
      const paymentsToMake = recipients || [{ address: recipient, split: 100, name: 'Single recipient' }];

      // Check if any payment is a Lightning Address
      // Breez SDK has strict LNURL security validation that may fail with some providers
      const hasLightningAddress = paymentsToMake.some(p =>
        p.address.includes('@') && !p.address.startsWith('lnbc')
      );

      // 🎯 PRIORITY: Use the wallet type the user explicitly connected
      if (connectedWalletType === 'breez' && breez.isConnected && !hasLightningAddress) {
        // User connected Breez on the main page - use it for keysend/invoice payments
        console.log('⚡ Breez SDK is connected - using Breez for payment');
        console.log(`⚡ Processing ${paymentsToMake.length} payments via Breez SDK:`, paymentsToMake);

        // Check if wallet has sufficient funds before attempting payment
        try {
          const breezService = (await import('@/lib/breez-service')).getBreezService();
          const fundCheck = await breezService.canPay(amount);
          if (!fundCheck.canPay) {
            console.error('❌ Insufficient Breez funds:', fundCheck.message);
            setLoading(false);
            onError?.(fundCheck.message || 'Insufficient funds');
            return;
          }
          console.log('✅ Sufficient funds available:', fundCheck);
        } catch (checkError) {
          console.warn('⚠️ Could not check balance, attempting payment anyway:', checkError);
        }

        // Calculate total split value for proportional payments
        const totalSplit = paymentsToMake.reduce((sum, r) => sum + r.split, 0);

        // Process all payments in parallel for maximum speed
        const paymentPromises = paymentsToMake.map(async (paymentRecipient) => {
          const paymentAmount = paymentRecipient.fixedAmount ||
                               Math.floor((amount * paymentRecipient.split) / totalSplit);

          if (paymentAmount <= 0) {
            console.log(`⏭️ Skipping ${paymentRecipient.name || paymentRecipient.address}: amount is 0`);
            return { success: false, skipped: true, recipient: paymentRecipient.address };
          }

          console.log(`💳 Breez payment to ${paymentRecipient.name || paymentRecipient.address}: ${paymentAmount} sats`);

          return breez.sendPayment({
            destination: paymentRecipient.address,
            amountSats: paymentAmount,
            label: paymentRecipient.name || description,
            message: boostMetadata?.message
          }).then((payment) => {
            console.log(`✅ Breez payment successful:`, payment.id);
            return {
              success: true,
              recipient: paymentRecipient.address,
              amount: paymentAmount,
              payment: payment
            };
          }).catch((error) => {
            console.error(`❌ Breez payment failed for ${paymentRecipient.name}:`, error);
            return {
              success: false,
              recipient: paymentRecipient.address,
              error: error instanceof Error ? error.message : 'Payment failed'
            };
          });
        });

        const results = await Promise.all(paymentPromises);

        // Check if all payments succeeded
        const successfulPayments = results.filter(r => r.success);
        const failedPayments = results.filter(r => !r.success && !r.skipped);
        const allSucceeded = results.every(r => r.success);
        const anySucceeded = results.some(r => r.success);

        setLoading(false);

        if (allSucceeded) {
          console.log('✅ All Breez payments succeeded');
          await handleBoostCreation(results, amount);
          onSuccess?.(results);
        } else if (anySucceeded) {
          console.warn('⚠️ Some Breez payments failed:', failedPayments.length, 'failed,', successfulPayments.length, 'succeeded');
          // Still create boost and call success for partial payments
          await handleBoostCreation(successfulPayments, amount);
          onSuccess?.(results);
          // Show a warning toast about partial failure
          if (typeof window !== 'undefined') {
            const { toast } = await import('@/components/Toast');
            toast.warning(`Payment partially succeeded. ${successfulPayments.length} of ${results.length} payments completed.`);
          }
        } else {
          console.error('❌ All Breez payments failed');
          onError?.('All payments failed');
        }

        return;
      } else if (connectedWalletType === 'breez' && hasLightningAddress) {
        console.log('⚠️ User connected Breez, but payment has Lightning Addresses');
        console.log('⚠️ Breez SDK has strict LNURL validation - this may fail');
        console.log('⚠️ Consider connecting an NWC wallet for Lightning Address payments');
        // Still try with Breez since that's what the user connected
        console.log('⚡ Attempting Breez payment anyway (user choice)...');

        // Check if wallet has sufficient funds before attempting payment
        try {
          const breezService = (await import('@/lib/breez-service')).getBreezService();
          const fundCheck = await breezService.canPay(amount);
          if (!fundCheck.canPay) {
            console.error('❌ Insufficient Breez funds:', fundCheck.message);
            setLoading(false);
            onError?.(fundCheck.message || 'Insufficient funds');
            return;
          }
          console.log('✅ Sufficient funds available:', fundCheck);
        } catch (checkError) {
          console.warn('⚠️ Could not check balance, attempting payment anyway:', checkError);
        }

        const totalSplit = paymentsToMake.reduce((sum, r) => sum + r.split, 0);

        // Process all payments in parallel for maximum speed
        const paymentPromises = paymentsToMake.map(async (paymentRecipient) => {
          const paymentAmount = paymentRecipient.fixedAmount ||
                               Math.floor((amount * paymentRecipient.split) / totalSplit);

          if (paymentAmount <= 0) {
            console.log(`⏭️ Skipping ${paymentRecipient.name || paymentRecipient.address}: amount is 0`);
            return { success: false, skipped: true, recipient: paymentRecipient.address };
          }

          console.log(`💳 Breez payment to ${paymentRecipient.name || paymentRecipient.address}: ${paymentAmount} sats`);

          return breez.sendPayment({
            destination: paymentRecipient.address,
            amountSats: paymentAmount,
            label: paymentRecipient.name || description,
            message: boostMetadata?.message
          }).then((payment) => {
            console.log(`✅ Breez payment successful:`, payment.id);
            return {
              success: true,
              recipient: paymentRecipient.address,
              amount: paymentAmount,
              payment: payment
            };
          }).catch((error) => {
            console.error(`❌ Breez payment failed for ${paymentRecipient.name}:`, error);
            return {
              success: false,
              recipient: paymentRecipient.address,
              error: error instanceof Error ? error.message : 'Payment failed'
            };
          });
        });

        const results = await Promise.all(paymentPromises);

        const successfulPayments = results.filter(r => r.success);
        const failedPayments = results.filter(r => !r.success && !r.skipped);
        const allSucceeded = results.every(r => r.success);
        const anySucceeded = results.some(r => r.success);

        setLoading(false);

        if (allSucceeded) {
          console.log('✅ All Breez payments succeeded');
          await handleBoostCreation(results, amount);
          onSuccess?.(results);
        } else if (anySucceeded) {
          console.warn('⚠️ Some Breez payments failed:', failedPayments.length, 'failed,', successfulPayments.length, 'succeeded');
          // Still create boost and call success for partial payments
          await handleBoostCreation(successfulPayments, amount);
          onSuccess?.(results);
          // Show a warning toast about partial failure
          if (typeof window !== 'undefined') {
            const { toast } = await import('@/components/Toast');
            toast.warning(`Payment partially succeeded. ${successfulPayments.length} of ${results.length} payments completed.`);
          }
        } else {
          console.error('❌ All Breez payments failed');
          onError?.('All payments failed. Breez SDK may not support these Lightning Addresses. Try connecting an NWC wallet instead.');
        }

        return;
      }

      const webln = (window as any).webln;

      console.log(`⚡ Processing payments to ${paymentsToMake.length} recipients:`, paymentsToMake);
      
      // Calculate total split value for proportional payments
      const totalSplit = paymentsToMake.reduce((sum, r) => sum + r.split, 0);
      const results: any[] = [];
      
      // Check Bitcoin Connect's preferred connection method
      let bcConfig = null;
      let bcConnectorType = null;
      let nwcConnectionString = null;
      
      try {
        const bcConfigRaw = localStorage.getItem('bc:config');
        if (bcConfigRaw) {
          bcConfig = JSON.parse(bcConfigRaw);
          bcConnectorType = bcConfig.connectorType;
          nwcConnectionString = bcConfig.nwcUrl;
        }
      } catch (error) {
        console.warn('Failed to parse bc:config:', error);
      }
      
      // Fallback to old method
      if (!bcConnectorType) {
        bcConnectorType = localStorage.getItem('bc:connectorType');
      }
      if (!nwcConnectionString) {
        nwcConnectionString = localStorage.getItem('nwc_connection_string');
      }
      
      console.log(`🔍 Bitcoin Connect state - connectorType: "${bcConnectorType}", NWC URL exists: ${!!nwcConnectionString}`);
      
      // Respect Bitcoin Connect's connector choice
      let shouldUseNWC = false;
      let nwcService = null;
      
      // Check if this is a Cashu wallet early
      const isCashuWallet = bcConnectorType === 'nwc.cashume' || 
                           bcConnectorType === 'nwc.cashu' ||
                           (nwcConnectionString && (nwcConnectionString.includes('cashu') || nwcConnectionString.includes('mint')));
      
      if (isCashuWallet) {
        console.log('🥜 Cashu wallet detected - keysend payments will be filtered out');
      }

      // If user selected NWC in Bitcoin Connect, prioritize that
      if (bcConnectorType === 'nwc.generic' || bcConnectorType === 'nwc' || bcConnectorType === 'nwc.cashume' || bcConnectorType === 'nwc.cashu' || (bcConnectorType && nwcConnectionString)) {
        try {
          const { getNWCService } = await import('../lib/nwc-service');
          nwcService = getNWCService();
          
          if (nwcConnectionString && !nwcService.isConnected()) {
            await nwcService.connect(nwcConnectionString);
          }
          
          shouldUseNWC = nwcService.isConnected();
          console.log(`🔍 NWC connection attempt: ${shouldUseNWC ? 'successful' : 'failed'}`);
        } catch (error) {
          console.warn('NWC service failed:', error);
          shouldUseNWC = false;
        }
      }
      
      // Analyze recipients to determine optimal payment method
      const nodeRecipients = paymentsToMake.filter(r => r.type === 'node' || (r.address && r.address.length === 66 && !r.address.includes('@')));
      const lnAddressRecipients = paymentsToMake.filter(r => r.type === 'lnaddress' || (r.address && r.address.includes('@')));
      
      console.log(`🔍 Recipient analysis: ${nodeRecipients.length} keysend, ${lnAddressRecipients.length} Lightning addresses`);
      
      // Comprehensive automatic routing: analyze all scenarios
      let useNWC = shouldUseNWC;
      let routingReason = 'default preference';

      // Bridge functionality removed - using direct NWC/WebLN only
      const bridgeAvailable = false;

      // 🎯 ABSOLUTE PRIORITY: Respect user's explicit wallet type selection
      // connectedWalletType tells us what the user explicitly connected on the main page
      if (connectedWalletType === 'nwc' || connectedWalletType === 'bitcoin-connect') {
        // User explicitly connected NWC or Bitcoin Connect wallet
        console.log('🧠 Smart routing: User explicitly connected', connectedWalletType, '→ Using their wallet');
        useNWC = shouldUseNWC;
        routingReason = `User selected ${connectedWalletType} wallet (explicit choice overrides all defaults)`;
      } else if (connectedWalletType === 'webln' && weblnAvailable) {
        // User explicitly connected WebLN wallet
        console.log('🧠 Smart routing: User explicitly connected WebLN → Using WebLN');
        useNWC = false;
        routingReason = 'User selected WebLN wallet (explicit choice)';
      } else if (weblnAvailable && nodeRecipients.length > 0) {
        // Fallback for legacy behavior
        console.log('🧠 Smart routing: WebLN available for keysend → Prioritizing for podcast compatibility (Helipad)');
        useNWC = false;
        routingReason = 'WebLN keysend ensures Helipad compatibility';
      }

      // Continue with Cashu-specific logic only if no explicit wallet type set
      if (connectedWalletType === null && shouldUseNWC && isCashuWallet) {
        // CASHU WALLET SCENARIOS
        if (nodeRecipients.length > 0 && lnAddressRecipients.length > 0) {
          // Mixed recipients: keysend + Lightning addresses
          if (bridgeAvailable) {
            console.log('🧠 Smart routing: Cashu + mixed recipients → Bridge enables full compatibility');
            useNWC = true;
            routingReason = 'bridge handles keysend, Cashu handles Lightning addresses';
          } else if (weblnAvailable) {
            console.log('🧠 Smart routing: Cashu + mixed recipients → WebLN better without bridge');
            useNWC = false;
            routingReason = 'WebLN handles all payment types natively';
          } else {
            console.log('🧠 Smart routing: Cashu + mixed recipients → Partial payments only');
            useNWC = true;
            routingReason = 'only Lightning addresses will succeed';
          }
        } else if (nodeRecipients.length > 0) {
          // Only keysend recipients
          if (bridgeAvailable) {
            console.log('🧠 Smart routing: Cashu + keysend only → Bridge enables compatibility');
            useNWC = true;
            routingReason = 'bridge converts keysend to invoices';
          } else if (weblnAvailable) {
            console.log('🧠 Smart routing: Cashu + keysend only → WebLN better without bridge');
            useNWC = false;
            routingReason = 'WebLN supports keysend natively';
          } else {
            console.log('🧠 Smart routing: Cashu + keysend only → No viable method available');
            useNWC = false;
            routingReason = 'Cashu wallets cannot send keysend without bridge';
          }
        } else {
          // Only Lightning addresses
          console.log('🧠 Smart routing: Cashu + Lightning addresses only → Perfect match');
          useNWC = true;
          routingReason = 'Cashu excels at Lightning address payments';
        }
      } else if (shouldUseNWC && !isCashuWallet) {
        // NON-CASHU NWC WALLET SCENARIOS
        if (nodeRecipients.length > 0) {
          console.log('🧠 Smart routing: NWC wallet + keysend → Checking native support');
          useNWC = true;
          routingReason = 'NWC wallet should support keysend natively';
        } else {
          console.log('🧠 Smart routing: NWC wallet + Lightning addresses → Optimal');
          useNWC = true;
          routingReason = 'Lightning addresses work perfectly with NWC';
        }
      } else if (weblnAvailable) {
        // WEBLN ONLY SCENARIOS
        console.log('🧠 Smart routing: WebLN available → Universal compatibility');
        useNWC = false;
        routingReason = 'WebLN supports all payment types natively';
      } else {
        // NO WALLET AVAILABLE
        console.log('🧠 Smart routing: No wallet available → Will prompt for connection');
        useNWC = false;
        routingReason = 'no wallet connected';
      }
      
      console.log(`🔍 Payment method selection: BC connector: "${bcConnectorType}", Use NWC: ${useNWC}, WebLN available: ${weblnAvailable}, Reason: ${routingReason}`);
      
      // Use the smart routing decision
      if (useNWC && nwcService) {
        console.log(`⚡ Bitcoin Connect using NWC (prioritized): ${amount} sats split among recipients`);
        
        // Check if we need bridge mode before creating payment promises
        // Bridge functionality removed - using direct NWC/WebLN only
        const usingBridge = false;
        console.log('🔍 Direct NWC payment mode (bridge disabled)');
        
        // Process payments based on bridge mode
        const paymentPromises = paymentsToMake.map(async (recipientData) => {
          // Calculate amount: use fixed amount if specified, otherwise proportional split
          const recipientAmount = (recipientData as any).fixedAmount || Math.floor((amount * recipientData.split) / totalSplit);
          
          if (recipientAmount <= 0) {
            console.log(`⏭️ Skipping ${recipientData.name || recipientData.address} - calculated amount is 0 sats`);
            return null;
          }
          
          // Skip known offline nodes temporarily 
          if (recipientData.address === '035ad2c954e264004986da2d9499e1732e5175e1dcef2453c921c6cdcc3536e9d8') {
            console.log(`⏭️ Skipping ${recipientData.name || recipientData.address} - node temporarily offline`);
            return null;
          }
          
          console.log(`⚡ NWC sending ${recipientAmount} sats to ${recipientData.name || recipientData.address.slice(0, 10)}... (${recipientData.split}/${totalSplit} split)`);
          
          try {
            let response;
            
            // Handle different payment types for NWC
            if (recipientData.type === 'lnaddress' || (recipientData.address && recipientData.address.includes('@'))) {
              // For Lightning addresses, resolve to invoice and pay
              console.log(`🔗 NWC resolving Lightning address: ${recipientData.address}`);
              const comment = `Boost for "${description}" by ${recipientData.name || 'Unknown'}`;
              
              response = await nwcService.payLightningAddress(
                recipientData.address,
                recipientAmount,
                comment
              );
            } else {
              // For node public keys, use keysend with TLV records
              console.log(`⚡ NWC sending keysend to node: ${recipientData.address}`);
              const tlvRecords = await createBoostTLVRecords(recipientData.name || 'Recipient');
              
              // DEBUG: Log detailed keysend data and compare with working format
              const ourTlvData = tlvRecords.map(r => {
                try {
                  return {
                    type: r.type,
                    data: JSON.parse(Buffer.from(r.value, 'hex').toString('utf8'))
                  };
                } catch {
                  return {
                    type: r.type,
                    data: Buffer.from(r.value, 'hex').toString('utf8')
                  };
                }
              });

              console.log('🔍 KEYSEND DEBUG - OUR APP:', {
                recipient: recipientData.name || 'Unknown',
                pubkey: recipientData.address,
                amount: recipientAmount,
                tlvRecordCount: tlvRecords.length,
                tlvTypes: tlvRecords.map(r => r.type),
                ourTlvData: ourTlvData
              });

              console.log('🔍 COMPARISON - WORKING vs OUR FORMAT:');
              console.log('✅ WORKING (Castamatic to Sovereign Feeds):');
              console.log('  feedID: 6590182 (numeric)');
              console.log('  episode_guid: b4578bea-855b-48a6-a747-1a09ed44a19a');
              console.log('  url: https://www.doerfelverse.com/feeds/intothedoerfelverse.xml');
              console.log('❓ OUR APP (lnaddress music):');
              console.log(`  feedId: ${boostMetadata?.feedUrl === 'https://www.doerfelverse.com/feeds/bloodshot-lies-album.xml' ? "6590183" : "6590182"} (FIXED: using lowercase feedId for Helipad)`);
              console.log(`  episode_guid: ${boostMetadata?.itemGuid || 'missing'}`);
              console.log(`  url: ${boostMetadata?.feedUrl || 'RSS feed URL'}`);
              
              // Direct keysend payment using NWC service
              console.log('⚡ Using direct keysend payment');
              response = await nwcService.payKeysend(
                recipientData.address,
                recipientAmount,
                tlvRecords
              );
            }
            
            if (response.error) {
              console.error(`❌ NWC payment to ${recipientData.name || recipientData.address} failed:`, response.error);
              throw new Error(`Payment to ${recipientData.name || recipientData.address} failed: ${response.error}`);
            } else {
              console.log(`✅ NWC payment to ${recipientData.name || recipientData.address} successful:`, response);
              return { recipient: recipientData.name || recipientData.address, amount: recipientAmount, response };
            }
          } catch (paymentError) {
            console.error(`❌ NWC payment to ${recipientData.name || recipientData.address} threw error:`, paymentError);
            throw new Error(`Payment to ${recipientData.name || recipientData.address} error: ${paymentError instanceof Error ? paymentError.message : String(paymentError)}`);
          }
        });
        
        const errors: string[] = [];
        
        // Process all payments in parallel for maximum speed
        if (usingBridge) {
          console.log(`🌉 BRIDGE MODE: Processing ${paymentPromises.length} payments in PARALLEL via Alby Hub`);
        } else {
          console.log('⚡ Processing direct payments in parallel');
        }
        
        const paymentResults = await Promise.allSettled(paymentPromises);
        
        paymentResults.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value) {
            results.push(result.value);
            if (usingBridge) {
              console.log(`✅ BRIDGE [${index + 1}/${paymentPromises.length}]: ${result.value.recipient} payment completed`);
            }
          } else if (result.status === 'rejected') {
            const errorMsg = result.reason.message || String(result.reason);
            errors.push(errorMsg);
            if (usingBridge) {
              console.error(`❌ BRIDGE [${index + 1}/${paymentPromises.length}]: ${errorMsg}`);
            }
          }
        });
        
        if (errors.length > 0) {
          console.error(usingBridge ? '❌ Bridge parallel payments had errors:' : '❌ Direct payments had errors:', errors);
        }
        
        // Report NWC results
        if (results.length > 0) {
          console.log(`✅ Bitcoin Connect NWC payments - ${results.length}/${paymentsToMake.length} successful:`, results);
          if (errors.length > 0) {
            console.warn(`⚠️ Some NWC payments failed:`, errors);
          }
          
          // Create Nostr boost note if boosts are enabled and we have successful payments
          if (enableBoosts && boostMetadata && results.length > 0) {
            try {
              await handleBoostCreation(results, amount);
            } catch (boostError) {
              console.warn('⚠️ Boost creation failed but payments succeeded:', boostError);
            }
          }
          
          onSuccess?.(results);
        } else if (errors.length > 0) {
          // All payments failed
          console.error('❌ All NWC payments failed:', errors);
          throw new Error(`All NWC payments failed: ${errors.join(', ')}`);
        }
        
      } else if (weblnAvailable && webln.keysend) {
        console.log(`⚡ Bitcoin Connect WebLN keysend: ${amount} sats split among recipients for "${description}"`);
        
        // Separate recipients by type: node keys vs Lightning addresses
        const nodeRecipients = paymentsToMake.filter(r => r.type === 'node' || (r.address && r.address.length === 66 && !r.address.includes('@')));
        const lnAddressRecipients = paymentsToMake.filter(r => r.type === 'lnaddress' || (r.address && r.address.includes('@')));
        
        console.log(`🔍 Payment types: ${nodeRecipients.length} node keysend, ${lnAddressRecipients.length} Lightning addresses`);
        
        // Process all payments in parallel for speed
        const paymentPromises = paymentsToMake.map(async (recipientData) => {
          // Calculate amount: use fixed amount if specified, otherwise proportional split
          const recipientAmount = (recipientData as any).fixedAmount || Math.floor((amount * recipientData.split) / totalSplit);
          
          if (recipientAmount <= 0) {
            console.log(`⏭️ Skipping ${recipientData.name || recipientData.address} - calculated amount is 0 sats`);
            return null;
          }
          
          // Skip known offline nodes temporarily 
          if (recipientData.address === '035ad2c954e264004986da2d9499e1732e5175e1dcef2453c921c6cdcc3536e9d8') {
            console.log(`⏭️ Skipping ${recipientData.name || recipientData.address} - node temporarily offline`);
            return null;
          }
          
          console.log(`⚡ Sending ${recipientAmount} sats to ${recipientData.name || recipientData.address.slice(0, 10)}... (${recipientData.split}/${totalSplit} split)`);
          
          try {
            // Handle different payment types
            if (recipientData.type === 'node' || (recipientData.address && recipientData.address.length === 66 && !recipientData.address.includes('@'))) {
              // Use keysend for node public keys
              const customRecords = await createWebLNCustomRecords(recipientData.name || 'Recipient');
              
              // DEBUG: Log WebLN keysend data for Sovereign Feeds
              if (recipientData.name === 'Sovereign Feeds') {
                console.log('🔍 WEBLN SOVEREIGN FEEDS DEBUG:', {
                  recipient: recipientData.name,
                  pubkey: recipientData.address,
                  amount: recipientAmount,
                  customRecordKeys: Object.keys(customRecords),
                  customRecordsData: Object.fromEntries(
                    Object.entries(customRecords).map(([key, value]) => [
                      key,
                      {
                        length: value.length,
                        decoded: (() => {
                          try {
                            return JSON.parse(Buffer.from(value, 'hex').toString('utf8'));
                          } catch {
                            return Buffer.from(value, 'hex').toString('utf8');
                          }
                        })()
                      }
                    ])
                  )
                });
              }
              
              const response = await webln.keysend({
                destination: recipientData.address,
                amount: recipientAmount, // Send in sats - Alby might expect sats not millisats
                customRecords
              });
              
              console.log(`💰 Payment sent: ${recipientAmount} sats to ${recipientData.address}`);
              console.log(`✅ Payment to ${recipientData.name || recipientData.address} successful:`, response);
              return { recipient: recipientData.name || recipientData.address, amount: recipientAmount, response };
              
            } else if (recipientData.type === 'lnaddress' || (recipientData.address && recipientData.address.includes('@'))) {
              // For Lightning addresses, resolve to an invoice first, then pay
              console.log(`🔗 Resolving Lightning address to invoice: ${recipientData.address}`);
              
              const { LNURLService } = await import('../lib/lnurl-service');
              const amountMillisats = recipientAmount * 1000; // Convert sats to millisats
              const comment = `Boost for "${description}" by ${recipientData.name || 'Unknown'}`;
              
              const invoice = await LNURLService.getPaymentInvoice(
                recipientData.address,
                amountMillisats,
                comment
              );
              
              console.log(`💳 Got invoice for ${recipientData.address}, paying with WebLN`);
              
              const response = await webln.sendPayment(invoice);
              
              console.log(`💰 Payment sent: ${recipientAmount} sats to ${recipientData.address}`);
              console.log(`✅ Payment to ${recipientData.name || recipientData.address} successful:`, response);
              return { recipient: recipientData.name || recipientData.address, amount: recipientAmount, response };
              
            } else {
              throw new Error(`Unknown recipient type for ${recipientData.address}`);
            }
          } catch (paymentError) {
            console.error(`❌ Payment to ${recipientData.name || recipientData.address} threw error:`, paymentError);
            throw new Error(`Payment to ${recipientData.name || recipientData.address} error: ${paymentError instanceof Error ? paymentError.message : String(paymentError)}`);
          }
        });
        
        // Wait for all payments to complete (in parallel)
        const paymentResults = await Promise.allSettled(paymentPromises);
        const errors: string[] = [];
        
        paymentResults.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value) {
            results.push(result.value);
          } else if (result.status === 'rejected') {
            errors.push(result.reason.message || String(result.reason));
          }
        });
        
        // Report results
        if (results.length > 0) {
          console.log(`✅ Bitcoin Connect WebLN payments - ${results.length}/${paymentsToMake.length} successful:`, results);
          if (errors.length > 0) {
            console.warn(`⚠️ Some payments failed:`, errors);
          }
          
          // Create Nostr boost note if boosts are enabled and we have successful payments
          if (enableBoosts && boostMetadata && results.length > 0) {
            try {
              await handleBoostCreation(results, amount);
            } catch (boostError) {
              console.warn('⚠️ Boost creation failed but payments succeeded:', boostError);
            }
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
                let response;
                
                // Handle different payment types for NWC
                if (recipientData.type === 'lnaddress' || (recipientData.address && recipientData.address.includes('@'))) {
                  // For Lightning addresses, resolve to invoice and pay
                  console.log(`🔗 NWC fallback resolving Lightning address: ${recipientData.address}`);
                  const comment = `Boost for "${description}" by ${recipientData.name || 'Unknown'}`;
                  
                  response = await nwcService.payLightningAddress(
                    recipientData.address,
                    recipientAmount,
                    comment
                  );
                } else {
                  // For node public keys, use keysend with TLV records
                  console.log(`⚡ NWC fallback sending keysend to node: ${recipientData.address}`);
                  const tlvRecords = await createBoostTLVRecords(recipientData.name || 'Recipient');
                  
                  // Direct keysend payment (fallback)
                  console.log('⚡ Using direct keysend payment (fallback)');
                  response = await nwcService.payKeysend(
                    recipientData.address,
                    recipientAmount,
                    tlvRecords
                  );
                }
                
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
            
            // Create Nostr boost note if boosts are enabled and we have successful payments
            if (enableBoosts && boostMetadata && results.length > 0) {
              try {
                await handleBoostCreation(results, amount);
              } catch (boostError) {
                console.warn('⚠️ Boost creation failed but payments succeeded:', boostError);
              }
            }
            
            onSuccess?.(results);
          } else if (errors.length > 0) {
            console.error('❌ All payments failed:', errors);
            throw new Error(`All payments failed: ${errors.join(', ')}`);
          }
        } else {
          // Check if we're trying to pay Lightning Addresses with only Breez connected
          if (hasLightningAddress && breez.isConnected) {
            throw new Error('Breez SDK has strict LNURL validation that may not work with all Lightning Address providers. Please connect an NWC wallet (like Alby Hub) for best Lightning Address compatibility.');
          }
          throw new Error('No wallet connection available');
        }
      }
      
    } catch (error) {
      console.error('❌ Payment failed:', error);
      console.error('❌ Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        errorType: typeof error,
        fullError: error
      });
      const errorMessage = error instanceof Error ? error.message : 'Payment failed';
      onError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Don't render anything if Lightning is disabled
  if (!isLightningEnabled) {
    return null;
  }

  if (!mounted) {
    return (
      <button className={`flex items-center gap-2 px-4 py-2 bg-yellow-500/50 text-black font-semibold rounded-lg animate-pulse ${className}`}>
        Loading...
      </button>
    );
  }

  // Debug logging for button state
  console.log('🔍 BitcoinConnectPayment render state:', {
    loading,
    isConnected,
    breezConnected: breez.isConnected,
    isActuallyConnected,
    connectedWalletType,
    disabled: loading || !isActuallyConnected,
    buttonText: loading ? 'Processing...' : 
                !isActuallyConnected ? 'Connect Wallet First' : 
                `Send ${amount} sats`
  });

  return (
    <button
      key={`boost-button-${renderKey}-${isActuallyConnected}`}
      onClick={handlePayment}
      disabled={loading || !isActuallyConnected}
      className={`flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-600 disabled:text-gray-400 text-black font-semibold rounded-lg transition-colors ${className}`}
    >
      <Zap className="w-4 h-4" />
      <span>
        {loading ? 'Processing...' : 
         !isActuallyConnected ? 'Connect Wallet First' : 
         `Send ${amount} sats`}
      </span>
    </button>
  );
}