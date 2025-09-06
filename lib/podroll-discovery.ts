import { RSSParser } from './rss-parser';
import { getAllFeeds, addFeed } from './db';

interface PodrollDiscoveryOptions {
  autoAdd?: boolean;
  recursive?: boolean;
  maxDepth?: number;
  priority?: 'core' | 'extended' | 'low';
}

interface DiscoveredFeed {
  url: string;
  title: string;
  artist: string;
  hasAlbum: boolean;
  trackCount: number;
  podrollCount: number;
  alreadyExists: boolean;
  source: 'podroll' | 'recursive';
  discoveredFrom: string;
  error?: string;
}

// Helper to normalize URLs for comparison
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.href.replace(/\/$/, '').toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

// Generate feed ID from URL
function generateFeedId(url: string): string {
  try {
    const parsed = new URL(url);
    const parts = [
      parsed.hostname.replace(/\./g, '-'),
      ...parsed.pathname.split('/').filter(p => p)
    ];
    return parts.join('-').toLowerCase().replace(/[^a-z0-9-]/g, '-');
  } catch {
    return url.replace(/[^a-z0-9-]/g, '-').toLowerCase();
  }
}

/**
 * Discover and optionally add podroll feeds from a given feed URL
 */
export async function discoverPodrollFeeds(
  feedUrl: string, 
  options: PodrollDiscoveryOptions = {}
): Promise<{
  discovered: DiscoveredFeed[];
  added: string[];
  stats: {
    total: number;
    new: number;
    existing: number;
    errors: number;
    added: number;
  };
}> {
  const {
    autoAdd = false,
    recursive = true,
    maxDepth = 2,
    priority = 'extended'
  } = options;

  const discovered: DiscoveredFeed[] = [];
  const processed = new Set<string>();
  const queue: { url: string; currentDepth: number; discoveredFrom: string }[] = [
    { url: feedUrl, currentDepth: 0, discoveredFrom: feedUrl }
  ];

  // Get existing feeds for comparison
  const existingFeeds = await getAllFeeds();
  const existingUrls = new Set(
    existingFeeds.map(f => normalizeUrl(f.original_url))
  );

  console.log(`🔍 Starting podroll discovery for: ${feedUrl}`);

  while (queue.length > 0) {
    const { url: currentUrl, currentDepth, discoveredFrom } = queue.shift()!;
    const normalizedUrl = normalizeUrl(currentUrl);

    // Skip if already processed or if it's the original feed (for depth > 0)
    if (processed.has(normalizedUrl) || (currentDepth > 0 && normalizedUrl === normalizeUrl(feedUrl))) {
      continue;
    }
    processed.add(normalizedUrl);

    try {
      console.log(`📡 Parsing feed: ${currentUrl} (depth: ${currentDepth})`);
      
      // Parse the feed
      const albumData = await RSSParser.parseAlbumFeed(currentUrl);
      
      if (!albumData) {
        if (currentDepth > 0) { // Only log errors for discovered feeds, not the original
          discovered.push({
            url: currentUrl,
            title: 'Unknown',
            artist: 'Unknown',
            hasAlbum: false,
            trackCount: 0,
            podrollCount: 0,
            alreadyExists: existingUrls.has(normalizedUrl),
            source: currentDepth === 1 ? 'podroll' : 'recursive',
            discoveredFrom,
            error: 'Failed to parse feed'
          });
        }
        continue;
      }

      // Only add to discovered list if this is a podroll feed (depth > 0)
      if (currentDepth > 0) {
        const feedInfo: DiscoveredFeed = {
          url: currentUrl,
          title: albumData.title || 'Unknown',
          artist: albumData.artist || 'Unknown',
          hasAlbum: true,
          trackCount: albumData.tracks?.length || 0,
          podrollCount: albumData.podroll?.length || 0,
          alreadyExists: existingUrls.has(normalizedUrl),
          source: currentDepth === 1 ? 'podroll' : 'recursive',
          discoveredFrom
        };

        discovered.push(feedInfo);
      }

      // If recursive and not at max depth, add podroll items to queue
      if (recursive && currentDepth < maxDepth && albumData.podroll) {
        for (const podrollItem of albumData.podroll) {
          if (podrollItem.url && !processed.has(normalizeUrl(podrollItem.url))) {
            queue.push({ 
              url: podrollItem.url, 
              currentDepth: currentDepth + 1,
              discoveredFrom: currentDepth === 0 ? feedUrl : discoveredFrom
            });
          }
        }
      }

    } catch (error) {
      console.error(`Error processing feed ${currentUrl}:`, error);
      if (currentDepth > 0) { // Only log errors for discovered feeds
        discovered.push({
          url: currentUrl,
          title: 'Unknown',
          artist: 'Unknown',
          hasAlbum: false,
          trackCount: 0,
          podrollCount: 0,
          alreadyExists: existingUrls.has(normalizedUrl),
          source: currentDepth === 1 ? 'podroll' : 'recursive',
          discoveredFrom,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  // Automatically add new feeds if requested
  const added: string[] = [];
  if (autoAdd) {
    for (const feed of discovered) {
      if (!feed.alreadyExists && feed.hasAlbum && !feed.error) {
        try {
          const result = await addFeed(
            feed.url,
            'album',
            `${feed.title} by ${feed.artist}`,
            {
              priority,
              source: feed.source,
              discoveredFrom: feed.discoveredFrom
            }
          );
          
          if (result.success) {
            added.push(feed.url);
            console.log(`✅ Added podroll feed: ${feed.title} by ${feed.artist}`);
          } else {
            console.error(`Failed to add feed ${feed.url}: ${result.error}`);
          }
        } catch (error) {
          console.error(`Failed to add feed ${feed.url}:`, error);
        }
      }
    }
  }

  const stats = {
    total: discovered.length,
    new: discovered.filter(d => !d.alreadyExists && d.hasAlbum && !d.error).length,
    existing: discovered.filter(d => d.alreadyExists).length,
    errors: discovered.filter(d => d.error).length,
    added: added.length
  };

  console.log(`📊 Podroll discovery completed:`, stats);

  return {
    discovered,
    added,
    stats
  };
}

/**
 * Discover podroll feeds for all existing feeds that don't have podroll sources tracked
 */
export async function discoverAllPodrollFeeds(options: PodrollDiscoveryOptions = {}) {
  const feeds = await getAllFeeds();
  const results = [];
  
  console.log(`🚀 Starting bulk podroll discovery for ${feeds.length} feeds`);
  
  for (const feed of feeds) {
    console.log(`Processing feed: ${feed.title}`);
    try {
      const result = await discoverPodrollFeeds(feed.original_url, options);
      results.push({
        feedUrl: feed.original_url,
        feedTitle: feed.title,
        ...result
      });
    } catch (error) {
      console.error(`Failed to discover podroll for ${feed.original_url}:`, error);
      results.push({
        feedUrl: feed.original_url,
        feedTitle: feed.title,
        discovered: [],
        added: [],
        stats: { total: 0, new: 0, existing: 0, errors: 1, added: 0 },
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  return results;
}