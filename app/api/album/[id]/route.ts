import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const albumId = decodeURIComponent(id);

    console.log(`🔍 Looking for album: "${albumId}"`);

    // Use pre-parsed feed data from data/parsed-feeds.json
    const parsedFeedsPath = path.join(process.cwd(), 'data', 'parsed-feeds.json');

    if (!fs.existsSync(parsedFeedsPath)) {
      return NextResponse.json({
        error: 'Parsed feed data not found. Run the feed parser to generate data.'
      }, { status: 404 });
    }

    const parsedData = JSON.parse(fs.readFileSync(parsedFeedsPath, 'utf-8'));

    // Helper function to create URL slug
    const createSlug = (title: string) =>
      title.toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');

    // Find matching album from pre-parsed data
    const matchingFeed = parsedData.feeds.find((feed: any) => {
      const album = feed.parsedData?.album;
      if (!album?.title) return false;

      // Try multiple matching strategies
      const titleMatch = album.title.toLowerCase() === albumId.toLowerCase();
      const slugMatch = createSlug(album.title) === albumId.toLowerCase();
      const compatMatch = album.title.toLowerCase().replace(/\s+/g, '-') === albumId.toLowerCase();

      // Flexible matching for base title
      const baseTitle = album.title.toLowerCase().split(/\s*[-–]\s*/)[0];
      const baseTitleSlug = createSlug(baseTitle);
      const flexibleMatch = baseTitleSlug === albumId.toLowerCase();

      return titleMatch || slugMatch || compatMatch || flexibleMatch;
    });

    if (!matchingFeed?.parsedData?.album) {
      console.log(`❌ No matching album found for: "${albumId}"`);
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }

    const album = matchingFeed.parsedData.album;
    console.log(`✅ Found album: "${album.title}"`);

    const response = NextResponse.json({
      album,
      timestamp: new Date().toISOString(),
      source: 'pre-parsed-feeds',
      parseTimestamp: parsedData.lastUpdated
    });

    // Cache for 1 hour, serve stale for 24 hours
    response.headers.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    return response;

  } catch (error) {
    console.error('❌ Error fetching album:', error);
    return NextResponse.json({
      error: 'Failed to fetch album',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}