// End-to-end tests for lib/rss-parser.ts:
// - every server fetch goes through the guarded feed fetch (lib/feed-fetch.ts),
//   so a private address is refused with no request and no retry;
// - a channel's value block and GUID come from the channel's own children, not
//   from the first <item> (a channel with no value block used to take its first
//   item's split as the album split).
//
// A real HTTP server listens on loopback. The parser must never reach it on a
// private address. For the public-host cases, a stub of globalThis.fetch
// rewrites the public address 93.184.215.14 to the local server and passes
// `init` through unchanged. Shipped code has no bypass.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { RSSParser } from '../lib/rss-parser.ts';
import { RSSCache } from '../lib/rss-cache.ts';

const realFetch = globalThis.fetch;
const PUBLIC = 'http://93.184.215.14';
const hits: Record<string, number> = {};
const FEEDS: Record<string, string> = {};

const server = http.createServer((req, res) => {
  const p = (req.url || '/').split('?')[0];
  hits[p] = (hits[p] || 0) + 1;
  if (p === '/huge-feed') {
    res.writeHead(200, { 'content-type': 'application/rss+xml' });
    const chunk = Buffer.alloc(64 * 1024, 0x3c);
    let sent = 0;
    const pump = () => {
      while (sent < 64 * 1024 * 1024 && !res.destroyed) {
        sent += chunk.length;
        if (!res.write(chunk)) {
          res.once('drain', pump);
          return;
        }
      }
      res.end();
    };
    pump();
    return;
  }
  if (p === '/redirect-feed-private') {
    const { port } = server.address() as AddressInfo;
    res.writeHead(302, { location: `http://[::ffff:127.0.0.1]:${port}/feed.xml` });
    res.end();
    return;
  }
  if (FEEDS[p]) {
    res.writeHead(200, { 'content-type': 'application/rss+xml' });
    res.end(FEEDS[p]);
    return;
  }
  res.writeHead(404);
  res.end();
});

let PORT = 0;
let LOCAL = '';
let cacheDir = '';

function viaLocal(): string[] {
  const calls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(url);
    return realFetch(url.replace(PUBLIC, LOCAL), init);
  }) as typeof fetch;
  return calls;
}

// The parser logs every feed it reads. Keep the test output to the results.
const saved = { log: console.log, warn: console.warn, error: console.error, info: console.info };
async function quietly<T>(run: () => Promise<T>): Promise<T> {
  console.log = console.warn = console.error = console.info = () => {};
  try {
    return await run();
  } finally {
    Object.assign(console, saved);
  }
}

const feedXml = (channelExtra: string, items: string) => `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:podcast="https://podcastindex.org/namespace/1.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>Test Album</title>
    <description>Test</description>
    <itunes:author>Test Artist</itunes:author>
    <itunes:image href="https://example.com/a.jpg"/>
${channelExtra}
${items}
  </channel>
</rss>`;

const valueBlock = (name: string, address: string) => `
      <podcast:value type="lightning" method="keysend" suggested="0.00000005000">
        <podcast:valueRecipient name="${name}" type="node" address="${address}" split="100"/>
      </podcast:value>`;

const ITEM_NODE = '03' + 'a'.repeat(64);
const CHANNEL_NODE = '02' + 'b'.repeat(64);

const item = (title: string, extra = '') => `
    <item>
      <title>${title}</title>
      <guid>${title}</guid>
      <enclosure url="https://example.com/${title}.mp3" type="audio/mpeg" length="1"/>
      <itunes:duration>120</itunes:duration>
      ${extra}
    </item>`;

const parse = (url: string) => quietly(() => RSSParser.parseAlbumFeed(url));

before(async () => {
  // RSSCache keeps parsed feeds for 30 min in data/rss-cache/. Use a throwaway
  // folder, or a second run reads the first run's albums and tests nothing.
  cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lnaddress-rss-parser-test-'));
  (RSSCache as unknown as { CACHE_DIR: string }).CACHE_DIR = cacheDir;
  await new Promise<void>((r) => server.listen(0, '::', () => r()));
  PORT = (server.address() as AddressInfo).port;
  LOCAL = `http://127.0.0.1:${PORT}`;
  FEEDS['/feed.xml'] = feedXml(valueBlock('Channel', CHANNEL_NODE), item('One'));
});

after(() => {
  globalThis.fetch = realFetch;
  server.closeAllConnections();
  server.close();
  fs.rmSync(cacheDir, { recursive: true, force: true });
});

test('control: the local feed server answers a direct fetch', async () => {
  // So a zero hit count below means the guard stopped the request, not that
  // nothing was listening.
  hits['/feed.xml'] = 0;
  await realFetch(`${LOCAL}/feed.xml`).then((r) => r.text());
  assert.equal(hits['/feed.xml'], 1);
});

test('parseAlbumFeed refuses private addresses with no request and no retry', async () => {
  const attacks: [string, string][] = [
    [`http://localhost:${PORT}/feed.xml`, 'localhost'],
    [`http://127.0.0.1:${PORT}/feed.xml`, '127.0.0.1'],
    [`http://[::1]:${PORT}/feed.xml`, '[::1]'],
    [`http://[::ffff:127.0.0.1]:${PORT}/feed.xml`, '::ffff:127.0.0.1'],
    [`http://2130706433:${PORT}/feed.xml`, 'decimal 127.0.0.1'],
    ['http://10.0.0.1/feed.xml', '10/8'],
    ['http://169.254.169.254/latest/meta-data/', '169.254.169.254 (cloud metadata)'],
    ['http://metadata.google.internal/computeMetadata/v1/', 'metadata.google.internal'],
  ];
  for (const [url, why] of attacks) {
    hits['/feed.xml'] = 0;
    const t0 = Date.now();
    const album = await parse(url);
    const ms = Date.now() - t0;
    assert.equal(album, null, `parser read a feed from ${why}`);
    assert.equal(hits['/feed.xml'], 0, `server got a request for ${why}`);
    // withRetry waits 1000 ms before a second attempt, so under 900 ms is one attempt.
    assert.ok(ms < 900, `refused ${why} after ${ms} ms (retried?)`);
  }
});

