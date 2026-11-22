import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBoostCatalog,
  validateBoostNoteRequest,
  createSlidingWindowLimiter,
  isSameOrigin,
  BOOST_NOTE_LIMITS
} from '../lib/boost-note-guard.ts';

const parsedFeeds = {
  feeds: [
    {
      podcastGuid: 'feed-a',
      parsedData: {
        album: {
          feedGuid: 'feed-a',
          publisherGuid: 'pub-1',
          coverArt: 'https://img.example/a.jpg',
          imageUrl: 'https://img.example/a-alt.jpg',
          publisherImage: 'https://img.example/pub.jpg',
          tracks: [{ guid: 'item-a1', feedGuid: 'feed-a' }, { guid: 'item-a2', feedGuid: 'feed-a', image: 'https://img.example/a2.jpg' }]
        }
      }
    },
    { type: 'publisher', podcastGuid: 'pub-2', parsedData: {} }
  ]
};
const feedsJson = { feeds: [{ podcastGuid: 'feed-new' }] };
const catalog = buildBoostCatalog(parsedFeeds, feedsJson);

function body(over: Record<string, unknown> = {}, track: Record<string, unknown> = {}) {
  return { amount: 50, comment: 'hi', track: { title: 'T', album: 'A', guid: 'item-a1', feedGuid: 'feed-a', ...track }, ...over };
}

test('catalog holds the feed, item and publisher GUIDs and the images', () => {
  for (const g of ['feed-a', 'pub-2', 'feed-new']) assert.ok(catalog.feedGuids.has(g), g);
  assert.ok(catalog.itemGuids.has('item-a2'));
  assert.ok(catalog.publisherGuids.has('pub-1'));
  assert.ok(catalog.imageUrls.has('https://img.example/a2.jpg'));
  assert.ok(catalog.imageUrls.has('https://img.example/pub.jpg'));
});

test('accepts a boost of a catalog track', () => {
  const r = validateBoostNoteRequest(body(), catalog);
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.input, { amount: 50, comment: 'hi', track: { title: 'T', album: 'A', guid: 'item-a1', feedGuid: 'feed-a' } });
});

test('accepts an album boost that sends the feed GUID as the item GUID', () => {
  assert.equal(validateBoostNoteRequest(body({}, { guid: 'feed-a' }), catalog).ok, true);
});

test('accepts an amount that comes as a digit string, and keeps it as a number', () => {
  const r = validateBoostNoteRequest(body({ amount: '21' }), catalog);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.input.amount, 21);
});

test('rejects an item GUID that is not in the catalog', () => {
  const r = validateBoostNoteRequest(body({}, { guid: 'evil' }), catalog);
  assert.deepEqual(r, { ok: false, status: 403, error: 'Unknown item' });
});

test('rejects a feed GUID or publisher GUID that is not in the catalog', () => {
  assert.equal(validateBoostNoteRequest(body({}, { feedGuid: 'evil' }), catalog).ok, false);
  assert.equal(validateBoostNoteRequest(body({}, { publisherGuid: 'evil' }), catalog).ok, false);
  assert.equal(validateBoostNoteRequest(body({}, { publisherGuid: 'pub-1' }), catalog).ok, true);
});

test('rejects a boost with no item GUID and no feed GUID', () => {
  const r = validateBoostNoteRequest({ amount: 5, track: { title: 'T' } }, catalog);
  assert.deepEqual(r, { ok: false, status: 403, error: 'Unknown item' });
});

test('rejects a bad amount', () => {
  for (const amount of [-1, 1.5, 'abc', '1e3', null, undefined, BOOST_NOTE_LIMITS.maxAmount + 1, {}]) {
    const r = validateBoostNoteRequest(body({ amount }), catalog);
    assert.equal(r.ok, false, String(amount));
    if (!r.ok) assert.equal(r.status, 400);
  }
});

test('rejects a comment that is too long or not a string', () => {
  assert.equal(validateBoostNoteRequest(body({ comment: 'x'.repeat(BOOST_NOTE_LIMITS.maxComment + 1) }), catalog).ok, false);
  assert.equal(validateBoostNoteRequest(body({ comment: 5 }), catalog).ok, false);
  assert.equal(validateBoostNoteRequest(body({ comment: 'x'.repeat(BOOST_NOTE_LIMITS.maxComment) }), catalog).ok, true);
});

test('rejects a body that is not an object, or a track that is not an object', () => {
  for (const b of [null, 'x', [], { amount: 5 }, { amount: 5, track: 'x' }]) {
    assert.equal(validateBoostNoteRequest(b, catalog).ok, false, JSON.stringify(b));
  }
});

test('rejects a track text field that is too long', () => {
  assert.equal(validateBoostNoteRequest(body({}, { title: 'x'.repeat(BOOST_NOTE_LIMITS.maxText + 1) }), catalog).ok, false);
});

test('keeps a catalog image, and drops an image that is not in the catalog', () => {
  const a = validateBoostNoteRequest(body({}, { imageUrl: 'https://img.example/a.jpg' }), catalog);
  assert.ok(a.ok && a.input.track.imageUrl === 'https://img.example/a.jpg');
  const b = validateBoostNoteRequest(body({}, { imageUrl: 'https://evil.example/x.jpg' }), catalog);
  assert.ok(b.ok && !('imageUrl' in b.input.track));
});

test('drops track fields that the note does not use', () => {
  const r = validateBoostNoteRequest(body({}, { url: 'https://evil', senderName: 'x', feedUrl: 'y' }), catalog);
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(Object.keys(r.input.track).sort(), ['album', 'feedGuid', 'guid', 'title']);
});

test('rate limiter allows the limit in a window and refuses the next hit', () => {
  let now = 1000;
  const lim = createSlidingWindowLimiter({ limit: 3, windowMs: 60_000, now: () => now });
  assert.deepEqual([lim.hit('ip'), lim.hit('ip'), lim.hit('ip'), lim.hit('ip')], [true, true, true, false]);
  assert.equal(lim.hit('other-ip'), true);
  now += 60_001;
  assert.equal(lim.hit('ip'), true);
});

test('same-origin check accepts no Origin header and a matching host, refuses another site', () => {
  assert.equal(isSameOrigin(null, 'lnaddress-music.vercel.app'), true);
  assert.equal(isSameOrigin('https://lnaddress-music.vercel.app', 'lnaddress-music.vercel.app'), true);
  assert.equal(isSameOrigin('http://localhost:3000', 'localhost:3000'), true);
  assert.equal(isSameOrigin('https://evil.example', 'lnaddress-music.vercel.app'), false);
  assert.equal(isSameOrigin('not a url', 'lnaddress-music.vercel.app'), false);
  assert.equal(isSameOrigin('https://lnaddress-music.vercel.app', null), false);
});
