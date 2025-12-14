import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { addFeed, getAllFeeds, DBFeed } from '@/lib/db';
import { RSSParser } from '@/lib/rss-parser';

const PODCAST_INDEX_API_KEY = process.env.PODCAST_INDEX_API_KEY || '';
const PODCAST_INDEX_API_SECRET = process.env.PODCAST_INDEX_API_SECRET || '';
const PODCAST_INDEX_BASE_URL = 'https://api.podcastindex.org/api/1.0';

/**
 * Cron job endpoint to refresh feeds and discover new Fountain.fm music
 *
 * Runs daily at 6 AM UTC (configured in vercel.json)
 *
 * GET /api/cron/refresh-feeds
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // Verify cron secret (Vercel sends this automatically for cron jobs)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.log('Unauthorized cron request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('🕐 Starting scheduled feed refresh...');

  const results = {
    timestamp: new Date().toISOString(),
    discovery: {
      searched: false,
      found: 0,
      added: 0,
      skipped: 0,
      errors: [] as string[]
    },
    podrollDiscovery: {
      publishersChecked: 0,
      newAlbumsFound: 0,
      added: 0,
      errors: [] as string[]
    },
    parsing: {
      success: false,
      totalFeeds: 0,
      successfulParses: 0,
      failedParses: 0,
      error: null as string | null
    },
    duration: 0
  };

  // Step 1: Discover new Fountain.fm feeds
  if (PODCAST_INDEX_API_KEY && PODCAST_INDEX_API_SECRET) {
    try {
      console.log('🔍 Discovering new Fountain.fm music feeds...');
      results.discovery.searched = true;

      // Get existing feeds to avoid duplicates
      const existingFeeds = await getAllFeeds();
      const existingUrls = new Set(existingFeeds.map(f => f.original_url.toLowerCase()));

      // Generate PodcastIndex auth headers
      const apiHeaderTime = Math.floor(Date.now() / 1000);
      const hash = createHash('sha1');
      hash.update(PODCAST_INDEX_API_KEY + PODCAST_INDEX_API_SECRET + apiHeaderTime);
      const hashString = hash.digest('hex');

      // Search for fountain.fm feeds
      const response = await fetch(
        `${PODCAST_INDEX_BASE_URL}/search/byterm?q=fountain.fm&max=100`,
        {
          headers: {
            'X-Auth-Key': PODCAST_INDEX_API_KEY,
            'X-Auth-Date': apiHeaderTime.toString(),
            'Authorization': hashString,
            'User-Agent': 'lnaddress-music-cron'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        const allFeeds = data.feeds || [];

        // Filter to fountain.fm feeds with music medium
        const fountainMusicFeeds = allFeeds.filter((feed: any) => {
          const url = (feed.url || '').toLowerCase();
          const medium = (feed.medium || '').toLowerCase();
          return url.includes('fountain.fm') && (medium === 'music' || medium === 'musicl');
        });

        results.discovery.found = fountainMusicFeeds.length;
        console.log(`📻 Found ${fountainMusicFeeds.length} Fountain.fm music feeds`);

        // Add new feeds
        for (const feed of fountainMusicFeeds) {
          const feedUrl = feed.url?.toLowerCase();
          if (!feedUrl || existingUrls.has(feedUrl)) {
            results.discovery.skipped++;
            continue;
          }

          try {
            const addResult = await addFeed(
              feed.url,
              'album',
              feed.title || 'Fountain.fm Album',
              {
                priority: 'extended',
                source: 'podroll',
                discoveredFrom: 'https://podcastindex.org'
              }
            );

            if (addResult.success) {
              results.discovery.added++;
              existingUrls.add(feedUrl); // Prevent duplicates in same run
              console.log(`✅ Added new feed: ${feed.title}`);
            } else if (addResult.error !== 'Feed already exists') {
              results.discovery.errors.push(`${feed.title}: ${addResult.error}`);
            } else {
              results.discovery.skipped++;
            }
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown error';
            results.discovery.errors.push(`${feed.title}: ${errorMsg}`);
          }
        }
      } else {
        results.discovery.errors.push(`PodcastIndex API error: ${response.status}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      results.discovery.errors.push(`Discovery failed: ${errorMsg}`);
      console.error('Discovery error:', error);
    }
  } else {
    console.log('⚠️ PodcastIndex API credentials not configured, skipping discovery');
  }

  // Step 2: Discover new albums from publisher feeds (podcast:remoteItem medium="music")
  try {
    console.log('🔍 Checking publisher feeds for new albums...');
    const existingFeeds = await getAllFeeds();
    const publisherFeeds = existingFeeds.filter((f: DBFeed) => f.type === 'publisher');
    const existingUrls = new Set(existingFeeds.map(f => f.original_url.toLowerCase()));

    results.podrollDiscovery.publishersChecked = publisherFeeds.length;
    console.log(`📚 Checking ${publisherFeeds.length} publisher feeds for new albums`);

    for (const publisher of publisherFeeds) {
      try {
        // Use parsePublisherFeed to get album URLs from <podcast:remoteItem medium="music">
        const publisherItems = await RSSParser.parsePublisherFeed(publisher.original_url);

        console.log(`📻 Found ${publisherItems.length} album items in ${publisher.title}`);

        for (const item of publisherItems) {
          const feedUrl = item.feedUrl;
          if (!feedUrl || existingUrls.has(feedUrl.toLowerCase())) {
            continue; // Skip if no URL or already exists
          }

          results.podrollDiscovery.newAlbumsFound++;

          try {
            const addResult = await addFeed(
              feedUrl,
              'album',
              item.title || 'Discovered Album',
              {
                priority: 'extended',
                source: 'podroll',
                discoveredFrom: publisher.original_url
              }
            );

            if (addResult.success) {
              results.podrollDiscovery.added++;
              existingUrls.add(feedUrl.toLowerCase()); // Prevent duplicates in same run
              console.log(`✅ Added album: ${item.title} from ${publisher.title}`);
            } else if (addResult.error !== 'Feed already exists') {
              results.podrollDiscovery.errors.push(`${item.title}: ${addResult.error}`);
            }
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown error';
            results.podrollDiscovery.errors.push(`${item.title}: ${errorMsg}`);
          }
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        results.podrollDiscovery.errors.push(`${publisher.title}: ${errorMsg}`);
      }
    }

    console.log(`📊 Publisher discovery: found ${results.podrollDiscovery.newAlbumsFound} new, added ${results.podrollDiscovery.added}`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    results.podrollDiscovery.errors.push(`Publisher discovery failed: ${errorMsg}`);
    console.error('Publisher discovery error:', error);
  }

  // Step 3: Skip file-based parsing on Vercel (read-only filesystem)
  // Feed data is fetched fresh on each request, so no parsing needed here
  results.parsing = {
    success: true,
    totalFeeds: 0,
    successfulParses: 0,
    failedParses: 0,
    error: 'Skipped - Vercel has read-only filesystem. Feeds are parsed on-demand.'
  };
  console.log('ℹ️ Skipping file-based parsing (Vercel read-only filesystem)');

  results.duration = Date.now() - startTime;

  console.log(`🏁 Feed refresh complete in ${results.duration}ms`);
  console.log(`   - PodcastIndex: ${results.discovery.found} feeds found, ${results.discovery.added} added`);
  console.log(`   - Publisher podrolls: ${results.podrollDiscovery.publishersChecked} checked, ${results.podrollDiscovery.added} new albums added`);
  console.log(`   - Parsed: ${results.parsing.successfulParses}/${results.parsing.totalFeeds} feeds`);

  return NextResponse.json({
    success: true,
    message: 'Feed refresh complete',
    results
  });
}

// Vercel cron config - runs daily at 6 AM UTC
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max for cron jobs
