// Run with: npm test   (node --test, with Node's built-in TypeScript type stripping)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBoostNoteTemplate, boostNoteContextFromEnv } from '../lib/boost-note.ts';

const SITE = 'https://lnaddress-music.vercel.app';
const ctx = { siteUrl: SITE, siteName: 'lnaddress music', createdAt: 1_800_000_000 };

// The expected values below are what BoostToNostrService.postBoost produced before the
// signing moved to the server. The server must sign exactly the same note.
test('builds the same kind 1 note as before for a track boost with a comment', () => {
  const t = buildBoostNoteTemplate({
    amount: 50,
    comment: 'Great track',
    track: {
      title: 'Song One',
      artist: 'The Band',
      album: 'Album Name!',
      guid: 'item-1',
      feedGuid: 'feed-1',
      publisherGuid: 'pub-1',
      imageUrl: 'https://img.example/x.jpg'
    }
  }, ctx);
  const url = `${SITE}/album/album-name#song-one`;
  assert.equal(t.kind, 1);
  assert.equal(t.created_at, 1_800_000_000);
  assert.equal(t.content, `Great track\n\n⚡ 50 sats\n📱 via lnaddress music\n\n${url}`);
  assert.deepEqual(t.tags, [
    ['t', 'boost'],
    ['t', 'value4value'],
    ['t', 'podcasting20'],
    ['k', 'podcast:item:guid'],
    ['i', 'podcast:item:guid:item-1', url],
    ['k', 'podcast:guid'],
    ['i', 'podcast:guid:feed-1', url],
    ['k', 'podcast:publisher:guid'],
    ['i', 'podcast:publisher:guid:pub-1', url],
    ['image', 'https://img.example/x.jpg']
  ]);
});

test('leaves out the track hash when the title equals the album', () => {
  const t = buildBoostNoteTemplate({ amount: 21, track: { title: 'Same', album: 'Same', feedGuid: 'f' } }, ctx);
  assert.equal(t.content, `⚡ 21 sats\n📱 via lnaddress music\n\n${SITE}/album/same`);
  assert.deepEqual(t.tags.slice(3), [['k', 'podcast:guid'], ['i', 'podcast:guid:f', `${SITE}/album/same`]]);
});

test('links the LNURL testing album to its GitHub repo', () => {
  const t = buildBoostNoteTemplate({ amount: 1, track: { album: 'LNURL Testing Podcast', guid: 'g' } }, ctx);
  assert.ok(t.content.endsWith('\n\nhttps://github.com/ChadFarrow/lnurl-test-feed'));
});

test('links to the publisher page when only the artist is known', () => {
  const t = buildBoostNoteTemplate({ amount: 5, track: { artist: 'The Band', feedGuid: 'f' } }, ctx);
  assert.ok(t.content.endsWith(`\n\n${SITE}/publisher/the-band`));
});

test('adds no URL and no URL hint when there is no album and no artist', () => {
  const t = buildBoostNoteTemplate({ amount: 5, track: { guid: 'g' } }, ctx);
  assert.equal(t.content, '⚡ 5 sats\n📱 via lnaddress music\n');
  assert.deepEqual(t.tags.slice(3), [['k', 'podcast:item:guid'], ['i', 'podcast:item:guid:g']]);
});

test('uses the same defaults as before when the site variables are not set', () => {
  const c = boostNoteContextFromEnv({}, 7);
  assert.deepEqual(c, { siteUrl: SITE, siteName: 'Music Platform', createdAt: 7 });
  const c2 = boostNoteContextFromEnv({ NEXT_PUBLIC_SITE_URL: 'https://x.test', NEXT_PUBLIC_SITE_NAME: 'X' }, 8);
  assert.deepEqual(c2, { siteUrl: 'https://x.test', siteName: 'X', createdAt: 8 });
});
