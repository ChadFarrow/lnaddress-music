/**
 * Utility functions for Lightning payments
 */

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
 * Create TLV records for Lightning boost payments (matching manual boost format)
 */
function createBoostTLVRecords(metadata: BoostMetadata, recipientName?: string, amount?: number) {
  const records: { [key: string]: string } = {};

  // Use the same format as manual boosts from BitcoinConnect component
  // 7629169 - Podcast metadata JSON (bLIP-10 standard - Breez/Fountain compatible)
  const podcastMetadata = {
    podcast: metadata.artist || 'Unknown Artist',
    episode: metadata.title || 'Unknown Title',
    action: 'boost',
    app_name: metadata.appName || 'ITDV Lightning',
    // Use main podcast feed URL like manual boosts
    feed: 'https://www.doerfelverse.com/feeds/intothedoerfelverse.xml',
    url: 'https://www.doerfelverse.com/feeds/intothedoerfelverse.xml',
    message: metadata.message || '',
    ...(metadata.timestamp && { ts: metadata.timestamp }),
    // Use numeric feedID like manual boosts  
    feedID: "6590182",
    // Add episode_guid for proper identification
    ...(metadata.itemGuid && { episode_guid: metadata.itemGuid }),
    ...(metadata.album && { album: metadata.album }),
    ...(amount && { value_msat_total: amount * 1000 }),
    sender_name: metadata.senderName || 'Anonymous',
    uuid: `boost-${Date.now()}-${Math.floor(Math.random() * 1000)}`, // Unique identifier
    app_version: '1.0.0', // App version
    ...(amount && { value_msat: amount * 1000 }), // Individual payment amount
    name: 'ITDV Lightning' // App/service name
  };
  
  // Convert to hex format like manual boosts, then back to string for WebLN
  const podcastMetadataHex = Buffer.from(JSON.stringify(podcastMetadata), 'utf8').toString('hex');
  records['7629169'] = Buffer.from(podcastMetadataHex, 'hex').toString('utf8');
  
  // 7629171 - Tip note/message (Lightning spec compliant) - only if custom message provided
  if (metadata.message) {
    const messageHex = Buffer.from(metadata.message, 'utf8').toString('hex');
    records['7629171'] = Buffer.from(messageHex, 'hex').toString('utf8');
  }
  
  // 133773310 - Sphinx compatibility (JSON encoded data)
  const sphinxData = {
    podcast: metadata.artist || 'Unknown Artist',
    episode: metadata.title || 'Unknown Title', 
    action: 'boost',
    app: metadata.appName || 'ITDV Lightning',
    message: metadata.message || '',
    ...(amount && { amount: amount }),
    sender: metadata.senderName || 'Anonymous',
    ...(metadata.timestamp && { timestamp: metadata.timestamp })
  };
  
  const sphinxDataHex = Buffer.from(JSON.stringify(sphinxData), 'utf8').toString('hex');
  records['133773310'] = Buffer.from(sphinxDataHex, 'hex').toString('utf8');

  return records;
}

/**
 * Make a Lightning payment using WebLN
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
    console.log('🚀 Starting auto boost payment:', {
      amount,
      description,
      recipients: recipients?.length || 0,
      fallbackRecipient
    });

    // Check if WebLN is available
    const weblnExists = !!(window as any).webln;
    const weblnEnabled = weblnExists && !!(window as any).webln?.enabled;
    
    if (!weblnExists) {
      throw new Error('WebLN not available');
    }

    const webln = (window as any).webln;

    // Ensure WebLN is enabled
    if (!weblnEnabled) {
      await webln.enable();
    }

    // Determine payments to make
    let paymentsToMake: PaymentRecipient[] = [];
    
    if (recipients && recipients.length > 0) {
      paymentsToMake = recipients.filter(r => r.address && (r.split > 0 || r.fixedAmount));
      console.log(`💰 Using ${paymentsToMake.length} recipients (including fixed amounts)`);
    }

    // Fallback to single recipient if no valid recipients
    if (paymentsToMake.length === 0) {
      paymentsToMake = [{
        address: fallbackRecipient,
        split: 100,
        name: 'Default',
        type: 'node'
      }];
      console.log('💰 Using fallback single recipient');
    }

    const totalSplit = paymentsToMake.reduce((sum, r) => sum + r.split, 0);
    const results: any[] = [];

    // Check if we can use keysend (for node addresses)
    const hasKeysend = typeof webln.keysend === 'function';
    
    if (hasKeysend) {
      console.log('💡 Using keysend for auto boost payments');
      
      const paymentPromises = paymentsToMake.map(async (recipientData) => {
        const recipientAmount = (recipientData as any).fixedAmount || Math.floor((amount * recipientData.split) / totalSplit);
        
        console.log(`💰 Sending ${recipientAmount} sats to ${recipientData.name || recipientData.address}`);
        
        // Create TLV records for boost metadata
        const customRecords = boostMetadata ? createBoostTLVRecords(boostMetadata, recipientData.name, recipientAmount) : {};
        
        try {
          const response = await webln.keysend({
            destination: recipientData.address,
            amount: recipientAmount,
            customRecords
          });
          
          console.log(`✅ Auto boost payment successful: ${recipientAmount} sats to ${recipientData.name || recipientData.address}`);
          return { recipient: recipientData.name || recipientData.address, amount: recipientAmount, response };
        } catch (error) {
          console.error(`❌ Auto boost payment failed to ${recipientData.name || recipientData.address}:`, error);
          throw error;
        }
      });

      const paymentResults = await Promise.allSettled(paymentPromises);
      const errors: string[] = [];
      
      paymentResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          const recipientName = paymentsToMake[index].name || paymentsToMake[index].address;
          errors.push(`Payment to ${recipientName} failed: ${result.reason?.message || 'Unknown error'}`);
        }
      });

      if (errors.length > 0) {
        console.warn('Some auto boost payments failed:', errors);
      }

      if (results.length > 0) {
        console.log(`✅ Auto boost completed: ${results.length}/${paymentsToMake.length} payments successful`);
        return { success: true, results };
      } else {
        throw new Error('All auto boost payments failed');
      }
    } else {
      throw new Error('Keysend not available for auto boost payments');
    }

  } catch (error) {
    console.error('Auto boost payment failed:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Auto boost payment failed'
    };
  }
}