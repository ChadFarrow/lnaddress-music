#!/usr/bin/env ts-node
/**
 * Search for music feeds from fountain.fm using PodcastIndex API
 * 
 * Usage:
 *   npx ts-node scripts/search-fountain-music.ts
 *   npx ts-node scripts/search-fountain-music.ts --max 50
 */

import fetch from 'node-fetch';
import crypto from 'crypto';

// Get API credentials from environment
const PODCAST_INDEX_API_KEY = process.env.PODCAST_INDEX_API_KEY || '';
const PODCAST_INDEX_API_SECRET = process.env.PODCAST_INDEX_API_SECRET || '';
const PODCAST_INDEX_BASE_URL = 'https://api.podcastindex.org/api/1.0';

async function searchFountainMusic(maxResults = 20) {
  if (!PODCAST_INDEX_API_KEY || !PODCAST_INDEX_API_SECRET) {
    console.error('❌ PodcastIndex API credentials not configured!');
    console.log('\n📝 To use this script:');
    console.log('1. Get your API credentials from https://podcastindex.org/api');
    console.log('2. Add them to your .env.local file:');
    console.log('   PODCAST_INDEX_API_KEY=your-api-key');
    console.log('   PODCAST_INDEX_API_SECRET=your-api-secret');
    process.exit(1);
  }

  try {
    // Generate auth headers
    const apiHeaderTime = Math.floor(Date.now() / 1000);
    const hash = crypto.createHash('sha1');
    hash.update(PODCAST_INDEX_API_KEY + PODCAST_INDEX_API_SECRET + apiHeaderTime);
    const hashString = hash.digest('hex');

    console.log('🔍 Searching for music feeds from fountain.fm...\n');

    // Search for fountain.fm feeds
    const apiUrl = `${PODCAST_INDEX_BASE_URL}/search/byterm?q=fountain.fm&max=${maxResults}`;

    const response = await fetch(apiUrl, {
      headers: {
        'X-Auth-Key': PODCAST_INDEX_API_KEY,
        'X-Auth-Date': apiHeaderTime.toString(),
        'Authorization': hashString,
        'User-Agent': 'lnaddress-music-app'
      }
    });

    if (!response.ok) {
      console.error(`❌ API Error: ${response.status} ${response.statusText}`);
      process.exit(1);
    }

    const data = await response.json();

    if (!data.feeds || data.feeds.length === 0) {
      console.log('❌ No feeds found');
      return;
    }

    console.log(`✅ Found ${data.feeds.length} fountain.fm feeds\n`);

    // Filter and display results
    let musicFeedCount = 0;

    for (const feed of data.feeds) {
      const url = feed.url || '';
      const title = feed.title || 'Untitled';
      const author = feed.author || 'Unknown Artist';
      
      // Check if URL contains fountain.fm
      if (url.includes('fountain.fm')) {
        musicFeedCount++;
        
        console.log(`\n🎵 Feed #${musicFeedCount}`);
        console.log(`   Title: ${title}`);
        console.log(`   Artist: ${author}`);
        console.log(`   URL: ${url}`);
        console.log(`   Feed ID: ${feed.id}`);
        console.log(`   Score: ${feed.score || 'N/A'}`);
        
        // Extract feed GUID if available
        if (feed.podcastGuid) {
          console.log(`   GUID: ${feed.podcastGuid}`);
        }
      }
    }

    console.log(`\n📊 Summary: Found ${musicFeedCount} fountain.fm music feeds`);

    // Generate a feeds.json entry format
    if (musicFeedCount > 0) {
      console.log('\n📝 Suggested feeds.json entry:');
      console.log('---');
      
      const suggestedFeeds = data.feeds
        .filter((feed: any) => feed.url && feed.url.includes('fountain.fm'))
        .slice(0, 10) // Limit to first 10 for display
        .map((feed: any) => ({
          id: feed.id?.toString() || feed.url.split('/').pop(),
          originalUrl: feed.url,
          type: 'album' as const,
          title: feed.title || 'Fountain.fm Album',
          priority: 'extended' as const,
          status: 'active' as const
        }));

      console.log(JSON.stringify(suggestedFeeds, null, 2));
      console.log('---');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Parse command line arguments
const maxArg = process.argv.find(arg => arg.startsWith('--max='));
const maxResults = maxArg ? parseInt(maxArg.split('=')[1]) : 20;

searchFountainMusic(maxResults);

