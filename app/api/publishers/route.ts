import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface Album {
  title: string;
  artist: string;
  description: string;
  coverArt: string;
  releaseDate: string;
  feedId: string;
  feedUrl?: string;
  publisher?: {
    feedGuid: string;
    feedUrl: string;
    medium: string;
  };
}

interface Publisher {
  name: string;
  feedGuid: string;
  guid: string;
  feedUrl: string;
  medium: string;
  albumCount: number;
  firstAlbumCover?: string;
  latestAlbum?: {
    title: string;
    coverArt: string;
    releaseDate: string;
  };
}

export async function GET(request: NextRequest) {
  try {
    // Load albums from local parsed-feeds.json
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
        releaseDate: feed.parsedData.album.releaseDate,
        feedId: feed.id,
        feedUrl: feed.originalUrl,
        publisher: feed.parsedData.album.publisher
      }));

    // Group albums by publisher
    const publishersMap = new Map<string, Publisher>();

    albums.forEach((album) => {
      if (!album.publisher) return;

      const publisherKey = album.publisher.feedGuid;
      
      if (!publishersMap.has(publisherKey)) {
        publishersMap.set(publisherKey, {
          name: album.artist,
          feedGuid: album.publisher.feedGuid,
          guid: album.publisher.feedGuid,
          feedUrl: album.publisher.feedUrl,
          medium: album.publisher.medium,
          albumCount: 0,
          firstAlbumCover: album.coverArt,
          latestAlbum: {
            title: album.title,
            coverArt: album.coverArt,
            releaseDate: album.releaseDate
          }
        });
      }

      const publisher = publishersMap.get(publisherKey)!;
      publisher.albumCount++;
    });

    // Convert to array and sort by album count
    const publishers = Array.from(publishersMap.values())
      .sort((a, b) => b.albumCount - a.albumCount);

    return NextResponse.json({
      publishers,
      totalPublishers: publishers.length,
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching publishers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch publishers' },
      { status: 500 }
    );
  }
}