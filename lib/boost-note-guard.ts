/**
 * Input checks for the server route that signs boost notes with the site's Nostr key
 * (app/api/nostr/boost-note). The route must not be an open signer: it signs only the
 * boost-note shape (lib/boost-note.ts), only for items in the site's own catalog, and
 * only at a limited rate. test/boost-note-guard.test.ts pins the rules.
 *
 * What these checks cannot do: prove that a Lightning payment happened. The payment
 * paths pay from the browser (NWC, Breez, WebLN, keysend), so the server never sees a
 * proof it could verify. Anyone can still ask for a note about a catalog item with a
 * comment of their own, within the limits below.
 */
import type { BoostNoteInput, BoostNoteTrack } from './boost-note';

export const BOOST_NOTE_LIMITS = {
  maxAmount: 10_000_000, // sats
  maxComment: 600, // the user's message is at most 144 chars; generated messages add titles
  maxText: 300, // title, artist, album
  maxGuid: 200,
  maxUrl: 2048,
  maxBodyBytes: 16_384
} as const;

export interface BoostCatalog {
  feedGuids: Set<string>;
  itemGuids: Set<string>;
  publisherGuids: Set<string>;
  imageUrls: Set<string>;
}

export type BoostNoteValidation =
  | { ok: true; input: BoostNoteInput }
  | { ok: false; status: 400 | 403; error: string };

const isObject = (v: unknown): v is Record<string, any> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const addString = (set: Set<string>, v: unknown) => {
  if (typeof v === 'string' && v) set.add(v);
};

/** Collect the GUIDs and images of data/parsed-feeds.json and data/feeds.json. */
export function buildBoostCatalog(parsedFeeds: unknown, feedsJson?: unknown): BoostCatalog {
  const catalog: BoostCatalog = {
    feedGuids: new Set(),
    itemGuids: new Set(),
    publisherGuids: new Set(),
    imageUrls: new Set()
  };
  const feedList = (src: unknown): any[] =>
    isObject(src) && Array.isArray(src.feeds) ? src.feeds : Array.isArray(src) ? src : [];

  for (const feed of feedList(parsedFeeds)) {
    if (!isObject(feed)) continue;
    addString(catalog.feedGuids, feed.podcastGuid);
    const album = isObject(feed.parsedData) ? feed.parsedData.album : undefined;
    if (!isObject(album)) continue;
    addString(catalog.feedGuids, album.feedGuid);
    addString(catalog.publisherGuids, album.publisherGuid);
    for (const img of [album.coverArt, album.imageUrl, album.publisherImage]) addString(catalog.imageUrls, img);
    for (const track of Array.isArray(album.tracks) ? album.tracks : []) {
      if (!isObject(track)) continue;
      addString(catalog.itemGuids, track.guid);
      addString(catalog.feedGuids, track.feedGuid);
      for (const img of [track.image, track.imageUrl]) addString(catalog.imageUrls, img);
    }
  }
  for (const feed of feedList(feedsJson)) {
    if (isObject(feed)) addString(catalog.feedGuids, feed.podcastGuid);
  }
  return catalog;
}

function optionalString(v: unknown, max: number): string | undefined | false {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v !== 'string' || v.length > max) return false;
  return v;
}

function parseAmount(v: unknown): number | null {
  let n: number;
  if (typeof v === 'number') n = v;
  else if (typeof v === 'string' && /^\d{1,9}$/.test(v)) n = Number(v);
  else return null;
  if (!Number.isInteger(n) || n < 0 || n > BOOST_NOTE_LIMITS.maxAmount) return null;
  return n;
}

export function validateBoostNoteRequest(body: unknown, catalog: BoostCatalog): BoostNoteValidation {
  const bad = (error: string): BoostNoteValidation => ({ ok: false, status: 400, error });
  const unknown: BoostNoteValidation = { ok: false, status: 403, error: 'Unknown item' };

  if (!isObject(body)) return bad('Body must be a JSON object');
  if (!isObject(body.track)) return bad('track must be an object');

  const amount = parseAmount(body.amount);
  if (amount === null) return bad('Bad amount');

  const comment = optionalString(body.comment, BOOST_NOTE_LIMITS.maxComment);
  if (comment === false) return bad('Bad comment');

  const t = body.track;
  const track: BoostNoteTrack = {};
  for (const key of ['title', 'artist', 'album'] as const) {
    const v = optionalString(t[key], BOOST_NOTE_LIMITS.maxText);
    if (v === false) return bad(`Bad track.${key}`);
    if (v !== undefined) track[key] = v;
  }
  for (const key of ['guid', 'feedGuid', 'publisherGuid'] as const) {
    const v = optionalString(t[key], BOOST_NOTE_LIMITS.maxGuid);
    if (v === false) return bad(`Bad track.${key}`);
    if (v !== undefined) track[key] = v;
  }
  const imageUrl = optionalString(t.imageUrl, BOOST_NOTE_LIMITS.maxUrl);
  if (imageUrl === false) return bad('Bad track.imageUrl');

  // The note must be about an item of this site's catalog, and every GUID it carries
  // must be a real one. (An album boost sends the feed GUID as the item GUID.)
  if (!track.guid && !track.feedGuid) return unknown;
  if (track.feedGuid && !catalog.feedGuids.has(track.feedGuid)) return unknown;
  if (track.guid && !catalog.itemGuids.has(track.guid) && !catalog.feedGuids.has(track.guid)) return unknown;
  if (track.publisherGuid && !catalog.publisherGuids.has(track.publisherGuid) && !catalog.feedGuids.has(track.publisherGuid)) {
    return unknown;
  }

  // Only a catalog image goes into the image tag; any other image is dropped.
  if (imageUrl && catalog.imageUrls.has(imageUrl)) track.imageUrl = imageUrl;

  const input: BoostNoteInput = { amount, track };
  if (comment !== undefined) input.comment = comment;
  return { ok: true, input };
}

/** In-memory sliding-window limiter. On Vercel each instance has its own memory. */
export function createSlidingWindowLimiter(opts: { limit: number; windowMs: number; now?: () => number }) {
  const now = opts.now ?? Date.now;
  const hits = new Map<string, number[]>();
  return {
    hit(key: string): boolean {
      const t = now();
      const recent = (hits.get(key) ?? []).filter((x) => t - x < opts.windowMs);
      if (recent.length >= opts.limit) {
        hits.set(key, recent);
        return false;
      }
      recent.push(t);
      hits.set(key, recent);
      if (hits.size > 10_000) {
        // Drop keys whose window has passed, so the map cannot grow without end
        hits.forEach((v, k) => {
          if (!v.some((x) => t - x < opts.windowMs)) hits.delete(k);
        });
      }
      return true;
    }
  };
}

/**
 * A browser on another site must not use a visitor's browser to call the route.
 * No Origin header (curl, same-origin GET) passes: this is not authentication.
 */
export function isSameOrigin(origin: string | null, host: string | null): boolean {
  if (!origin) return true;
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
