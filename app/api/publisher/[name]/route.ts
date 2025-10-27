import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface Album {
  title: string;
  artist: string;
  description: string;
  coverArt: string;
  tracks: any[];
  releaseDate: string;
  feedId: string;
  feedUrl?: string;
  funding?: any[];
  podroll?: any[];
  publisher?: {
    feedGuid: string;
    feedUrl: string;
    medium: string;
  };
}

interface Publisher {
  name: string;
  guid: string;
  feedUrl: string;
  medium: string;
  albums: Album[];
  image?: string; // Publisher artwork from their feed
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;

    // Load albums from parsed-feeds.json (same source as publishers endpoint)
    const parsedFeedsPath = path.join(process.cwd(), 'data', 'parsed-feeds.json');
    const parsedFeedsData = JSON.parse(fs.readFileSync(parsedFeedsPath, 'utf8'));

    // Extract albums from parsed feeds
    const albums: Album[] = parsedFeedsData.feeds
      .filter((feed: any) => feed.type === 'album' && feed.parseStatus === 'success' && feed.parsedData?.album)
      .map((feed: any) => ({
        title: feed.parsedData.album.title,
        artist: feed.parsedData.album.artist,
        description: feed.parsedData.album.description || '',
        coverArt: feed.parsedData.album.coverArt,
        tracks: feed.parsedData.album.tracks || [],
        releaseDate: feed.parsedData.album.releaseDate,
        feedId: feed.id,
        feedUrl: feed.originalUrl,
        funding: feed.parsedData.album.funding,
        podroll: feed.parsedData.album.podroll,
        publisher: feed.parsedData.album.publisher
      }));

    // Create slug for matching
    const createSlug = (text: string) => 
      text.toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
    
    const decodedName = decodeURIComponent(name);
    const nameSlug = createSlug(decodedName);
    
    // Find albums by this publisher
    const publisherAlbums = albums.filter((album) => {
      if (!album.publisher) return false;
      
      const artistSlug = createSlug(album.artist);
      return artistSlug === nameSlug || album.artist.toLowerCase() === decodedName.toLowerCase();
    });

    if (publisherAlbums.length === 0) {
      return NextResponse.json(
        { error: 'Publisher not found' },
        { status: 404 }
      );
    }

    // Get publisher info from first album
    const firstAlbum = publisherAlbums[0];
    const publisherFeedUrl = firstAlbum.publisher!.feedUrl;

    // Fetch publisher feed to get artwork
    let publisherImage: string | undefined;
    try {
      const feedResponse = await fetch(publisherFeedUrl);
      if (feedResponse.ok) {
        const feedXml = await feedResponse.text();
        // Extract image from iTunes tag or regular image tag
        const itunesImageMatch = feedXml.match(/<itunes:image\s+href="([^"]+)"/i);
        const regularImageMatch = feedXml.match(/<image>\s*<url>([^<]+)<\/url>/i);
        publisherImage = itunesImageMatch?.[1] || regularImageMatch?.[1];
      }
    } catch (error) {
      console.warn('Could not fetch publisher artwork:', error);
    }

    const publisherInfo: Publisher = {
      name: firstAlbum.artist,
      guid: firstAlbum.publisher!.feedGuid,
      feedUrl: firstAlbum.publisher!.feedUrl,
      medium: firstAlbum.publisher!.medium,
      albums: publisherAlbums,
      image: publisherImage
    };

    return NextResponse.json({
      publisher: publisherInfo,
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching publisher:', error);
    return NextResponse.json(
      { error: 'Failed to fetch publisher' },
      { status: 500 }
    );
  }
}