test('the publisher readers refuse private addresses too', async () => {
  FEEDS['/pub.xml'] = feedXml('<podcast:medium>publisher</podcast:medium>', '');
  hits['/pub.xml'] = 0;
  const info = await quietly(() => RSSParser.parsePublisherFeedInfo(`http://127.0.0.1:${PORT}/pub.xml`));
  const items = await quietly(() => RSSParser.parsePublisherFeed(`http://[::1]:${PORT}/pub.xml`));
  const albums = await quietly(() => RSSParser.parsePublisherFeedAlbums(`http://localhost:${PORT}/pub.xml`));
  assert.equal(info, null);
  assert.deepEqual(items, []);
  assert.deepEqual(albums, []);
  assert.equal(hits['/pub.xml'], 0);
});

test('parseAlbumFeed refuses a public feed that redirects to ::ffff:127.0.0.1', async (t) => {
  t.after(() => { globalThis.fetch = realFetch; });
  viaLocal();
  hits['/feed.xml'] = 0;
  const album = await parse(`${PUBLIC}/redirect-feed-private`);
  assert.equal(album, null);
  assert.equal(hits['/feed.xml'], 0);
});

test('parseAlbumFeed refuses a feed over 8 MB after one request (no retry)', async (t) => {
  t.after(() => { globalThis.fetch = realFetch; });
  viaLocal();
  hits['/huge-feed'] = 0;
  const album = await parse(`${PUBLIC}/huge-feed`);
  assert.equal(album, null);
  assert.equal(hits['/huge-feed'], 1);
});

test('parseAlbumFeed still reads a public feed through the guard', async (t) => {
  t.after(() => { globalThis.fetch = realFetch; });
  viaLocal();
  const album = await parse(`${PUBLIC}/feed.xml`);
  assert.ok(album, 'public feed did not parse');
  assert.equal(album.title, 'Test Album');
  assert.equal(album.tracks.length, 1);
  assert.equal(album.value?.recipients[0]?.address, CHANNEL_NODE);
});

test('a channel with no value block does not take its first item\'s split', async (t) => {
  t.after(() => { globalThis.fetch = realFetch; });
  viaLocal();
  FEEDS['/no-channel-value.xml'] = feedXml('', item('One', valueBlock('Item', ITEM_NODE)) + item('Two', valueBlock('Item', ITEM_NODE)));
  const a = await parse(`${PUBLIC}/no-channel-value.xml`);
  assert.ok(a, 'feed with item values only did not parse');
  assert.equal(a.value, undefined, `album took ${JSON.stringify(a.value?.recipients)}`);
  assert.equal(a.paymentRecipients, undefined);
  assert.equal(a.tracks[0]?.value?.recipients[0]?.address, ITEM_NODE, 'track lost its own value block');
});

test('a channel value block after the items is still the channel\'s', async (t) => {
  t.after(() => { globalThis.fetch = realFetch; });
  viaLocal();
  FEEDS['/channel-value-last.xml'] = feedXml('', item('One', valueBlock('Item', ITEM_NODE)) + item('Two') + valueBlock('Channel', CHANNEL_NODE));
  const b = await parse(`${PUBLIC}/channel-value-last.xml`);
  assert.ok(b);
  assert.deepEqual(b.value?.recipients.map((r) => r.address), [CHANNEL_NODE]);
  assert.equal(b.paymentRecipients?.[0]?.address, CHANNEL_NODE);
  assert.equal(b.tracks[0]?.value?.recipients[0]?.address, ITEM_NODE, 'track 1 keeps its own split');
  assert.equal(b.tracks[1]?.value?.recipients[0]?.address, CHANNEL_NODE, 'track 2 inherits the channel split');
});

test('an unprefixed channel <value> is still read', async (t) => {
  t.after(() => { globalThis.fetch = realFetch; });
  viaLocal();
  FEEDS['/unprefixed.xml'] = feedXml(
    `<value type="lightning" method="keysend"><valueRecipient name="C" type="node" address="${CHANNEL_NODE}" split="100"/></value>`,
    item('One'),
  );
  const c = await parse(`${PUBLIC}/unprefixed.xml`);
  assert.equal(c?.value?.recipients[0]?.address, CHANNEL_NODE);
});

test('the feed GUID comes from the channel, not from an item', async (t) => {
  t.after(() => { globalThis.fetch = realFetch; });
  viaLocal();
  FEEDS['/item-guid.xml'] = feedXml('', item('One', '<podcast:guid>item-guid-not-the-feed</podcast:guid>'));
  const d = await parse(`${PUBLIC}/item-guid.xml`);
  assert.ok(d);
  assert.notEqual(d.feedGuid, 'item-guid-not-the-feed');
  FEEDS['/channel-guid.xml'] = feedXml('<podcast:guid>channel-guid</podcast:guid>', item('One'));
  const e = await parse(`${PUBLIC}/channel-guid.xml`);
  assert.equal(e?.feedGuid, 'channel-guid');
});
