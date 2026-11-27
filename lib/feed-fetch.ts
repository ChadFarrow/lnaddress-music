/**
 * Server-side fetch for feed URLs: every RSS feed that `lib/rss-parser.ts`
 * reads. Treat each URL as untrusted. A podroll walk follows whatever
 * `<podcast:remoteItem feedUrl>` another feed names, an album's
 * `<podcast:publisher>` names the publisher feed to read next, and an admin can
 * add any URL to `data/feeds.json`.
 *
 * Three limits, and each one closes a hole the plain `fetch(feedUrl)` had:
 *
 * - **Address guard.** `safeFetch` (lib/safe-fetch.ts) refuses loopback,
 *   RFC 1918, link-local, cloud metadata and the other special-use ranges, in
 *   every spelling, on every redirect hop, and again on each address DNS
 *   returns. It also forces `cache: 'no-store'`, so Next's data cache cannot
 *   read a body around the size cap.
 * - **Time limit.** One `AbortSignal.timeout` covers the connection, every
 *   redirect and the body, so a server that drips one byte a second cannot
 *   hold a function open.
 * - **Size limit.** `readCappedText` (lib/capped-body.ts) counts bytes as they
 *   arrive and stops past the cap; a missing or lying Content-Length does not
 *   help.
 *
 * `safe-fetch.ts` and `capped-body.ts` are the PC20-Nostr catalog recipe
 * `safe-feed-fetch` (boostmebitch 815c551f, MIT), byte-identical, and the same
 * bytes as in ITDV-Lightning. Keep them that way, so a fix there can be copied
 * over. Their tests are in `test/feed-fetch.test.ts`.
 *
 * Server only: safe-fetch imports `node:dns/promises`. Nothing in a browser
 * bundle may import this file, or `lib/rss-parser.ts`, other than for types.
 */
import { safeFetch } from './safe-fetch';
import { readCappedText } from './capped-body';
import { USER_AGENT } from './user-agent.js';

/** Per request, redirects and body included. Real feeds answer in well under 2 s. */
export const FEED_TIMEOUT_MS = 10_000;
/** Larger than any real RSS feed (the biggest in data/feeds.json is well under 1 MB). */
export const FEED_MAX_BYTES = 8 * 1024 * 1024;

export type FeedFetchReason = 'refused' | 'timeout' | 'too-large' | 'http' | 'network';

/**
 * Why a fetch failed. `reason` lets a caller decide whether to retry: a refused
 * address or an oversized body will not get better on a second try.
 * The message can name the host; it is for logs, not for an HTTP answer.
 */
export class FeedFetchError extends Error {
  readonly reason: FeedFetchReason;
  readonly status?: number;

  constructor(message: string, reason: FeedFetchReason, status?: number) {
    super(message);
    this.name = 'FeedFetchError';
    this.reason = reason;
    this.status = status;
  }
}

function classify(error: unknown): FeedFetchError {
  if (error instanceof FeedFetchError) return error;
  const e = error as { name?: string; message?: string; cause?: { name?: string } } | undefined;
  const message = String(e?.message ?? error);
  // The two vendored files throw plain Errors with these fixed prefixes;
  // test/feed-fetch.test.ts pins both, so a change there fails the tests.
  if (message.startsWith('unsafe fetch url')) return new FeedFetchError(message, 'refused');
  if (message.startsWith('response too large')) return new FeedFetchError(message, 'too-large');
  // AbortSignal.timeout rejects with a DOMException named TimeoutError; undici
  // can wrap it as the cause of a TypeError while the body is streaming.
  if (e?.name === 'TimeoutError' || e?.name === 'AbortError' || e?.cause?.name === 'TimeoutError') {
    return new FeedFetchError('feed fetch timed out', 'timeout');
  }
  return new FeedFetchError(message, 'network');
}

export interface FeedFetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
}

/**
 * Fetch an untrusted feed URL and return its body as text, inside all three
 * limits. Throws a {@link FeedFetchError} for a refused address, a timeout, an
 * oversized body, a non-2xx answer or a network failure.
 */
export async function fetchUntrustedText(url: string, options: FeedFetchOptions = {}): Promise<string> {
  const { timeoutMs = FEED_TIMEOUT_MS, maxBytes = FEED_MAX_BYTES } = options;

  let res: Response;
  try {
    res = await safeFetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
      },
    });
  } catch (error) {
    throw classify(error);
  }

  if (!res.ok) {
    // Release the socket; the body of an error page is not needed.
    await res.body?.cancel().catch(() => {});
    throw new FeedFetchError(`feed answered ${res.status}`, 'http', res.status);
  }

  try {
    return await readCappedText(res, maxBytes);
  } catch (error) {
    throw classify(error);
  }
}
