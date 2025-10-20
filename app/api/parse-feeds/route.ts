import { NextResponse } from 'next/server';
import { FeedParser } from '@/lib/feed-parser';

/**
 * API endpoint to trigger parsing of all RSS feeds
 * GET /api/parse-feeds
 */
export async function GET() {
  try {
    console.log('🚀 Starting feed parsing via API...');

    const report = await FeedParser.parseAllFeeds();

    return NextResponse.json({
      success: true,
      report
    });
  } catch (error) {
    console.error('❌ Feed parsing failed:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
