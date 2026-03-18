#!/usr/bin/env ts-node
/**
 * Discover new fountain.fm music feeds via Podcast Index API
 *
 * Uses two endpoints for comprehensive coverage:
 *   1. /podcasts/bymedium?medium=music&max=1000  — all indexed music feeds
 *   2. /search/music/byterm?q=fountain&max=200   — music-specific search
 *
 * Usage:
 *   npx ts-node scripts/discover-new-fountain-feeds.ts
 *   npx ts-node scripts/discover-new-fountain-feeds.ts --write   # also writes to feeds.json
 */

import fetch from 'node-fetch';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const PODCAST_INDEX_API_KEY = process.env.PODCAST_INDEX_API_KEY || '';
const PODCAST_INDEX_API_SECRET = process.env.PODCAST_INDEX_API_SECRET || '';
const PODCAST_INDEX_BASE_URL = 'https://api.podcastindex.org/api/1.0';

function getAuthHeaders() {
  const apiHeaderTime = Math.floor(Date.now() / 1000);
  const hash = crypto.createHash('sha1');
  hash.update(PODCAST_INDEX_API_KEY + PODCAST_INDEX_API_SECRET + apiHeaderTime);
  const hashString = hash.digest('hex');
  return {
    'X-Auth-Key': PODCAST_INDEX_API_KEY,
    'X-Auth-Date': apiHeaderTime.toString(),
    'Authorization': hashString,
    'User-Agent': 'lnaddress-music-app',
  };
}

async function queryAPI(endpoint: string): Promise<any[]> {
  const url = `${PODCAST_INDEX_BASE_URL}${endpoint}`;
  console.log(`  Querying: ${url}`);
  const response = await fetch(url, { headers: getAuthHeaders() });
  if (!response.ok) {
    console.error(`  ❌ API Error: ${response.status} ${response.statusText}`);
    const body = await response.text();
    console.error(`  Response: ${body.slice(0, 200)}`);
    return [];
  }
  const data: any = await response.json();
  const feeds = data.feeds || [];
  console.log(`  → Got ${feeds.length} feeds`);
  return feeds;
}

async function main() {
  if (!PODCAST_INDEX_API_KEY || !PODCAST_INDEX_API_SECRET) {
    console.error('❌ Set PODCAST_INDEX_API_KEY and PODCAST_INDEX_API_SECRET in .env.local');
    process.exit(1);
  }

  const writeMode = process.argv.includes('--write');

  // Load existing feeds
  const feedsPath = path.resolve(__dirname, '../data/feeds.json');
  const feedsData = JSON.parse(fs.readFileSync(feedsPath, 'utf-8'));
  const existingUrls = new Set<string>(
    feedsData.feeds.map((f: any) => f.originalUrl)
  );
  console.log(`📋 Existing feeds: ${feedsData.feeds.length} total, ${existingUrls.size} unique URLs`);
  const existingFountainCount = feedsData.feeds.filter((f: any) =>
    f.originalUrl?.includes('fountain.fm')
  ).length;
  console.log(`   Existing fountain.fm feeds: ${existingFountainCount}\n`);

  // Query both endpoints
  console.log('🔍 Querying Podcast Index API...');

  console.log('\n1) /podcasts/bymedium?medium=music&max=1000');
  const byMediumFeeds = await queryAPI('/podcasts/bymedium?medium=music&max=1000');

  console.log('\n2) /search/music/byterm?q=fountain&max=200');
  const byTermFeeds = await queryAPI('/search/music/byterm?q=fountain&max=200');

  // Merge and deduplicate by URL
  const allFeeds = new Map<string, any>();
  for (const feed of [...byMediumFeeds, ...byTermFeeds]) {
    const url = feed.url || feed.originalUrl || '';
    if (url && !allFeeds.has(url)) {
      allFeeds.set(url, feed);
    }
  }
  console.log(`\n📊 Combined unique feeds: ${allFeeds.size}`);

  // Filter to fountain.fm URLs not in feeds.json
  const newFeeds: any[] = [];
  let fountainTotal = 0;
  for (const [url, feed] of Array.from(allFeeds.entries())) {
    if (url.includes('feeds.fountain.fm') || url.includes('fountain.fm')) {
      fountainTotal++;
      if (!existingUrls.has(url)) {
        // Derive an id from the URL path
        const urlPath = new URL(url).pathname.replace(/^\//, '').replace(/\/feed\.xml$/, '');
        const id = `fountain-${urlPath}`;
        newFeeds.push({
          id,
          originalUrl: url,
          type: 'album',
          title: feed.title || 'Unknown',
          priority: 'extended',
          status: 'active',
          addedAt: new Date().toISOString(),
          source: 'podcast-index-discovery',
          author: feed.author || feed.ownerName || undefined,
          podcastGuid: feed.podcastGuid || undefined,
        });
      }
    }
  }

  console.log(`   Fountain.fm feeds found: ${fountainTotal}`);
  console.log(`   Already in feeds.json: ${fountainTotal - newFeeds.length}`);
  console.log(`   🆕 New feeds to add: ${newFeeds.length}\n`);

  if (newFeeds.length === 0) {
    console.log('✅ No new fountain.fm feeds to add.');
    return;
  }

  // Print new feeds
  for (const feed of newFeeds) {
    console.log(`  🎵 ${feed.title} — ${feed.author || 'Unknown'}`);
    console.log(`     ${feed.originalUrl}`);
  }

  if (writeMode) {
    // Add to feeds.json
    feedsData.feeds.push(...newFeeds);
    fs.writeFileSync(feedsPath, JSON.stringify(feedsData, null, 2) + '\n');
    console.log(`\n✅ Added ${newFeeds.length} new feeds to feeds.json`);
  } else {
    console.log('\n💡 Run with --write to add these feeds to feeds.json');
    console.log('\nJSON output:');
    console.log(JSON.stringify(newFeeds, null, 2));
  }
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
