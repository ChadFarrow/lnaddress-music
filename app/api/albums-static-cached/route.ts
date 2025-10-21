import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // Use pre-parsed feed data from data/parsed-feeds.json
    const parsedFeedsPath = path.join(process.cwd(), 'data', 'parsed-feeds.json');

    // Check if parsed feeds file exists
    if (!fs.existsSync(parsedFeedsPath)) {
      return NextResponse.json({
        error: 'Parsed feed data not found. Run the feed parser to generate data.'
      }, { status: 404 });
    }

    // Read and return the pre-parsed data
    const parsedData = JSON.parse(fs.readFileSync(parsedFeedsPath, 'utf-8'));

    // Extract albums from feeds
    const albums = parsedData.feeds
      ?.filter((feed: any) => feed.parsedData?.album)
      .map((feed: any) => feed.parsedData.album) || [];

    // Calculate total tracks
    const totalTracks = albums.reduce((sum: number, album: any) =>
      sum + (album.tracks?.length || 0), 0);

    // Transform to expected API format
    const response = {
      albums,
      metadata: {
        totalAlbums: albums.length,
        totalTracks,
        servedFrom: 'pre-parsed-feeds',
        servedAt: new Date().toISOString(),
        parseTimestamp: parsedData.lastUpdated || null
      }
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400', // Cache for 1 hour, serve stale for 24 hours
      }
    });

  } catch (error) {
    console.error('❌ Error serving albums:', error);
    return NextResponse.json({
      error: 'Failed to load album data',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}