// Tests for the server-side feed fetch: the private-address guard, the time
// limit and the size limit (lib/safe-fetch.ts, lib/capped-body.ts,
// lib/feed-fetch.ts).
//
// The address list, the redirect cases and the body-cap cases are the
// PC20-Nostr recipe's own tests (safe-feed-fetch, tests/ssrf.test.ts), run
// against the copies in lib/. The last group starts a real HTTP server on
// loopback. The guard refuses loopback, so to reach it a stub of
// globalThis.fetch rewrites the public address 93.184.215.14 to the local server
// and passes `init` through unchanged; the real AbortSignal and the real socket
// then do the work. Shipped code has no bypass.
//
// No network needed. One case asks DNS about 127.0.0.1.nip.io (a public wildcard
// name that answers 127.0.0.1); without DNS it is skipped.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { assertSafeFetchUrl, isPrivateIp, safeFetch } from '../lib/safe-fetch.ts';
import { readCappedText, readBytesUpTo } from '../lib/capped-body.ts';
import { fetchUntrustedText, FeedFetchError, FEED_MAX_BYTES } from '../lib/feed-fetch.ts';

function refused(url: string): boolean {
  try {
    assertSafeFetchUrl(url);
    return false;
  } catch {
    return true;
  }
}

// --- literal addresses and names (recipe) -----------------------------------

const MUST_REFUSE: [string, string][] = [
  ['http://localhost/', 'localhost'],
  ['http://localhost:3000/api/admin/feeds', 'localhost with a port'],
  ['http://127.0.0.1/', 'loopback'],
  ['http://10.0.0.1/', 'RFC 1918 10/8'],
  ['http://10.255.255.254/', 'RFC 1918 10/8 upper edge'],
  ['http://169.254.169.254/latest/meta-data/', 'cloud metadata'],
  ['http://[::1]/', 'IPv6 loopback'],
  ['http://[::ffff:127.0.0.1]/', 'v4-mapped loopback'],
  ['http://172.16.0.1/', 'RFC 1918 172.16/12'],
  ['http://172.31.255.1/', 'RFC 1918 172.16/12 upper edge'],
  ['http://192.168.1.1/', 'RFC 1918 192.168/16'],
  ['http://100.64.0.1/', 'CGNAT / tailnet'],
  ['http://100.127.255.1/', 'CGNAT upper edge'],
  ['http://0.0.0.0/', '0/8'],
  ['http://224.0.0.1/', 'multicast 224/4'],
  ['http://239.255.255.250/', 'multicast SSDP'],
  ['http://240.0.0.1/', 'reserved 240/4'],
  ['http://255.255.255.255/', 'broadcast'],
  ['http://192.0.0.1/', 'IETF protocol assignments 192.0.0/24'],
  ['http://192.0.2.1/', 'TEST-NET-1'],
  ['http://198.51.100.1/', 'TEST-NET-2'],
  ['http://203.0.113.1/', 'TEST-NET-3'],
  ['http://198.18.0.1/', 'benchmarking 198.18/15'],
  ['http://198.19.255.1/', 'benchmarking 198.19'],
  ['http://192.88.99.1/', '6to4 relay anycast'],
  ['http://2130706433/', 'decimal 127.0.0.1'],
  ['http://0177.0.0.1/', 'octal 127.0.0.1'],
  ['http://0x7f.0.0.1/', 'hex 127.0.0.1'],
  ['http://127.1/', 'short 127.0.0.1'],
  ['http://good.example@169.254.169.254/', 'userinfo smuggling'],
  ['http://localhost./', 'localhost with trailing dot'],
  ['http://metadata.google.internal/', '.internal'],
  ['http://metadata.google.internal./', '.internal with trailing dot'],
  ['http://printer.local/', '.local'],
  ['http://app.localhost/', '*.localhost'],
  ['http://[::]/', 'IPv6 unspecified'],
  ['http://[::ffff:169.254.169.254]/', 'v4-mapped metadata (hex after parsing)'],
  ['http://[::ffff:10.0.0.1]/', 'v4-mapped RFC 1918'],
  ['http://[::7f00:1]/', 'v4-compatible loopback'],
  ['http://[64:ff9b::a9fe:a9fe]/', 'NAT64 metadata'],
  ['http://[64:ff9b::7f00:1]/', 'NAT64 loopback'],
  ['http://[2002:7f00:1::]/', '6to4 loopback'],
  ['http://[2001:0:4136:e378:8000:63bf:3fff:fdd2]/', 'Teredo'],
  ['http://[fe80::1]/', 'link-local'],
  ['http://[fec0::1]/', 'site-local'],
  ['http://[fd00::1]/', 'unique-local'],
  ['http://[fc00::1]/', 'unique-local fc'],
  ['http://[100::1]/', 'discard-only 100::/64'],
  ['file:///etc/passwd', 'file scheme'],
  ['gopher://example.com/', 'gopher scheme'],
  ['ftp://example.com/feed.xml', 'ftp scheme'],
  ['not a url', 'unparseable'],
];

