import { NextRequest, NextResponse } from 'next/server';
import { FeedManager } from '@/lib/feed-manager';
import { RSSParser } from '@/lib/rss-parser';

// Dynamic, with a 5 minute CDN cache (Cache-Control below), not ISR.
// The parser fetches feeds through lib/feed-fetch.ts, and its guard forces
// `cache: 'no-store'` on every request (so Next's data cache cannot read a body
// past the size cap). A no-store fetch in an ISR route (`revalidate = 300`)
// throws Next's dynamic-usage bailout inside the parser. The parser caught it
// and retried each feed, so the build prerender of this route ran past Next's
// 60 s limit and the build failed. Any route that reaches the parser must be
// force-dynamic.
export const dynamic = 'force-dynamic';
// The build used to do the parse (180 feeds in a row, about 23 s locally on
// 2026-11-25). Now a request after each CDN miss does it, so give it the same
// limit as /api/cron/refresh-feeds.
export const maxDuration = 300;

// The browser revalidates every time, as with ISR before; the Vercel CDN keeps
// the answer for 300 s and serves the old one while it fetches a new one.
const CACHE_CONTROL = 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600';

export async function GET(request: NextRequest) {
  console.log('🔄 Parsing albums without database dependency...');
  
  try {
    // Get feeds directly from FeedManager (uses feeds.json, no database)
    const feeds = FeedManager.getActiveFeeds();
    const albumFeeds = feeds.filter(feed => feed.type === 'album');
    
    console.log(`📡 Processing ${albumFeeds.length} album feeds...`);
    
    const albums = [];
    const errors = [];
    
    for (const feed of albumFeeds) {
      try {
        console.log(`🎵 Parsing: ${feed.title}`);
        
        // Add delay for Wavlake feeds to avoid rate limiting
        if (feed.originalUrl.includes('wavlake.com')) {
          await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay for Wavlake
        }
        
        const albumData = await RSSParser.parseAlbumFeed(feed.originalUrl);
        
        if (albumData) {
          // Add feed metadata
          const enrichedAlbum = {
            ...albumData,
            feedId: feed.id,
            feedUrl: feed.originalUrl,
            lastUpdated: feed.lastUpdated
          };
          
          albums.push(enrichedAlbum);
          console.log(`✅ Parsed: ${albumData.title} ${albumData.publisher ? '(with publisher)' : '(no publisher)'}`);
        } else {
          console.warn(`⚠️ No data returned for ${feed.title}`);
          errors.push({
            feedId: feed.id,
            error: 'No album data returned'
          });
        }
      } catch (error) {
        console.error(`❌ Error parsing ${feed.title}:`, error);
        errors.push({
          feedId: feed.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    console.log(`🎉 Successfully parsed ${albums.length} albums (${errors.length} errors)`);
    
    return NextResponse.json({
      albums,
      count: albums.length,
      errors,
      timestamp: new Date().toISOString(),
      source: 'direct-rss-parsing'
    }, {
      headers: { 'Cache-Control': CACHE_CONTROL }
    });
    
  } catch (error) {
    console.error('❌ Error in albums-no-db endpoint:', error);
    return NextResponse.json({
      error: 'Failed to parse albums',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}