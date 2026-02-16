/**
 * Utility functions for Lightning payments
 */

import { TLV_TYPES } from '@/lib/constants';

interface PaymentRecipient {
  address: string;
  split: number;
  name?: string;
  fee?: boolean;
  type?: string;
  fixedAmount?: number;
}

interface BoostMetadata {
  title?: string;
  artist?: string;
  album?: string;
  imageUrl?: string;
  podcastFeedGuid?: string;
  podcastGuid?: string;
  episode?: string;
  feedUrl?: string;
  itemGuid?: string;
  timestamp?: number;
  senderName?: string;
  appName?: string;
  url?: string;
  publisherGuid?: string;
  publisherUrl?: string;
  message?: string;
}

/**
 * Create basic TLV records for Lightning boost payments
 * Returns array format compatible with NWC system
 */
function createBoostTLVRecords(metadata: BoostMetadata, recipientName?: string, amount?: number) {
  const tlvRecords = [];

  // Basic boost metadata (Podcasting 2.0 compatible)
  const boostMetadata = {
    podcast: metadata.artist || 'Unknown Artist',
    episode: metadata.title || 'Unknown Title',
    action: 'boost',
    app_name: metadata.appName || 'lnaddress music',
    ...(metadata.feedUrl && { feed: metadata.feedUrl }),
    ...(metadata.message && { message: metadata.message }),
    ...(metadata.timestamp && { ts: metadata.timestamp }),
    ...(metadata.album && { album: metadata.album }),
    ...(amount && { value_msat: amount * 1000 }),
    sender_name: metadata.senderName || 'Anonymous'
  };

  console.log('🔍 Boost TLV data:', JSON.stringify(boostMetadata, null, 2));

  // Podcast boost metadata (bLIP-10 standard)
  tlvRecords.push({
    type: TLV_TYPES.PODCAST_BOOST,
    value: Buffer.from(JSON.stringify(boostMetadata), 'utf8').toString('hex')
  });

  // Message (if provided)
  if (metadata.message) {
    tlvRecords.push({
      type: TLV_TYPES.TIP_NOTE,
      value: Buffer.from(metadata.message, 'utf8').toString('hex')
    });
  }

  return tlvRecords;
}

/**
 * Make a Lightning payment using available payment methods (WebLN, NWC bridge, etc.)
 * This function replicates the payment logic from BitcoinConnect component for auto boost
 */
