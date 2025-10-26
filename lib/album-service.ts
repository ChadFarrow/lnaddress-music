/**
 * Unified Album Service
 * Consolidates all album data fetching strategies into a single service
 */

import { RSSParser } from '@/lib/rss-parser';
import { getAllFeeds, initializeDatabase } from '@/lib/db';
import { FeedManager } from '@/lib/feed-manager';
import { cleanImageUrl } from '@/lib/image-utils';
import fs from 'fs';
import path from 'path';

export interface Album {
  title: string;
  artist: string;
  description?: string;
  coverArt: string | null;
  tracks: Track[];
  releaseDate?: string;
  feedId?: string;
  feedUrl?: string;
  lastUpdated?: string;
  publisher?: any;
}

export interface Track {
  title: string;
  duration?: string;
  url?: string; // Optional to match RSSTrack
  trackNumber?: number;
  image?: string | null;
}

export interface AlbumResponse {
  albums: Album[];
  count: number;
  timestamp: string;
  cached?: boolean;
  cacheAge?: number;
  source?: string;
  errors?: Array<{ feedId: string; error: string }>;
  fallback?: boolean;
}

export type AlbumDataSource = 'database' | 'static-file' | 'direct-rss' | 'parsed-feeds' | 'fallback';

// In-memory cache
let albumsCache: AlbumResponse | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export class AlbumService {
  /**
   * Main method to fetch albums with automatic fallback chain
   */
  static async getAlbums(options: {
    preferredSource?: AlbumDataSource;
    bypassCache?: boolean;
  } = {}): Promise<AlbumResponse> {
    const { preferredSource, bypassCache = false } = options;

    // Check cache first (unless bypassed)
    if (!bypassCache && albumsCache && (Date.now() - cacheTimestamp) < CACHE_TTL) {
      return {
        ...albumsCache,
        cached: true,
        cacheAge: Math.round((Date.now() - cacheTimestamp) / 1000)
      };
    }

    // Try sources in order based on preference
    const sources: AlbumDataSource[] = preferredSource
      ? [preferredSource, 'static-file', 'parsed-feeds', 'direct-rss', 'fallback']
      : ['static-file', 'parsed-feeds', 'database', 'direct-rss', 'fallback'];

    let lastError: Error | null = null;

    for (const source of sources) {
      try {
        let result: AlbumResponse;

        switch (source) {
          case 'database':
            result = await this.fetchFromDatabase();
            break;
          case 'static-file':
            result = await this.fetchFromStaticFile();
            break;
          case 'direct-rss':
            result = await this.fetchFromDirectRSS();
            break;
          case 'parsed-feeds':
            result = await this.fetchFromParsedFeeds();
            break;
          case 'fallback':
            result = this.getFallbackData();
            break;
          default:
            continue;
        }

        // Cache successful result
        albumsCache = result;
        cacheTimestamp = Date.now();

        return {
          ...result,
          cached: false
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`⚠️ Failed to fetch from ${source}:`, lastError.message);
        continue;
      }
    }

    // If all sources failed, return error
    throw lastError || new Error('All album data sources failed');
  }

  /**
   * Fetch albums from database
   */
  private static async fetchFromDatabase(): Promise<AlbumResponse> {
    await initializeDatabase();
    const dbFeeds = await getAllFeeds();

    const albums: Album[] = [];
    const errors: Array<{ feedId: string; error: string }> = [];

    for (const feed of dbFeeds) {
      if (feed.status === 'active') {
        try {
          const album = await RSSParser.parseAlbumFeed(feed.original_url);
          if (album) {
            album.coverArt = cleanImageUrl(album.coverArt) || null;
            album.tracks.forEach(track => {
              track.image = cleanImageUrl(track.image);
            });

            album.feedId = feed.id;
            album.feedUrl = feed.original_url;
            album.lastUpdated = feed.last_updated.toISOString();
            albums.push(album);
          }
        } catch (error) {
          errors.push({
            feedId: feed.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }

    return {
      albums,
      count: albums.length,
      timestamp: new Date().toISOString(),
      source: 'database',
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Fetch albums from static JSON file
   */
  private static async fetchFromStaticFile(): Promise<AlbumResponse> {
    const staticDataPath = path.join(process.cwd(), 'public', 'static-albums.json');

    if (!fs.existsSync(staticDataPath)) {
      throw new Error('Static albums file not found');
    }

    const staticData = JSON.parse(fs.readFileSync(staticDataPath, 'utf8'));

    return {
      albums: staticData.albums || [],
      count: staticData.albums?.length || 0,
      timestamp: staticData.timestamp || new Date().toISOString(),
      source: 'static-file'
    };
  }

  /**
   * Fetch albums by parsing RSS feeds directly (no database)
   */
  private static async fetchFromDirectRSS(): Promise<AlbumResponse> {
    const feeds = FeedManager.getActiveFeeds();
    const albumFeeds = feeds.filter(feed => feed.type === 'album');

    const albums: Album[] = [];
    const errors: Array<{ feedId: string; error: string }> = [];

    for (const feed of albumFeeds) {
      try {
        // Add delay for rate-limited sources
        if (feed.originalUrl.includes('wavlake.com')) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        const albumData = await RSSParser.parseAlbumFeed(feed.originalUrl);

        if (albumData) {
          albums.push({
            ...albumData,
            feedId: feed.id,
            feedUrl: feed.originalUrl,
            lastUpdated: feed.lastUpdated
          });
        } else {
          errors.push({
            feedId: feed.id,
            error: 'No album data returned'
          });
        }
      } catch (error) {
        errors.push({
          feedId: feed.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return {
      albums,
      count: albums.length,
      timestamp: new Date().toISOString(),
      source: 'direct-rss',
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Fetch albums from pre-parsed feed data
   */
  private static async fetchFromParsedFeeds(): Promise<AlbumResponse> {
    const parsedFeedsPath = path.join(process.cwd(), 'data', 'parsed-feeds.json');

    if (!fs.existsSync(parsedFeedsPath)) {
      throw new Error('Parsed feeds file not found');
    }

    const parsedData = JSON.parse(fs.readFileSync(parsedFeedsPath, 'utf-8'));
    const albums = parsedData.feeds
      ?.filter((feed: any) => feed.parsedData?.album)
      .map((feed: any) => feed.parsedData.album) || [];

    return {
      albums,
      count: albums.length,
      timestamp: parsedData.lastUpdated || new Date().toISOString(),
      source: 'parsed-feeds'
    };
  }

  /**
   * Get hardcoded fallback data
   */
  private static getFallbackData(): AlbumResponse {
    const fallbackAlbums: Album[] = [
      {
        title: "Bloodshot Lies",
        artist: "Doerfel Family",
        description: "The album",
        coverArt: "/bloodshot-lies-big.png",
        tracks: [
          {
            title: "Bloodshot Lies",
            duration: "3:45",
            url: "https://www.doerfelverse.com/audio/bloodshot-lies.mp3",
            trackNumber: 1
          }
        ],
        releaseDate: "2024-01-01",
        feedId: "fallback"
      }
    ];

    return {
      albums: fallbackAlbums,
      count: fallbackAlbums.length,
      timestamp: new Date().toISOString(),
      source: 'fallback',
      fallback: true
    };
  }

  /**
   * Clear the in-memory cache
   */
  static clearCache(): void {
    albumsCache = null;
    cacheTimestamp = 0;
  }

  /**
   * Generate and save static albums file
   */
  static async generateStaticFile(): Promise<void> {
    const result = await this.fetchFromDirectRSS();
    const staticDataPath = path.join(process.cwd(), 'public', 'static-albums.json');

    fs.writeFileSync(staticDataPath, JSON.stringify({
      albums: result.albums,
      count: result.count,
      timestamp: result.timestamp,
      generated: true,
      generatedAt: new Date().toISOString()
    }, null, 2));
  }
}