const MUST_ALLOW: [string, string][] = [
  ['https://example.com/feed.xml', 'ordinary https feed'],
  ['http://feeds.example.org/rss', 'plain http feed (a long tail of real feeds)'],
  ['https://feeds.fountain.fm/abc', 'fountain feed'],
  ['https://1.1.1.1/', 'public IPv4 literal'],
  ['https://[2606:4700:4700::1111]/', 'public IPv6 literal'],
  ['https://fdrecords.com/feed.xml', 'public name starting fd'],
  ['https://fcc.gov/', 'public name starting fc'],
  ['https://fe80.example.com/', 'public name starting fe80'],
  ['http://172.32.0.1/', 'just above 172.16/12'],
  ['http://100.128.0.1/', 'just above 100.64/10'],
  ['http://223.255.255.1/', 'just below multicast'],
  ['http://198.20.0.1/', 'just above 198.18/15'],
];

test('the guard refuses private and special-use addresses in every spelling', () => {
  const allowed = MUST_REFUSE.filter(([url]) => !refused(url)).map(([url, why]) => `${why}: ${url}`);
  assert.deepEqual(allowed, [], 'these were allowed');
});

test('the guard allows public feeds, including the edges of each refused range', () => {
  const wronglyRefused = MUST_ALLOW.filter(([url]) => refused(url)).map(([url, why]) => `${why}: ${url}`);
  assert.deepEqual(wronglyRefused, [], 'these were refused');
});

test('resolved addresses in resolver form count as private', () => {
  for (const addr of ['127.0.0.1', '::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '169.254.169.254', '10.1.2.3', 'fe80::1%en0']) {
    assert.equal(isPrivateIp(addr), true, addr);
  }
});

test('the guard errors keep the prefixes that feed-fetch classifies on', async () => {
  assert.throws(() => assertSafeFetchUrl('http://127.0.0.1/'), /^Error: unsafe fetch url/);
  await assert.rejects(
    readCappedText(new Response('x', { headers: { 'content-length': '99' } }), 10),
    /^Error: response too large/,
  );
});

// --- redirects: every hop is checked (recipe) --------------------------------

type Call = { url: string; init?: RequestInit };
const realFetch = globalThis.fetch;
const PUBLIC = 'http://93.184.215.14';

function stubFetch(answer: (url: string, n: number) => Response): Call[] {
  const calls: Call[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    return answer(url, calls.length);
  }) as typeof fetch;
  return calls;
}
const redirect = (to: string) => new Response(null, { status: 302, headers: { location: to } });

test('redirects to private addresses are refused before the second request', async (t) => {
  t.after(() => { globalThis.fetch = realFetch; });
  for (const target of [
    'http://169.254.169.254/latest/meta-data/',
    'http://[::ffff:127.0.0.1]/',
    'http://localhost/',
    'http://10.0.0.1/',
    'http://[::1]/',
    'http://127.0.0.1:3000/',
  ]) {
    const calls = stubFetch(() => redirect(target));
    await assert.rejects(safeFetch(`${PUBLIC}/feed.xml`, { redirect: 'follow' }), /unsafe fetch url/, target);
    assert.equal(calls.length, 1, `redirect to ${target} made a second request`);
    assert.equal(calls[0].init?.redirect, 'manual', "caller's redirect: 'follow' must be overridden");
    assert.equal(calls[0].init?.cache, 'no-store');
  }
});

