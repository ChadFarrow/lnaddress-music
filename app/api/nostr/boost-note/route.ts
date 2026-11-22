/**
 * POST /api/nostr/boost-note — signs the site's boost note with the site's Nostr key.
 *
 * The secret key is the server-only variable SITE_NOSTR_NSEC (nsec1… or 64 hex). It must
 * never get a NEXT_PUBLIC_ prefix: Next.js copies NEXT_PUBLIC_ values into the browser
 * bundle. The route returns the signed event; the browser publishes it to the same
 * relays as before (lib/boost-to-nostr-service.ts, postBoostViaSite).
 *
 * Guard (lib/boost-note-guard.ts): same-origin check, rate limit per IP and per
 * instance, body size cap, input checks, catalog GUIDs only, kind 1 boost shape only.
 */
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { finalizeEvent, nip19 } from 'nostr-tools';
import { buildBoostNoteTemplate, boostNoteContextFromEnv } from '@/lib/boost-note';
import {
  BOOST_NOTE_LIMITS,
  buildBoostCatalog,
  createSlidingWindowLimiter,
  isSameOrigin,
  validateBoostNoteRequest,
  type BoostCatalog
} from '@/lib/boost-note-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// A boost can post up to three notes (several listeners react to one payment),
// and auto boost posts one per track. These limits leave room for that.
const perIpLimiter = createSlidingWindowLimiter({ limit: 12, windowMs: 60_000 });
const instanceLimiter = createSlidingWindowLimiter({ limit: 120, windowMs: 60_000 });

let catalog: BoostCatalog | null = null;
function getCatalog(): BoostCatalog | null {
  if (catalog) return catalog;
  try {
    const parsedFeeds = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'parsed-feeds.json'), 'utf-8'));
    let feeds: unknown;
    try {
      feeds = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'feeds.json'), 'utf-8'));
    } catch {
      feeds = undefined;
    }
    catalog = buildBoostCatalog(parsedFeeds, feeds);
    return catalog;
  } catch (error) {
    console.error('boost-note: cannot read the feed catalog', error instanceof Error ? error.message : error);
    return null;
  }
}

let siteKey: { raw: string; key: Uint8Array } | null = null;
function getSiteSecretKey(): Uint8Array | null {
  const raw = process.env.SITE_NOSTR_NSEC?.trim();
  if (!raw) return null;
  if (siteKey && siteKey.raw === raw) return siteKey.key;
  let key: Uint8Array | null = null;
  try {
    if (raw.startsWith('nsec1')) {
      const decoded = nip19.decode(raw);
      if (decoded.type === 'nsec') key = decoded.data;
    } else if (/^[0-9a-f]{64}$/i.test(raw)) {
      key = Uint8Array.from(Buffer.from(raw, 'hex'));
    }
  } catch {
    key = null;
  }
  if (!key) {
    console.error('boost-note: SITE_NOSTR_NSEC is not a valid nsec or 64-hex key');
    return null;
  }
  siteKey = { raw, key };
  return key;
}

const json = (status: number, body: Record<string, unknown>, headers: Record<string, string> = {}) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });

export async function POST(request: NextRequest) {
  const secretKey = getSiteSecretKey();
  if (!secretKey) return json(503, { error: 'Site Nostr key is not configured' });

  if (!isSameOrigin(request.headers.get('origin'), request.headers.get('host'))) {
    return json(403, { error: 'Cross-origin request refused' });
  }

  const ip =
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown';
  if (!perIpLimiter.hit(ip) || !instanceLimiter.hit('all')) {
    return json(429, { error: 'Too many boost notes, try again later' }, { 'Retry-After': '60' });
  }

  if (Number(request.headers.get('content-length') || 0) > BOOST_NOTE_LIMITS.maxBodyBytes) {
    return json(413, { error: 'Body too large' });
  }
  const text = await request.text();
  if (text.length > BOOST_NOTE_LIMITS.maxBodyBytes) return json(413, { error: 'Body too large' });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json(400, { error: 'Body must be JSON' });
  }

  const known = getCatalog();
  if (!known) return json(503, { error: 'Catalog unavailable' });

  const result = validateBoostNoteRequest(body, known);
  if (!result.ok) return json(result.status, { error: result.error });

  const template = buildBoostNoteTemplate(
    result.input,
    boostNoteContextFromEnv({
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
      NEXT_PUBLIC_SITE_NAME: process.env.NEXT_PUBLIC_SITE_NAME
    })
  );
  const event = finalizeEvent(template, secretKey);
  return json(200, { event });
}
