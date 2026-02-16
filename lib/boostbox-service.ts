/**
 * BoostBox API client for storing boost metadata
 * https://github.com/noblepayne/boostbox
 *
 * When configured, POSTs boost metadata before each payment and returns
 * a description string to embed in the Lightning invoice comment.
 * When not configured, all calls are no-ops.
 */

const BOOSTBOX_URL = process.env.NEXT_PUBLIC_BOOSTBOX_URL || 'https://boostbox.cloud';
const BOOSTBOX_API_KEY = process.env.NEXT_PUBLIC_BOOSTBOX_API_KEY || 'v4v4me';

interface BoostBoxResponse {
  id: string;
  url: string;
  desc: string;
}

interface BoostBoxStoreParams {
  action: 'boost' | 'stream';
  recipient: {
    address: string;
    name?: string;
    split: number;
  };
  amount: number;
  totalAmount: number;
  senderName?: string;
  message?: string;
  track?: {
    title?: string;
    guid?: string;
    feedGuid?: string;
    feedUrl?: string;
    artist?: string;
    publisherGuid?: string;
  } | null;
  album?: string | null;
  appName?: string;
}

export function isConfigured(): boolean {
  return !!BOOSTBOX_URL;
}

/**
 * Store boost metadata in BoostBox.
 * Returns the response with id, url, and desc fields.
 */
export async function storeBoost(params: BoostBoxStoreParams): Promise<BoostBoxResponse> {
  if (!BOOSTBOX_URL) {
    throw new Error('BoostBox not configured');
  }

  const body: Record<string, unknown> = {
    action: params.action,
    split: params.recipient.split,
    value_msat: params.amount * 1000,
    value_msat_total: params.totalAmount * 1000,
    timestamp: new Date().toISOString(),
  };

  if (params.message) body.message = params.message;
  if (params.senderName) body.sender_name = params.senderName;
  if (params.recipient.name) body.recipient_name = params.recipient.name;
  if (params.recipient.address) body.recipient_address = params.recipient.address;
  if (params.track?.feedGuid) body.feed_guid = params.track.feedGuid;
  if (params.track?.title) body.item_title = params.track.title;
  if (params.track?.guid) body.item_guid = params.track.guid;
  if (params.track?.artist) body.feed_title = params.track.artist;
  if (params.track?.publisherGuid) body.publisher_guid = params.track.publisherGuid;
  if (params.appName) body.app_name = params.appName;

  const res = await fetch(`${BOOSTBOX_URL}/boost`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': BOOSTBOX_API_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`BoostBox POST failed: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

/**
 * Retrieve boost metadata by ID.
 */
export async function getBoost(id: string): Promise<Record<string, unknown>> {
  if (!BOOSTBOX_URL) {
    throw new Error('BoostBox not configured');
  }

  const res = await fetch(`${BOOSTBOX_URL}/boost/${id}`, {
    headers: { 'X-Api-Key': BOOSTBOX_API_KEY },
  });

  if (!res.ok) {
    throw new Error(`BoostBox GET failed: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

/**
 * Check BoostBox health.
 */
export async function healthCheck(): Promise<boolean> {
  if (!BOOSTBOX_URL) return false;

  try {
    const res = await fetch(`${BOOSTBOX_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Try to store boost metadata in BoostBox. Returns the `desc` string
 * to use as the invoice comment, or null if BoostBox is not configured
 * or the call fails. Never throws — payment flow is never blocked.
 */
export async function tryStoreBoostBox(params: BoostBoxStoreParams): Promise<string | null> {
  if (!isConfigured()) return null;

  try {
    const result = await storeBoost(params);
    console.log('📦 BoostBox stored:', result.url);
    return result.desc;
  } catch (error) {
    console.warn('⚠️ BoostBox storage failed (payment will proceed normally):', error);
    return null;
  }
}
