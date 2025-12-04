import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const PODCAST_INDEX_API_KEY = process.env.PODCAST_INDEX_API_KEY || '';
const PODCAST_INDEX_API_SECRET = process.env.PODCAST_INDEX_API_SECRET || '';
const PODCAST_INDEX_BASE_URL = 'https://api.podcastindex.org/api/1.0';

/**
 * Discover music feeds from fountain.fm using PodcastIndex API
 * 
 * GET /api/discover/fountain-music?max=20
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const max = parseInt(searchParams.get('max') || '20');

    if (!PODCAST_INDEX_API_KEY || !PODCAST_INDEX_API_SECRET) {
      return NextResponse.json(
        { 
          error: 'PodcastIndex API credentials not configured',
          message: 'Add PODCAST_INDEX_API_KEY and PODCAST_INDEX_API_SECRET to your environment variables',
          setupUrl: 'https://podcastindex.org/api'
        },
        { status: 400 }
      );
    }

    // Generate auth headers for PodcastIndex
    const apiHeaderTime = Math.floor(Date.now() / 1000);
    const hash = crypto.createHash('sha1');
    hash.update(PODCAST_INDEX_API_KEY + PODCAST_INDEX_API_SECRET + apiHeaderTime);
    const hashString = hash.digest('hex');

    console.log('🔍 Searching PodcastIndex for fountain.fm music feeds...');

    // Search for fountain.fm feeds
    const apiUrl = `${PODCAST_INDEX_BASE_URL}/search/byterm?q=fountain.fm&max=${max}`;

    // Fetch from PodcastIndex
    const response = await fetch(apiUrl, {
      headers: {
        'X-Auth-Key': PODCAST_INDEX_API_KEY,
        'X-Auth-Date': apiHeaderTime.toString(),
        'Authorization': hashString,
        'User-Agent': 'lnaddress-music-app'
      }
    });

    if (!response.ok) {
      console.error(`PodcastIndex API error: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { error: `PodcastIndex API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const allFeeds = data.feeds || [];

    // Filter to only fountain.fm feeds
    const fountainFeeds = allFeeds.filter((feed: any) => {
      const url = (feed.url || '').toLowerCase();
      return url.includes('fountain.fm');
    });

    console.log(`✅ Found ${fountainFeeds.length} fountain.fm music feeds`);

    // Format results
    const formattedFeeds = fountainFeeds.map((feed: any) => ({
      id: feed.id,
      title: feed.title || 'Untitled Album',
      artist: feed.author || feed.ownerName || 'Unknown Artist',
      description: feed.description,
      url: feed.url,
      podcastGuid: feed.podcastGuid,
      image: feed.image || feed.artwork,
      feedGuid: feed.feedGuid,
      link: feed.link,
      // Include Lightning payment info if available
      value: feed.value,
      categories: feed.categories,
      score: feed.score || 0,
      lastUpdateTime: feed.lastUpdateTime,
      // Format for easy addition to feeds.json
      feedConfig: {
        id: feed.id?.toString() || generateId(feed.url),
        originalUrl: feed.url,
        type: 'album' as const,
        title: feed.title || 'Fountain.fm Album',
        priority: 'extended' as const,
        status: 'active' as const,
        source: 'podcastindex' as const,
        discoveredFrom: 'https://podcastindex.org'
      }
    }));

    return NextResponse.json({
      success: true,
      total: formattedFeeds.length,
      feeds: formattedFeeds,
      // Include instructions for adding feeds
      instructions: {
        addToFeedsJson: 'Copy the feedConfig objects from the feeds array and add them to data/feeds.json',
        apiEndpoint: '/api/admin/feeds',
        method: 'POST',
        bodyFormat: '{ "url": "feed-url", "type": "album", "discoverPodroll": true }'
      }
    });

  } catch (error) {
    console.error('Fountain music discovery error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to discover fountain.fm music feeds',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Generate a simple ID from URL
 */
function generateId(url: string): string {
  try {
    // Extract the last part of the URL path
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    return pathParts[pathParts.length - 1] || 'feed-' + Date.now();
  } catch {
    return 'feed-' + Date.now();
  }
}