test('a relative public redirect is followed; a chain is capped at 5', async (t) => {
  t.after(() => { globalThis.fetch = realFetch; });
  let calls = stubFetch((_u, n) => (n === 1 ? redirect('/moved.xml') : new Response('<rss/>')));
  const res = await safeFetch(`${PUBLIC}/feed.xml`);
  assert.equal(res.status, 200);
  assert.equal(calls[1].url, `${PUBLIC}/moved.xml`);

  calls = stubFetch((_u, n) => (n > 20 ? new Response('gave up') : redirect(`${PUBLIC}/feed.xml`)));
  await assert.rejects(safeFetch(`${PUBLIC}/feed.xml`), /too many redirects/);
  assert.equal(calls.length, 6, '1 request + 5 redirects');

  calls = stubFetch((_u, n) => (n === 1 ? redirect('gopher://93.184.215.14/') : new Response('reached')));
  await assert.rejects(safeFetch(`${PUBLIC}/feed.xml`), /unsafe fetch url/);
  assert.equal(calls.length, 1, 'redirect to another scheme reached fetch');
});

test('an unresolvable host is refused without a request (fails closed)', async (t) => {
  t.after(() => { globalThis.fetch = realFetch; });
  const calls = stubFetch(() => new Response('never'));
  await assert.rejects(safeFetch('http://does-not-exist.invalid/feed.xml'), /unresolvable host/);
  assert.equal(calls.length, 0);
});

test('a public name that resolves to 127.0.0.1 is refused after DNS', async (t) => {
  t.after(() => { globalThis.fetch = realFetch; });
  const calls = stubFetch(() => new Response('never'));
  try {
    await safeFetch('http://127.0.0.1.nip.io/feed.xml');
    assert.fail('nip.io name resolving to loopback was fetched');
  } catch (e) {
    assert.equal(calls.length, 0, 'nip.io name reached fetch');
    const m = (e as Error).message;
    if (!m.includes('resolves to a private address')) t.skip(`no DNS here (${m})`);
  }
});

// --- the body cap counts bytes, it does not trust headers (recipe) -----------

const stream = (chunks: number, size: number) =>
  new Response(
    new ReadableStream({
      start(c) {
        for (let i = 0; i < chunks; i++) c.enqueue(new Uint8Array(size).fill(65));
        c.close();
      },
    }),
  );

test('the body cap counts streamed bytes and refuses a declared huge length', async () => {
  await assert.rejects(readCappedText(stream(3, 4), 10), /response too large/);
  assert.equal((await readCappedText(stream(3, 4), 12)).length, 12);
  await assert.rejects(
    readCappedText(new Response('x', { headers: { 'content-length': String(1e12) } }), 1024),
    /response too large/,
  );
  const unstreamed = { headers: new Headers(), body: null, arrayBuffer: async () => new ArrayBuffer(20) };
  await assert.rejects(readCappedText(unstreamed, 10), /response too large/);
  const prefix = await readBytesUpTo(stream(3, 4), 5);
  assert.equal(prefix.bytes.length, 5);
  assert.equal(prefix.truncated, true);
});

// --- lib/feed-fetch.ts: time and size limits on a real socket -----------------

const hits: Record<string, number> = {};
let hugeBytesSent = 0;
const timers: ReturnType<typeof setInterval>[] = [];

