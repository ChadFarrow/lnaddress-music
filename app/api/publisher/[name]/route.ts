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
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    
    // Load static albums data
    const staticAlbumsPath = path.join(process.cwd(), 'public', 'static-albums.json');
    const staticAlbumsData = JSON.parse(fs.readFileSync(staticAlbumsPath, 'utf8'));
    const albums: Album[] = staticAlbumsData.albums || [];

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
    const publisherInfo: Publisher = {
      name: firstAlbum.artist,
      guid: firstAlbum.publisher!.feedGuid,
      feedUrl: firstAlbum.publisher!.feedUrl,
      medium: firstAlbum.publisher!.medium,
      albums: publisherAlbums
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