/**
 * Builds the kind 1 "boost note" that the site posts to Nostr after a boost.
 *
 * Pure code with no secrets and no relative imports: the browser fallback path
 * (lib/boost-to-nostr-service.ts) and the server signer (app/api/nostr/boost-note)
 * both use it, so the server signs exactly the note the browser used to sign.
 * test/boost-note.test.ts pins the format.
 */
import type { EventTemplate } from 'nostr-tools';

export interface BoostNoteTrack {
  title?: string;
  artist?: string;
  album?: string;
  guid?: string; // item GUID
  feedGuid?: string; // podcast:guid of the feed
  publisherGuid?: string;
  imageUrl?: string;
}

export interface BoostNoteInput {
  amount: number; // sats
  comment?: string;
  track: BoostNoteTrack;
}

export interface BoostNoteContext {
  siteUrl: string;
  siteName: string;
  createdAt: number; // unix seconds
}

export const DEFAULT_SITE_URL = 'https://lnaddress-music.vercel.app';
export const DEFAULT_SITE_NAME = 'Music Platform';

export function boostNoteContextFromEnv(
  env: Record<string, string | undefined>,
  createdAt: number = Math.floor(Date.now() / 1000)
): BoostNoteContext {
  return {
    siteUrl: env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL,
    siteName: env.NEXT_PUBLIC_SITE_NAME || DEFAULT_SITE_NAME,
    createdAt
  };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** The site page for a track, album or publisher (null when nothing is known). */
export function boostNoteSiteUrl(track: BoostNoteTrack, siteUrl: string): string | null {
  // Special case for LNURL Testing Podcast - use GitHub repo
  if (track.album && track.album.toLowerCase().includes('lnurl testing')) {
    return 'https://github.com/ChadFarrow/lnurl-test-feed';
  }

  // For albums, use the album slug, with the track slug as a hash when it differs
  if (track.album) {
    let url = `${siteUrl}/album/${slugify(track.album)}`;
    if (track.title && track.title !== track.album) {
      url += `#${slugify(track.title)}`;
    }
    return url;
  }

  // For publishers, use the artist name
  if (track.artist) {
    return `${siteUrl}/publisher/${slugify(track.artist)}`;
  }

  return null;
}

/** Content in the CurioCaster/Fountain style: comment, amount, app, site link. */
export function boostNoteContent(input: BoostNoteInput, ctx: BoostNoteContext): string {
  const siteLink = boostNoteSiteUrl(input.track, ctx.siteUrl);
  let content = '';
  if (input.comment) {
    content = `${input.comment}\n\n`;
  }
  content += `⚡ ${input.amount} sats\n`;
  content += `📱 via ${ctx.siteName}\n`;
  if (siteLink) {
    content += `\n${siteLink}`;
  }
  return content;
}

export function buildBoostNoteTemplate(input: BoostNoteInput, ctx: BoostNoteContext): EventTemplate {
  const { track } = input;
  const siteLink = boostNoteSiteUrl(track, ctx.siteUrl);
  const tags: string[][] = [
    ['t', 'boost'],
    ['t', 'value4value'],
    ['t', 'podcasting20']
  ];

  // Fountain-style podcast tags in k/i pairs, with the site page as the URL hint
  const pair = (kind: string, id: string) => {
    tags.push(['k', kind]);
    const i = ['i', `${kind}:${id}`];
    if (siteLink) i.push(siteLink);
    tags.push(i);
  };
  if (track.guid) pair('podcast:item:guid', track.guid);
  if (track.feedGuid) pair('podcast:guid', track.feedGuid);
  if (track.publisherGuid) pair('podcast:publisher:guid', track.publisherGuid);

  if (track.imageUrl) {
    tags.push(['image', track.imageUrl]);
  }

  return {
    kind: 1,
    created_at: ctx.createdAt,
    tags,
    content: boostNoteContent(input, ctx)
  };
}
