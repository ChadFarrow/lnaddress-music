import { NextResponse } from 'next/server';
import { AlbumService } from '@/lib/album-service';

export const dynamic = 'force-dynamic';

/**
 * Primary albums endpoint - uses unified album service with database priority
 * Automatically falls back to static file if database is unavailable
 */
export async function GET() {
  try {
    const result = await AlbumService.getAlbums({
      preferredSource: 'database' // Try database first, then fallback chain
    });

    const response = NextResponse.json(result);
    response.headers.set('Cache-Control', 'public, max-age=180, s-maxage=300');
    return response;
  } catch (error) {
    console.error('Error in albums endpoint:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch albums',
        details: error instanceof Error ? error.message : 'Unknown error',
        albums: [],
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
