import { Metadata } from 'next';
import PublisherDetailClient from './PublisherDetailClient';

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }): Promise<Metadata> {
  const { name } = await params;
  const publisherName = decodeURIComponent(name).replace(/-/g, ' ');
  
  return {
    title: `${publisherName} | Into the Doerfel-Verse`,
    description: `View all albums from ${publisherName}`,
  };
}

async function getPublisherData(publisherName: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 
                   (process.env.NODE_ENV === 'production' 
                     ? 'https://itdv-site.vercel.app' 
                     : 'http://localhost:3000');
    
    // Get albums data from database-free endpoint (includes fresh publisher data)
    let response = await fetch(`${baseUrl}/api/albums-no-db`, {
      next: { revalidate: 60 }, // Cache for 1 minute
    });
    
    if (!response.ok) {
      console.log('Database-free endpoint failed, falling back to static...');
      response = await fetch(`${baseUrl}/api/albums-static`, {
        next: { revalidate: 300 }, // Cache for 5 minutes
      });
    }

    if (!response.ok) {
      console.error('Failed to fetch albums:', response.status);
      return null;
    }

    const data = await response.json();
    const albums = data.albums || [];
    
    // Create slug from publisher name for matching
    const createSlug = (name: string) => 
      name.toLowerCase()
        .replace(/[^\w\s-]/g, '') // Remove punctuation except spaces and hyphens
        .replace(/\s+/g, '-')     // Replace spaces with hyphens
        .replace(/-+/g, '-')      // Collapse multiple hyphens
        .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
    
    const decodedName = decodeURIComponent(publisherName);
    const nameSlug = createSlug(decodedName);
    
    // Find albums by this publisher
    const publisherAlbums = albums.filter((album: any) => {
      if (!album.publisher) return false;
      
      // Match by artist name (since publishers are usually artists)
      const artistSlug = createSlug(album.artist);
      return artistSlug === nameSlug || album.artist.toLowerCase() === decodedName.toLowerCase();
    });

    if (publisherAlbums.length === 0) {
      return null;
    }

    // Get publisher info from first album
    const firstAlbum = publisherAlbums[0];
    const publisherInfo = {
      name: firstAlbum.artist,
      guid: firstAlbum.publisher.feedGuid,
      feedUrl: firstAlbum.publisher.feedUrl,
      medium: firstAlbum.publisher.medium,
      albums: publisherAlbums
    };

    return publisherInfo;
  } catch (error) {
    console.error('Error fetching publisher data:', error);
    return null;
  }
}

export default async function PublisherPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const publisherData = await getPublisherData(name);
  const publisherName = decodeURIComponent(name).replace(/-/g, ' ');

  return <PublisherDetailClient publisherName={publisherName} initialPublisher={publisherData} />;
}