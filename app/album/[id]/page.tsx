import { Metadata } from 'next';
import AlbumDetailClient from './AlbumDetailClient';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const albumTitle = decodeURIComponent(id).replace(/-/g, ' ');
  
  return {
      title: `${albumTitle} | Into the Doerfel-Verse`,
  description: `Listen to ${albumTitle} on Into the Doerfel-Verse`,
  };
}

async function getAlbumData(albumId: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 
                   (process.env.NODE_ENV === 'production' 
                     ? 'https://itdv-site.vercel.app' 
                     : 'http://localhost:3000');
    
    // Try database-free endpoint first (includes publisher data), fallback to static
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
    
    // Try to find album by ID or title
    const decodedId = decodeURIComponent(albumId);
    
    // Helper function to create URL slug (same as homepage)
    const createSlug = (title: string) => 
      title.toLowerCase()
        .replace(/\s+/g, '-')           // Replace spaces with dashes
        .replace(/-+/g, '-')            // Replace multiple consecutive dashes with single dash
        .replace(/^-+|-+$/g, '');       // Remove leading/trailing dashes
    
    // Find all matching albums first
    const matchingAlbums = albums.filter((a: any) => {
      const feedMatch = a.feedId === albumId;
      const titleMatch = a.title.toLowerCase() === decodedId.toLowerCase();
      const slugMatch = createSlug(a.title) === decodedId.toLowerCase();
      const compatMatch = a.title.toLowerCase().replace(/\s+/g, '-') === decodedId.toLowerCase();
      
      // Flexible matching: check if the album title starts with the decoded ID
      // This handles cases like "Inside Out - Single" matching "inside-out"
      const baseTitle = a.title.toLowerCase().split(/\s*[-–]\s*/)[0]; // Split on dash or em-dash
      const baseTitleSlug = createSlug(baseTitle);
      const flexibleMatch = baseTitleSlug === decodedId.toLowerCase();
      
      return feedMatch || titleMatch || slugMatch || compatMatch || flexibleMatch;
    });
    
    // If multiple matches, prioritize albums with publisher data
    let album = null;
    if (matchingAlbums.length > 1) {
      // First try to find one with publisher data
      album = matchingAlbums.find((a: any) => a.publisher);
      // If no publisher data found, use the first match
      if (!album) album = matchingAlbums[0];
    } else if (matchingAlbums.length === 1) {
      album = matchingAlbums[0];
    }

    return album || null;
  } catch (error) {
    console.error('Error fetching album data:', error);
    return null;
  }
}

export default async function AlbumPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const albumData = await getAlbumData(id);
  const albumTitle = decodeURIComponent(id).replace(/-/g, ' ');

  return <AlbumDetailClient albumTitle={albumTitle} initialAlbum={albumData} />;
}