const server = http.createServer((req, res) => {
  const path = (req.url || '/').split('?')[0];
  hits[path] = (hits[path] || 0) + 1;
  if (path === '/ok') {
    res.writeHead(200, { 'content-type': 'application/rss+xml' });
    res.end('<rss>ok</rss>');
    return;
  }
  if (path === '/hang') return; // headers never come
  if (path === '/drip') {
    res.writeHead(200, { 'content-type': 'application/rss+xml' });
    const t = setInterval(() => res.write('<'), 100);
    timers.push(t);
    res.on('close', () => clearInterval(t));
    return;
  }
  if (path === '/huge') {
    // Chunked, no Content-Length: only the byte count while reading can stop it.
    res.writeHead(200, { 'content-type': 'application/rss+xml' });
    const chunk = Buffer.alloc(64 * 1024, 0x3c);
    let sent = 0;
    const pump = () => {
      while (sent < 64 * 1024 * 1024 && !res.destroyed) {
        sent += chunk.length;
        hugeBytesSent += chunk.length;
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
  if (path === '/declared-huge') {
    res.writeHead(200, { 'content-type': 'application/rss+xml', 'content-length': String(10 * 1024 * 1024 * 1024) });
    res.write('<rss>');
    return;
  }
  if (path === '/404') {
    res.writeHead(404);
    res.end('not here');
    return;
  }
  if (path === '/redirect-private') {
    const { port } = server.address() as AddressInfo;
    res.writeHead(302, { location: `http://127.0.0.1:${port}/ok` });
    res.end();
    return;
  }
  res.writeHead(404);
  res.end();
});

let LOCAL = '';

/** Route the public literal to the local server; everything else goes out for real. */
function viaLocal(): Call[] {
  const calls: Call[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    return realFetch(url.replace(PUBLIC, LOCAL), init);
  }) as typeof fetch;
  return calls;
}

/** Expect `run` to fail with a FeedFetchError of `reason` within `maxMs`. A missing limit hangs; the watchdog turns that into a failure. */
async function expectFailure(run: () => Promise<unknown>, reason: string, maxMs: number) {
  const t0 = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const watchdog = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`no answer after ${maxMs + 3000} ms (hung)`)), maxMs + 3000);
  });
  try {
    await Promise.race([run(), watchdog]);
    assert.fail(`succeeded, expected ${reason}`);
  } catch (e) {
    if (e instanceof assert.AssertionError) throw e;
    const got = e instanceof FeedFetchError ? e.reason : `${(e as Error).name}: ${(e as Error).message}`;
    assert.equal(got, reason);
    const ms = Date.now() - t0;
    assert.ok(ms <= maxMs, `${reason} after ${ms} ms, limit ${maxMs} ms`);
  } finally {
    clearTimeout(timer);
  }
}

before(async () => {
  await new Promise<void>((r) => server.listen(0, '::', () => r()));
  LOCAL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
  globalThis.fetch = realFetch;
  timers.forEach((t) => clearInterval(t));
  server.closeAllConnections();
  server.close();
});

test('feed-fetch reads a normal feed', async (t) => {
  t.after(() => { globalThis.fetch = realFetch; });
  const calls = viaLocal();
  assert.equal(await fetchUntrustedText(`${PUBLIC}/ok`), '<rss>ok</rss>');
  const headers = new Headers(calls[0].init?.headers);
  assert.equal(headers.get('user-agent'), 'Mozilla/5.0 (compatible; RSS Parser/1.0)');
  assert.ok(calls[0].init?.signal, 'a timeout signal is passed');
});

test('feed-fetch: a slow server times out (headers never come, or the body drips)', async (t) => {
  t.after(() => { globalThis.fetch = realFetch; });
  viaLocal();
  await expectFailure(() => fetchUntrustedText(`${PUBLIC}/hang`, { timeoutMs: 500 }), 'timeout', 2000);
  await expectFailure(() => fetchUntrustedText(`${PUBLIC}/drip`, { timeoutMs: 500 }), 'timeout', 2000);
});

test('feed-fetch: a huge body is stopped while it arrives', async (t) => {
  t.after(() => { globalThis.fetch = realFetch; });
  viaLocal();
  hugeBytesSent = 0;
  await expectFailure(() => fetchUntrustedText(`${PUBLIC}/huge`, { maxBytes: 1024 * 1024 }), 'too-large', 5000);
  await new Promise((r) => setTimeout(r, 200));
  assert.ok(hugeBytesSent < 16 * 1024 * 1024, `server wrote ${hugeBytesSent} bytes; the read did not stop`);
  assert.equal(FEED_MAX_BYTES, 8 * 1024 * 1024);
  await expectFailure(() => fetchUntrustedText(`${PUBLIC}/huge`), 'too-large', 5000);
  await expectFailure(() => fetchUntrustedText(`${PUBLIC}/declared-huge`), 'too-large', 2000);
});

test('feed-fetch: a 404 is an http failure with its status', async (t) => {
  t.after(() => { globalThis.fetch = realFetch; });
  viaLocal();
  await assert.rejects(fetchUntrustedText(`${PUBLIC}/404`), (e: unknown) => {
    assert.ok(e instanceof FeedFetchError);
    assert.equal(e.reason, 'http');
    assert.equal(e.status, 404);
    return true;
  });
});

test('feed-fetch: a public host that redirects to 127.0.0.1 is refused, and the target gets no request', async (t) => {
  t.after(() => { globalThis.fetch = realFetch; });
  viaLocal();
  hits['/ok'] = 0;
  await expectFailure(() => fetchUntrustedText(`${PUBLIC}/redirect-private`), 'refused', 2000);
  assert.equal(hits['/ok'], 0);
});
