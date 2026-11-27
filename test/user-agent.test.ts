// lib/user-agent.js: the one User-Agent of this app's server code and scripts.
//
// The form is `<AppName>/<version> (+<public link>)`: the app's own name, the version from
// package.json, and the live site. No e-mail and no browser imitation. The last test refuses
// any other User-Agent string literal in app/, lib/, scripts/ and utils/, so a call site cannot
// drift back to a copied name (until 2026-11-27: RSS Parser, PodtardsImageProxy, DoerfelVerse,
// HPM-StaticBuilder, lnaddress-music-app, lnaddress-music-cron).
//
// `CHECK_LINK=1 npm test` also checks that the link answers 200 (it needs the internet).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_NAME, APP_URL, APP_VERSION, USER_AGENT } from '../lib/user-agent.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as { version: string };

test('user-agent: <name>/<version> (+<link>), from package.json and the live site', () => {
  assert.equal(APP_NAME, 'lnaddress-music');
  assert.equal(APP_VERSION, pkg.version);
  assert.ok(APP_VERSION.length > 0);
  assert.equal(APP_URL, 'https://lnaddress-music.vercel.app');
  assert.equal(USER_AGENT, `${APP_NAME}/${APP_VERSION} (+${APP_URL})`);
  // RFC 9110: product = token ["/" product-version], then a comment in parentheses.
  assert.match(USER_AGENT, /^[A-Za-z0-9!#$%&'*+.^_`|~-]+\/[A-Za-z0-9!#$%&'*+.^_`|~-]+ \(\+https:\/\/[^\s()]+\)$/);
});

test('user-agent: no e-mail, no browser imitation, no other app name', () => {
  assert.doesNotMatch(USER_AGENT, /@|mailto:/i);
  assert.doesNotMatch(USER_AGENT, /mozilla|compatible|applewebkit|chrome|safari|gecko/i);
  assert.doesNotMatch(USER_AGENT.split(' ')[0], /hpm|doerfelverse|podtards|rss.?parser|-app\/|-cron\//i);
});

test('user-agent: the plain-node scripts get the same value through require()', () => {
  const req = createRequire(path.join(root, 'scripts', 'x.js'));
  assert.equal(req('../lib/user-agent').USER_AGENT, USER_AGENT);
});

test('user-agent: no other User-Agent string literal in app/, lib/, scripts/, utils/', () => {
  const files = execFileSync('git', ['ls-files', 'app', 'lib', 'scripts', 'utils', 'hooks'], { cwd: root, encoding: 'utf8' })
    .split('\n')
    .filter((f) => /\.(ts|tsx|js|mjs|cjs)$/.test(f));
  assert.ok(files.length > 50, `only ${files.length} files found`);
  const literal = /['"]user-agent['"]\s*:\s*['"`]/i;
  const offenders: string[] = [];
  for (const f of files) {
    fs.readFileSync(path.join(root, f), 'utf8').split('\n').forEach((line, i) => {
      if (literal.test(line)) offenders.push(`${f}:${i + 1}`);
    });
  }
  assert.deepEqual(offenders, []);
});

test('user-agent: the link answers 200', { skip: process.env.CHECK_LINK !== '1' && 'set CHECK_LINK=1 (needs the internet)' }, async () => {
  const res = await fetch(APP_URL, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(15000) });
  await res.body?.cancel().catch(() => {});
  assert.equal(res.status, 200);
});