export async function makeAutoBoostPayment({
  amount,
  description,
  recipients,
  fallbackRecipient,
  boostMetadata,
}: {
  amount: number;
  description: string;
  recipients?: PaymentRecipient[];
  fallbackRecipient: string;
  boostMetadata?: BoostMetadata;
}): Promise<{ success: boolean; results?: any[]; error?: string }> {
  try {
    console.log('💡 AUTO BOOST: Using UPDATED makeAutoBoostPayment function (v3 - with Breez support)');
    console.log('🚀 Starting auto boost payment:', {
      amount,
      description,
      recipients: recipients?.length || 0,
      fallbackRecipient
    });

    // Import services dynamically
    const { getNWCService } = await import('@/lib/nwc-service');
    const { getBreezService } = await import('@/lib/breez-service');

    // Check connection state similar to BitcoinConnect
    const weblnExists = !!(window as any).webln;
    const weblnEnabled = weblnExists && !!(window as any).webln?.enabled;

    // Check for Breez connection
    const breezService = getBreezService();
    const hasBreezConnection = breezService.isConnected();

    // Check for NWC connection (same logic as BitcoinConnect component)
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
      // Fallback to individual keys if config is corrupted
      bcConnectorType = localStorage.getItem('bc:connectorType');
    }
    if (!nwcConnectionString) {
      nwcConnectionString = localStorage.getItem('nwc_connection_string');
    }

    const hasNWCConnection = !!nwcConnectionString;
    // Use NWC if we have a connection string, regardless of bcConnectorType
    // This matches how manual payments work in BitcoinConnect component
    const shouldUseNWC = hasNWCConnection;

    console.log('💡 AUTO BOOST: Payment method detection:', {
      weblnExists,
      weblnEnabled,
      hasNWCConnection,
      hasBreezConnection,
      bcConnectorType,
      shouldUseNWC,
      nwcConnectionExists: !!nwcConnectionString,
      nwcStringLength: nwcConnectionString?.length || 0
    });

    // Determine payments to make
    let paymentsToMake: PaymentRecipient[] = [];
    
    if (recipients && recipients.length > 0) {
      paymentsToMake = recipients.filter(r => r.address && (r.split > 0 || r.fixedAmount));
      console.log(`💰 Using ${paymentsToMake.length} recipients (including fixed amounts)`);
    }

    // No fallback - if no valid recipients, don't make payment
    if (paymentsToMake.length === 0) {
      console.log('⏭️  No valid payment recipients - skipping auto boost');
      throw new Error('No valid payment recipients configured');
    }

    const totalSplit = paymentsToMake.reduce((sum, r) => sum + r.split, 0);
    const results: any[] = [];

    // Use NWC if available and preferred (same logic as BitcoinConnect)
    if (shouldUseNWC && hasNWCConnection) {
      console.log('💡 AUTO BOOST: Using NWC for auto boost payments');
      console.log('💡 AUTO BOOST: NWC connection string length:', nwcConnectionString?.length);
      
      try {
        // Use NWC service directly for auto boost payments
        console.log('💡 AUTO BOOST: Using NWC service for payments...');
        const nwcService = getNWCService();

        // Initialize NWC if needed
        if (!nwcService.isConnected()) {
          console.log('💡 AUTO BOOST: Initializing NWC service...');
          await nwcService.connect(nwcConnectionString);
        }
        console.log('💡 AUTO BOOST: NWC ready for auto boost payments');

        const paymentPromises = paymentsToMake.map(async (recipientData) => {
          const recipientAmount = (recipientData as any).fixedAmount || Math.floor((amount * recipientData.split) / totalSplit);

          // Skip recipients with 0 sats (happens with small amounts and small splits)
          if (recipientAmount === 0) {
            console.log(`⏭️  Skipping ${recipientData.name || recipientData.address} - amount rounds to 0 sats`);
            throw new Error(`Amount too small for recipient (0 sats)`);
          }

          console.log(`💰 Auto boost sending ${recipientAmount} sats to ${recipientData.name || recipientData.address} (type: ${recipientData.type})`);

          let result;

          // BoostBox: store metadata and use returned description if available
          const { tryStoreBoostBox, saveBoostHistory } = await import('@/lib/boostbox-service');
          const boostboxResult = await tryStoreBoostBox({
            action: 'stream',
            recipient: { address: recipientData.address, name: recipientData.name, split: recipientData.split },
            amount: recipientAmount,
            totalAmount: amount,
            senderName: boostMetadata?.senderName,
            message: boostMetadata?.message,
            track: boostMetadata ? { title: boostMetadata.title, guid: boostMetadata.itemGuid, feedGuid: boostMetadata.podcastFeedGuid, feedUrl: boostMetadata.feedUrl, artist: boostMetadata.artist, publisherGuid: boostMetadata.publisherGuid } : undefined,
            album: boostMetadata?.album,
          });
          if (boostboxResult) {
            saveBoostHistory({
              url: boostboxResult.url,
              amount: recipientAmount,
              recipientName: recipientData.name || recipientData.address,
              trackTitle: boostMetadata?.title || 'Unknown',
              timestamp: new Date().toISOString(),
              action: 'stream',
            });
          }

          // Handle different recipient types
          if (recipientData.type === 'lnaddress') {
            // Pay to lightning address via LNURL
            console.log(`💡 AUTO BOOST: Paying to lightning address: ${recipientData.address}`);
            const { LNURLService } = await import('@/lib/lnurl-service');
            const amountMillisats = recipientAmount * 1000;
            const fallbackMessage = boostMetadata ? `${boostMetadata.senderName || 'Auto Boost'}: Boost for "${boostMetadata.title}"` : 'Auto Boost';
            const boostMessage = boostboxResult?.url
              ? `rss::payment::boost ${boostboxResult.url} ${fallbackMessage}`
              : fallbackMessage;
            const invoice = await LNURLService.getPaymentInvoice(recipientData.address, amountMillisats, boostMessage);
            result = await nwcService.payInvoice(invoice);
          } else {
            // Pay to node address via keysend (default)
            console.log(`💡 AUTO BOOST: Paying to node via keysend: ${recipientData.address}`);
            const tlvRecords = boostMetadata ? createBoostTLVRecords(boostMetadata, recipientData.name, recipientAmount) : undefined;
            result = await nwcService.payKeysend(
              recipientData.address,
              recipientAmount,
              tlvRecords
            );
          }

          if (result.error) {
            throw new Error(result.error);
          }

          console.log(`✅ Auto boost payment successful: ${recipientAmount} sats to ${recipientData.name || recipientData.address}`);
          return { recipient: recipientData.name || recipientData.address, amount: recipientAmount, preimage: result.preimage };
        });

        const paymentResults = await Promise.allSettled(paymentPromises);
        
        paymentResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            const recipientName = paymentsToMake[index].name || paymentsToMake[index].address;
            console.error(`❌ Auto boost payment failed to ${recipientName}:`, result.reason);
          }
        });

        if (results.length > 0) {
          console.log(`✅ Auto boost completed: ${results.length}/${paymentsToMake.length} payments successful`);
          return { success: true, results };
        } else {
          throw new Error('All NWC auto boost payments failed');
        }
        
      } catch (nwcError) {
        console.error('💡 AUTO BOOST: NWC auto boost failed, trying Breez/WebLN fallback:', nwcError);
        // Fall through to Breez or WebLN
      }
    } else {
      console.log('💡 AUTO BOOST: Skipping NWC - shouldUseNWC:', shouldUseNWC, 'hasNWCConnection:', hasNWCConnection);
    }

    // Try Breez if connected (before WebLN)
    if (hasBreezConnection) {
      console.log('💡 AUTO BOOST: Using Breez SDK for auto boost payments');

      try {
        const paymentPromises = paymentsToMake.map(async (recipientData) => {
          const recipientAmount = (recipientData as any).fixedAmount || Math.floor((amount * recipientData.split) / totalSplit);

          // Skip recipients with 0 sats (happens with small amounts and small splits)
          if (recipientAmount === 0) {
            console.log(`⏭️  Skipping ${recipientData.name || recipientData.address} - amount rounds to 0 sats`);
            throw new Error(`Amount too small for recipient (0 sats)`);
          }

          console.log(`💰 Breez auto boost sending ${recipientAmount} sats to ${recipientData.name || recipientData.address} (type: ${recipientData.type})`);

          // Breez only supports lightning addresses via LNURL, not node pubkeys
          if (recipientData.type !== 'lnaddress') {
            console.warn(`⚠️ Breez SDK does not support ${recipientData.type} payments, skipping ${recipientData.name}`);
            throw new Error(`Breez SDK does not support ${recipientData.type} payments`);
          }

          // BoostBox: store metadata and use returned description if available
          const { tryStoreBoostBox: tryStoreBreez, saveBoostHistory: saveBreezHistory } = await import('@/lib/boostbox-service');
          const breezBoostboxResult = await tryStoreBreez({
            action: 'stream',
            recipient: { address: recipientData.address, name: recipientData.name, split: recipientData.split },
            amount: recipientAmount,
            totalAmount: amount,
            senderName: boostMetadata?.senderName,
            message: boostMetadata?.message,
            track: boostMetadata ? { title: boostMetadata.title, guid: boostMetadata.itemGuid, feedGuid: boostMetadata.podcastFeedGuid, feedUrl: boostMetadata.feedUrl, artist: boostMetadata.artist, publisherGuid: boostMetadata.publisherGuid } : undefined,
            album: boostMetadata?.album,
          });
          if (breezBoostboxResult) {
            saveBreezHistory({
              url: breezBoostboxResult.url,
              amount: recipientAmount,
              recipientName: recipientData.name || recipientData.address,
              trackTitle: boostMetadata?.title || 'Unknown',
              timestamp: new Date().toISOString(),
              action: 'stream',
            });
          }

          // Pay to lightning address via LNURL
          const { LNURLService } = await import('@/lib/lnurl-service');
          const amountMillisats = recipientAmount * 1000;
          const fallbackMessage = boostMetadata ? `${boostMetadata.senderName || 'Auto Boost'}: Boost for "${boostMetadata.title}"` : 'Auto Boost';
          const boostMessage = breezBoostboxResult?.url
            ? `rss::payment::boost ${breezBoostboxResult.url} ${fallbackMessage}`
            : fallbackMessage;
          const invoice = await LNURLService.getPaymentInvoice(recipientData.address, amountMillisats, boostMessage);

          const payment = await breezService.sendPayment({
            destination: invoice,
            amountSats: recipientAmount,
            message: boostMessage
          });

          console.log(`✅ Breez auto boost payment successful: ${recipientAmount} sats to ${recipientData.name || recipientData.address}`);
          return { recipient: recipientData.name || recipientData.address, amount: recipientAmount, payment };
        });

        const paymentResults = await Promise.allSettled(paymentPromises);

        paymentResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            const recipientName = paymentsToMake[index].name || paymentsToMake[index].address;
            console.error(`❌ Breez auto boost payment failed to ${recipientName}:`, result.reason);
          }
        });

        if (results.length > 0) {
          console.log(`✅ Breez auto boost completed: ${results.length}/${paymentsToMake.length} payments successful`);
          return { success: true, results };
        } else {
          throw new Error('All Breez auto boost payments failed');
        }

      } catch (breezError) {
        console.error('💡 AUTO BOOST: Breez auto boost failed, trying WebLN fallback:', breezError);
        // Fall through to WebLN
      }
    } else {
      console.log('💡 AUTO BOOST: Skipping Breez - not connected');
    }

    // WebLN fallback (same as original logic)
    if (weblnExists) {
      console.log('💡 AUTO BOOST: Using WebLN for auto boost payments (fallback)');
      
      const webln = (window as any).webln;

      // Don't automatically prompt for WebLN - only use if already enabled
      if (!weblnEnabled) {
        console.log('⚠️ WebLN not enabled - skipping auto boost payment via WebLN');
        throw new Error('WebLN not enabled - cannot perform auto boost payment');
      }

      // Check if we can use keysend (for node addresses)
      const hasKeysend = typeof webln.keysend === 'function';
      
      if (hasKeysend) {
        const paymentPromises = paymentsToMake.map(async (recipientData) => {
          const recipientAmount = (recipientData as any).fixedAmount || Math.floor((amount * recipientData.split) / totalSplit);

          // Skip recipients with 0 sats (happens with small amounts and small splits)
          if (recipientAmount === 0) {
            console.log(`⏭️  Skipping ${recipientData.name || recipientData.address} - amount rounds to 0 sats`);
            throw new Error(`Amount too small for recipient (0 sats)`);
          }

          console.log(`💰 WebLN auto boost sending ${recipientAmount} sats to ${recipientData.name || recipientData.address}`);
          
          // Create TLV records for boost metadata
          const customRecords = boostMetadata ? createBoostTLVRecords(boostMetadata, recipientData.name, recipientAmount) : {};
          
          const response = await webln.keysend({
            destination: recipientData.address,
            amount: recipientAmount,
            customRecords
          });
          
          console.log(`✅ WebLN auto boost payment successful: ${recipientAmount} sats to ${recipientData.name || recipientData.address}`);
          return { recipient: recipientData.name || recipientData.address, amount: recipientAmount, response };
        });

        const paymentResults = await Promise.allSettled(paymentPromises);
        
        paymentResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            const recipientName = paymentsToMake[index].name || paymentsToMake[index].address;
            console.error(`❌ WebLN auto boost payment failed to ${recipientName}:`, result.reason);
          }
        });

        if (results.length > 0) {
          console.log(`✅ WebLN auto boost completed: ${results.length}/${paymentsToMake.length} payments successful`);
          return { success: true, results };
        } else {
          throw new Error('All WebLN auto boost payments failed');
        }
      } else {
        throw new Error('Keysend not available for auto boost payments');
      }
    } else {
      throw new Error('No payment method available for auto boost');
    }

  } catch (error) {
    console.error('Auto boost payment failed:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Auto boost payment failed'
    };
  }
}