import { NextRequest, NextResponse } from 'next/server';
import { RSSParser } from '@/lib/rss-parser';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const feedUrl = searchParams.get('url');
    
    if (!feedUrl) {
      return NextResponse.json({ 
        error: 'URL parameter is required' 
      }, { status: 400 });
    }
    
    console.log('🧪 Testing single feed parsing for:', feedUrl);
    
    const result = await RSSParser.parseAlbumFeed(feedUrl);
    
    console.log('📦 Parse result:', result ? 'SUCCESS' : 'NULL');
    
    if (result) {
      return NextResponse.json({
        message: 'Single feed parsed successfully',
        album: {
          title: result.title,
          artist: result.artist,
          coverArt: result.coverArt,
          trackCount: result.tracks.length,
          firstTrack: result.tracks[0]?.title,
          publisher: result.publisher // Add publisher data to response
        },
        fullAlbum: result // Include full album object for debugging
      });
    } else {
      return NextResponse.json({
        message: 'Single feed returned null',
        error: 'No album data parsed'
      });
    }
  } catch (error) {
    console.error('❌ Single feed test error:', error);
    return NextResponse.json({ 
      error: 'Failed to parse single feed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 