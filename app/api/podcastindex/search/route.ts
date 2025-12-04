import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const PODCAST_INDEX_API_KEY = process.env.PODCAST_INDEX_API_KEY || '';
const PODCAST_INDEX_API_SECRET = process.env.PODCAST_INDEX_API_SECRET || '';
const PODCAST_INDEX_BASE_URL = 'https://api.podcastindex.org/api/1.0';

/**
 * Search for feeds using PodcastIndex API
 * Supports search by term, platform (like fountain.fm), and medium (like music)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || searchParams.get('query');
    const platform = searchParams.get('platform');
    const medium = searchParams.get('medium');
    const max = parseInt(searchParams.get('max') || '20');
    
    if (!query && !platform && !medium) {
      return NextResponse.json(
        { error: 'At least one search parameter (q, platform, or medium) is required' },
        { status: 400 }
      );
    }

    if (!PODCAST_INDEX_API_KEY || !PODCAST_INDEX_API_SECRET) {
      return NextResponse.json(
        { 
          error: 'PodcastIndex API credentials not configured',
          message: 'Add PODCAST_INDEX_API_KEY and PODCAST_INDEX_API_SECRET to your environment variables'
        },
        { status: 400 }
      );
    }

    // Generate auth headers for PodcastIndex
    const apiHeaderTime = Math.floor(Date.now() / 1000);
    const hash = crypto.createHash('sha1');
    hash.update(PODCAST_INDEX_API_KEY + PODCAST_INDEX_API_SECRET + apiHeaderTime);
    const hashString = hash.digest('hex');

    // Build search query
    let searchQuery = '';
    if (query) {
      searchQuery = query;
    } else if (platform) {
      searchQuery = platform;
    } else if (medium) {
      searchQuery = medium;
    }

    // Use the PodcastIndex search API
    const apiUrl = `${PODCAST_INDEX_BASE_URL}/search/byterm?q=${encodeURIComponent(searchQuery)}&max=${max}`;

    console.log(`🔍 Searching PodcastIndex for: ${searchQuery}`);

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

    // Filter results to match criteria
    let results = data.feeds || [];

    // Filter by platform if specified
    if (platform) {
      const normalizedPlatform = platform.toLowerCase().replace(/\./g, '');
      results = results.filter((feed: any) => {
        // Check if feed URL contains the platform domain
        const feedUrl = (feed.url || '').toLowerCase();
        return feedUrl.includes(normalizedPlatform);
      });
    }

    // Filter by medium if specified
    if (medium) {
      results = results.filter((feed: any) => {
        // Check if feed has the specified medium
        // PodcastIndex might store this in category or other fields
        const categories = (feed.categories || {}) as Record<string, string[]>;
        const categoryValues = Object.values(categories).flat();
        return categoryValues.includes(medium) || 
               (feed.medium && feed.medium.toLowerCase() === medium.toLowerCase());
      });
    }

    // Format results to include relevant information
    const formattedResults = results.map((feed: any) => ({
      id: feed.id,
      title: feed.title,
      author: feed.author,
      description: feed.description,
      url: feed.url,
      podcastGuid: feed.podcastGuid,
      image: feed.image,
      artwork: feed.artwork,
      feedGuid: feed.feedGuid,
      link: feed.link,
      ownerName: feed.ownerName,
      ownerEmail: feed.ownerEmail,
      // Include payment value info if available
      value: feed.value,
      categories: feed.categories,
      // Score indicates relevance
      score: feed.score || 0
    }));

    return NextResponse.json({
      success: true,
      query: searchQuery,
      platform: platform || null,
      medium: medium || null,
      total: formattedResults.length,
      results: formattedResults
    });

  } catch (error) {
    console.error('PodcastIndex search error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to search PodcastIndex',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

