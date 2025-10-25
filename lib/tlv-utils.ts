/**
 * TLV (Type-Length-Value) Record Utilities
 * For creating Lightning payment records compatible with podcast 2.0 boosts
 */

import { TLV_TYPES, FEED_IDS } from './constants';

export interface BoostRecipient {
  address?: string;
  customKey?: string;
  customValue?: string;
  split?: number;
  name?: string;
  feedId?: string;
}

export interface BoostTLVOptions {
  recipients: BoostRecipient[];
  action: 'boost' | 'stream';
  amount: number;
  message?: string;
  senderName?: string;
  podcastTitle?: string;
  episodeTitle?: string;
  feedId?: string;
  timestamp?: number;
  itemId?: string;
  appName?: string;
  appVersion?: string;
  valueTimeSent?: string;
  remoteFeedGuid?: string;
  remoteItemGuid?: string;
}

/**
 * Creates TLV records for a podcast boost payment
 * Consolidated from multiple implementations in the codebase
 */
export function createBoostTLVRecords(options: BoostTLVOptions): Record<string, string> {
  const {
    recipients,
    action,
    amount,
    message = '',
    senderName = 'Anonymous',
    podcastTitle = '',
    episodeTitle = '',
    feedId = '',
    timestamp = 0,
    itemId = '',
    appName = 'Music Platform',
    appVersion = '1.0',
    valueTimeSent,
    remoteFeedGuid,
    remoteItemGuid,
  } = options;

  const records: Record<string, string> = {};

  // Standard podcast boost record (TLV 7629169)
  const boostData = {
    action,
    amount,
    app_name: appName,
    app_version: appVersion,
    boost_link: '',
    episode: episodeTitle,
    episode_guid: itemId,
    feedId: feedId ? parseInt(feedId) : undefined,
    guid: itemId,
    message,
    name: senderName,
    podcast: podcastTitle,
    pubkey: '',
    sender_name: senderName,
    sig_fields: '',
    time: timestamp ? timestamp.toString() : '',
    ts: timestamp,
    url: '',
    value_msat: amount,
    value_msat_total: amount,
    ...(valueTimeSent && { value_time_sent: valueTimeSent }),
    ...(remoteFeedGuid && { remote_feed_guid: remoteFeedGuid }),
    ...(remoteItemGuid && { remote_item_guid: remoteItemGuid }),
  };

  records[TLV_TYPES.PODCAST_BOOST.toString()] = JSON.stringify(boostData);

  // Tip note record (TLV 7629171)
  if (message) {
    records[TLV_TYPES.TIP_NOTE.toString()] = message;
  }

  // Sphinx compatibility record (TLV 133773310)
  const sphinxData = {
    feedID: feedId ? parseInt(feedId) : undefined,
    itemID: itemId,
    ts: timestamp,
    ...(message && { message }),
    ...(senderName && { sender_name: senderName }),
  };
  records[TLV_TYPES.SPHINX_COMPAT.toString()] = JSON.stringify(sphinxData);

  return records;
}

/**
 * Extracts payment recipients from a track or album
 * Handles value blocks and lightning addresses
 */
export function extractPaymentRecipients(item: {
  value?: {
    destinations?: Array<{
      address?: string;
      customKey?: string;
      customValue?: string;
      split?: number;
      name?: string;
      fee?: boolean;
    }>;
  };
  lnAddress?: string;
  artist?: string;
}): BoostRecipient[] {
  const recipients: BoostRecipient[] = [];

  // Extract from value block destinations (excluding fee destinations)
  if (item.value?.destinations) {
    const valueRecipients = item.value.destinations
      .filter(dest => !dest.fee)
      .map(dest => ({
        address: dest.address,
        customKey: dest.customKey,
        customValue: dest.customValue,
        split: dest.split || 100,
        name: dest.name,
      }));
    recipients.push(...valueRecipients);
  }

  // Fallback to direct lightning address if no value block
  if (recipients.length === 0 && item.lnAddress) {
    recipients.push({
      address: item.lnAddress,
      split: 100,
      name: item.artist || 'Artist',
    });
  }

  return recipients;
}

/**
 * Validates that all recipients have valid payment information
 */
export function validateRecipients(recipients: BoostRecipient[]): boolean {
  if (recipients.length === 0) return false;

  return recipients.every(recipient => {
    // Must have either a Lightning address or custom key/value pair
    return recipient.address || (recipient.customKey && recipient.customValue);
  });
}

/**
 * Calculates split amounts for multiple recipients
 */
export function calculateSplitAmounts(
  totalAmount: number,
  recipients: BoostRecipient[]
): Array<{ recipient: BoostRecipient; amount: number }> {
  const totalSplit = recipients.reduce((sum, r) => sum + (r.split || 0), 0);

  return recipients.map(recipient => ({
    recipient,
    amount: Math.round((totalAmount * (recipient.split || 0)) / totalSplit),
  }));
}
