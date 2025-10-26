import { Metadata } from 'next';
import AlbumDetailClient from './AlbumDetailClient';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const albumTitle = decodeURIComponent(id).replace(/-/g, ' ');
  
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Music Platform';
  return {
      title: `${albumTitle} | ${siteName}`,
  description: `Listen to ${albumTitle} on ${siteName}`,
  };
}

async function getAlbumData(albumId: string) {
  // Skip SSR data fetching entirely - let client-side load from cache
  // This prevents SSR from causing dynamic RSS parsing
  console.log('🔄 Skipping SSR data fetch, will load client-side from cache');
  return null;
}

export default async function AlbumPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const albumData = await getAlbumData(id);
  const albumTitle = decodeURIComponent(id).replace(/-/g, ' ');

  return <AlbumDetailClient albumTitle={albumTitle} initialAlbum={albumData} />;
}