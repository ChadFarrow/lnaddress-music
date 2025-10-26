import { NextRequest, NextResponse } from 'next/server';
import { AlbumService, AlbumDataSource } from '@/lib/album-service';

export const dynamic = 'force-dynamic';

/**
 * Unified Albums API Endpoint
 *
 * Query parameters:
 * - source: 'database' | 'static-file' | 'direct-rss' | 'parsed-feeds' | 'fallback'
 * - bypass-cache: 'true' to bypass in-memory cache
 * - regenerate: 'true' to regenerate static file
 * - clear-cache: 'true' to clear cache
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Handle cache clearing
    if (searchParams.get('clear-cache') === 'true') {
      AlbumService.clearCache();
      return NextResponse.json({
        message: 'Cache cleared successfully',
        timestamp: new Date().toISOString()
      });
    }

    // Handle static file regeneration
    if (searchParams.get('regenerate') === 'true') {
      console.log('🔄 Regenerating static albums file...');
      await AlbumService.generateStaticFile();
      return NextResponse.json({
        message: 'Static file regenerated successfully',
        timestamp: new Date().toISOString()
      });
    }

    // Get albums
    const preferredSource = searchParams.get('source') as AlbumDataSource | null;
    const bypassCache = searchParams.get('bypass-cache') === 'true';

    const result = await AlbumService.getAlbums({
      preferredSource: preferredSource || undefined,
      bypassCache
    });

    const response = NextResponse.json(result);

    // Set cache headers based on source
    if (result.source === 'static-file') {
      // Aggressive caching for static files
      response.headers.set('Cache-Control', 'public, max-age=3600, s-maxage=7200, stale-while-revalidate=86400');
    } else if (result.source === 'fallback') {
      // Short cache for fallback
      response.headers.set('Cache-Control', 'public, max-age=60, s-maxage=120');
    } else {
      // Standard caching for dynamic sources
      response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=600, stale-while-revalidate=1800');
    }

    return response;
  } catch (error) {
    console.error('Error in unified albums endpoint:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch albums',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
