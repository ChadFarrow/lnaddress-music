'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Play, Pause, SkipBack, SkipForward, Volume2, Zap } from 'lucide-react';
import { useAudio } from '@/contexts/AudioContext';
import { BitcoinConnectPayment } from '@/components/BitcoinConnect';
import type { RSSValue } from '@/lib/rss-parser';
import dynamic from 'next/dynamic';
import { filterPodrollItems } from '@/lib/podroll-utils';
import confetti from 'canvas-confetti';

// Dynamic import for ControlsBar
const ControlsBar = dynamic(() => import('@/components/ControlsBar'), {
  loading: () => (
    <div className="mb-8 p-4 bg-gray-800/20 rounded-lg animate-pulse">
      <div className="flex items-center gap-4">
        <div className="h-8 bg-gray-700/50 rounded w-24"></div>
        <div className="h-8 bg-gray-700/50 rounded w-20"></div>
        <div className="h-8 bg-gray-700/50 rounded w-16"></div>
        <div className="h-8 bg-gray-700/50 rounded w-20"></div>
      </div>
    </div>
  ),
  ssr: true
});

interface Track {
  title: string;
  duration: string;
  url: string;
  trackNumber: number;
  image?: string;
  value?: RSSValue; // Track-level podcast:value data
  paymentRecipients?: Array<{ address: string; split: number; name?: string; fee?: boolean }>; // Pre-processed track payment recipients
  // Podcast GUIDs for Nostr boost tagging
  guid?: string; // Standard item GUID
  podcastGuid?: string; // podcast:guid at item level
  feedGuid?: string; // Feed-level GUID
  feedUrl?: string; // Feed URL for this track
  publisherGuid?: string; // Publisher GUID
  publisherUrl?: string; // Publisher URL
  imageUrl?: string; // Track artwork URL
}

interface RSSFunding {
  url: string;
  message?: string;
}

interface RSSPodRoll {
  url: string;
  title?: string;
  description?: string;
}

interface PodrollAlbum {
  title: string;
  artist: string;
  coverArt: string;
  url: string;
}

interface Album {
  title: string;
  artist: string;
  description: string;
  coverArt: string;
  tracks: Track[];
  releaseDate: string;
  feedId: string;
  feedUrl?: string;
  funding?: RSSFunding[];
  podroll?: RSSPodRoll[];
  value?: RSSValue;
  publisher?: {
    feedGuid: string;
    feedUrl: string;
    medium: string;
  };
  paymentRecipients?: Array<{ address: string; split: number; name?: string; fee?: boolean }>;
  // Podcast GUIDs for Nostr boost tagging
  feedGuid?: string; // Feed-level GUID
  publisherGuid?: string; // Publisher GUID
  publisherUrl?: string; // Publisher URL
  imageUrl?: string; // Album artwork URL
}

interface AlbumDetailClientProps {
  albumTitle: string;
  initialAlbum: Album | null;
}

export default function AlbumDetailClient({ albumTitle, initialAlbum }: AlbumDetailClientProps) {
  const [album, setAlbum] = useState<Album | null>(initialAlbum);
  const [isLoading, setIsLoading] = useState(!initialAlbum);
  const [error, setError] = useState<string | null>(null);
  const [relatedAlbums, setRelatedAlbums] = useState<Album[]>([]);
  const [podrollAlbums, setPodrollAlbums] = useState<PodrollAlbum[]>([]);
  const [siteAlbums, setSiteAlbums] = useState<Album[]>([]);
  const [senderName, setSenderName] = useState('');
  const [boostAmount, setBoostAmount] = useState(50);
  const [boostMessage, setBoostMessage] = useState('');
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [showTrackBoostModal, setShowTrackBoostModal] = useState(false);
  const [trackBoostAmount, setTrackBoostAmount] = useState(50);
  const [trackBoostMessage, setTrackBoostMessage] = useState('');
  
  // Album boost modal state
  const [showAlbumBoostModal, setShowAlbumBoostModal] = useState(false);
  
  // Request deduplication refs
  const loadingAlbumsRef = useRef(false);
  const loadingRelatedRef = useRef(false);
  
  
  // Global audio context
  const { 
    playAlbum: globalPlayAlbum, 
    currentTrack,
    isPlaying: globalIsPlaying,
    pause: globalPause,
    resume: globalResume,
    toggleShuffle
  } = useAudio();

  // Lightning payment handlers
  const handleBoostSuccess = (response: any) => {
    console.log('✅ Boost successful:', response);
    setShowAlbumBoostModal(false);
    
    // Trigger multiple confetti bursts for dramatic effect
    const count = 200;
    const defaults = {
      origin: { y: 0.7 },
      colors: ['#FFD700', '#FFA500', '#FF8C00', '#FFE55C', '#FFFF00']
    };

    function fire(particleRatio: number, opts: any) {
      confetti(Object.assign({}, defaults, opts, {
        particleCount: Math.floor(count * particleRatio)
      }));
    }

    fire(0.25, {
      spread: 26,
      startVelocity: 55,
    });
    fire(0.2, {
      spread: 60,
    });
    fire(0.35, {
      spread: 100,
      decay: 0.91,
      scalar: 0.8
    });
    fire(0.1, {
      spread: 120,
      startVelocity: 25,
      decay: 0.92,
      scalar: 1.2
    });
    fire(0.1, {
      spread: 120,
      startVelocity: 45,
    });
  };

  const handleBoostError = (error: string) => {
    console.error('❌ Boost failed:', error);
  };

  // Get Lightning payment recipients from pre-processed server-side data
  // Memoize payment recipients to prevent render loop
  const paymentRecipients = useMemo(() => {
    if (!album) return null;
    
    // Check for album-level value.recipients (Lightning Network value splits)
    const valueRecipients = album.value?.recipients;
    
    // Check for track-level value.recipients (some albums have recipients per track)
    const trackValueRecipients = album.tracks?.[0]?.value?.recipients;
    
    // Use pre-processed payment recipients from server-side parsing
    if (album.paymentRecipients && album.paymentRecipients.length > 0) {
      return album.paymentRecipients;
    }
    
    // Check for album-level Lightning Network value splits
    if (valueRecipients && valueRecipients.length > 0) {
      return valueRecipients;
    }
    
    // Check for track-level Lightning Network value splits
    if (trackValueRecipients && trackValueRecipients.length > 0) {
      return trackValueRecipients;
    }
    
    return null; // Will use fallback single recipient
  }, [album]);

  // Get Lightning payment recipients for a specific track
  const getTrackPaymentRecipients = (track: Track): Array<{ address: string; split: number; name?: string; fee?: boolean; type?: string; fixedAmount?: number }> | null => {
    if (!track) return null;
    
    // Check for track-level value.recipients (Lightning Network value splits)
    const trackValueRecipients = track.value?.recipients;
    
    // Use pre-processed track payment recipients from server-side parsing
    if (track.paymentRecipients && track.paymentRecipients.length > 0) {
      return track.paymentRecipients;
    }
    
    // Check for track-level Lightning Network value splits
    if (trackValueRecipients && trackValueRecipients.length > 0) {
      console.log('✅ Found track-level Lightning Network value recipients:', trackValueRecipients);
      return trackValueRecipients;
    }
    
    // Fallback to album-level payment recipients if track doesn't have its own
    return paymentRecipients;
  };
  
  // Get fallback recipient for backwards compatibility
  const getFallbackRecipient = (): { address: string; amount: number } => {
    return {
      address: '03740ea02585ed87b83b2f76317a4562b616bd7b8ec3f925be6596932b2003fc9e',
      amount: 50
    };
  };
  
  // Background state
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [backgroundLoaded, setBackgroundLoaded] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const preloadAttemptedRef = useRef(false);

  useEffect(() => {
    setIsClient(true);
    
    const checkDevice = () => {
      setIsDesktop(window.innerWidth > 768);
    };
    
    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);


  // Load album data if not provided
  useEffect(() => {
    if (!initialAlbum) {
      loadAlbum();
    } else {
      // Load related albums in background (non-blocking)
      loadRelatedAlbums().catch(error => {
        console.warn('Failed to load related albums:', error);
      });
      
      // Load site albums and podroll albums in parallel, non-blocking
      loadSiteAlbums().catch(error => {
        console.warn('Failed to load site albums:', error);
      });
      
      // Defer podroll loading to not block initial render
      setTimeout(() => {
        loadPodrollAlbums();
      }, 100);
    }
  }, [albumTitle, initialAlbum]);

  // Separate useEffect for background image preloading to avoid re-running API calls
  useEffect(() => {
    if (initialAlbum && isDesktop && !preloadAttemptedRef.current) {
      preloadAttemptedRef.current = true;
      preloadBackgroundImage(initialAlbum);
    }
  }, [isDesktop, initialAlbum]);

  // Load saved sender name from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedSenderName = localStorage.getItem('boost-sender-name');
      if (savedSenderName) {
        setSenderName(savedSenderName);
      }
    }
  }, []);

  // Save sender name to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && senderName.trim()) {
      localStorage.setItem('boost-sender-name', senderName.trim());
    }
  }, [senderName]);

  const preloadBackgroundImage = async (albumData: Album) => {
    if (!albumData.coverArt) return;
    
    try {
      console.log('🎨 Preloading background image for desktop:', albumData.coverArt);
      
      const img = new window.Image();
      img.onload = () => {
        console.log('✅ Background image preloaded successfully');
        setBackgroundImage(albumData.coverArt);
        setBackgroundLoaded(true);
      };
      img.onerror = () => {
        console.error('❌ Background image preload failed');
        setBackgroundImage(null);
        setBackgroundLoaded(true);
      };
      
      img.decoding = 'async';
      img.src = albumData.coverArt;
    } catch (error) {
      console.error('❌ Error preloading background image:', error);
      setBackgroundImage(null);
      setBackgroundLoaded(true);
    }
  };

  const loadAlbum = async () => {
    try {
      setIsLoading(true);
      console.log(`🔍 Loading album with dynamic RSS parsing: ${albumTitle}`);
      
      // Convert album title back to URL slug format for API call
      const albumSlug = albumTitle
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')       // Remove punctuation except spaces and hyphens
        .replace(/\s+/g, '-')           // Replace spaces with dashes
        .replace(/-+/g, '-')            // Replace multiple consecutive dashes with single dash
        .replace(/^-+|-+$/g, '');       // Remove leading/trailing dashes
      
      // Use the new individual album endpoint that does live RSS parsing with GUID data
      const response = await fetch(`/api/album/${encodeURIComponent(albumSlug)}`);
      
      if (!response.ok) {
        throw new Error('Failed to load album');
      }

      const data = await response.json();
      
      if (data.album) {
        console.log(`✅ Album loaded with GUID data:`, {
          title: data.album.title,
          feedGuid: data.album.feedGuid,
          publisherGuid: data.album.publisherGuid,
          trackGuids: data.album.tracks?.map((t: any) => ({ title: t.title, guid: t.guid })) || []
        });
        
        setAlbum(data.album);
        setError(null);
        
        if (isDesktop && !preloadAttemptedRef.current) {
          preloadAttemptedRef.current = true;
          preloadBackgroundImage(data.album);
        }
        
        // Load related albums in background (non-blocking)
        loadRelatedAlbums().catch(error => {
          console.warn('Failed to load related albums:', error);
        });
        
        // Load site albums and podroll albums in parallel, non-blocking
        loadSiteAlbums().catch(error => {
          console.warn('Failed to load site albums:', error);
        });
        
        // Defer podroll loading to not block initial render
        setTimeout(() => {
          loadPodrollAlbums();
        }, 100);
      } else {
        setError('Album not found');
      }
    } catch (err) {
      console.error('Error loading album:', err);
      setError('Failed to load album');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSiteAlbums = async () => {
    // Prevent duplicate requests
    if (loadingAlbumsRef.current) {
      return siteAlbums;
    }
    
    try {
      loadingAlbumsRef.current = true;
      // Use the lightweight albums endpoint to avoid RSS parsing overhead
      const response = await fetch('/api/albums-simple');
      if (response.ok) {
        const data = await response.json();
        const albums = data.albums || [];
        setSiteAlbums(albums);
        return albums;
      } else {
        console.warn(`Failed to load site albums: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.warn('Error loading site albums:', error);
    } finally {
      loadingAlbumsRef.current = false;
    }
    return [];
  };

  const loadRelatedAlbums = async () => {
    // Prevent duplicate requests
    if (loadingRelatedRef.current) {
      return;
    }
    
    try {
      loadingRelatedRef.current = true;
      // Use the lightweight albums endpoint to avoid RSS parsing overhead
      const response = await fetch('/api/albums-simple');
      
      if (response.ok) {
        const data = await response.json();
        const albums = data.albums || [];
        
        // Don't show random albums - only show podroll connections
        setRelatedAlbums([]); // No random albums
      } else {
        console.warn(`Failed to load related albums: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.warn('Error loading related albums:', error);
    } finally {
      loadingRelatedRef.current = false;
    }
  };

  const loadPodrollAlbums = async () => {
    if (!album?.podroll || album.podroll.length === 0) return;
    
    try {
      // Use site albums if already loaded, otherwise wait for them to load
      let albums: Album[] = siteAlbums;
      if (albums.length === 0) {
        console.log('⏳ Waiting for site albums to load before processing podroll...');
        // Wait a bit for the site albums to load from the parallel call
        await new Promise(resolve => setTimeout(resolve, 500));
        albums = siteAlbums;
        
        // If still empty after waiting, something went wrong - skip podroll processing
        if (albums.length === 0) {
          console.warn('❌ Site albums not loaded, skipping podroll processing');
          return;
        }
      }
      
      // Filter out non-music podcast feeds from podrolls
      const filteredPodroll = filterPodrollItems(album.podroll);
      
      // Process all podroll items in parallel for better performance
      const podrollPromises = filteredPodroll.map(async (podrollItem) => {
        // Check if this podroll URL matches any album on the site
        const matchingAlbum = albums.find(siteAlbum => 
          siteAlbum.feedUrl === podrollItem.url
        );
        
        if (matchingAlbum) {
          // Use the site album data
          return {
            title: matchingAlbum.title,
            artist: matchingAlbum.artist,
            coverArt: matchingAlbum.coverArt,
            url: podrollItem.url
          };
        } else {
          // Try to fetch external feed data with timeout
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
            
            const response = await fetch(`/api/test-single-feed?url=${encodeURIComponent(podrollItem.url)}`, {
              signal: controller.signal
            });
            clearTimeout(timeoutId);
            
            if (response.ok) {
              const data = await response.json();
              if (data.album) {
                return {
                  title: data.album.title || podrollItem.title || 'Unknown Album',
                  artist: data.album.artist || 'Unknown Artist',
                  coverArt: data.album.coverArt || '/placeholder-episode.jpg',
                  url: podrollItem.url
                };
              }
            }
          } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
              console.warn(`Timeout fetching podroll album for ${podrollItem.url}`);
            } else {
              console.error(`Error fetching podroll album for ${podrollItem.url}:`, error);
            }
          }
          
          // Fallback to basic podroll data
          return {
            title: podrollItem.title || 'Unknown Album',
            artist: 'Unknown Artist',
            coverArt: '/placeholder-episode.jpg',
            url: podrollItem.url
          };
        }
      });
      
      // Wait for all podroll items to resolve (in parallel)
      const podrollResults = await Promise.allSettled(podrollPromises);
      const podrollData = podrollResults
        .filter((result): result is PromiseFulfilledResult<PodrollAlbum> => result.status === 'fulfilled')
        .map(result => result.value);
      
      setPodrollAlbums(podrollData);
    } catch (error) {
      console.error('Error loading podroll albums:', error);
    }
  };

  const handlePlayAlbum = () => {
    if (!album) return;
    
    const audioTracks = album.tracks.map(track => ({
      ...track,
      artist: album.artist,
      album: album.title,
      image: track.image || album.coverArt
    }));
    
    // Debug: Check if tracks have value data
    console.log('🔍 Audio tracks being passed to globalPlayAlbum:', audioTracks.map(t => ({
      title: t.title,
      hasValue: !!t.value,
      valueType: t.value?.type
    })));
    
    globalPlayAlbum(audioTracks, 0, album.title);
  };

  const handlePlayTrack = (track: Track, index: number) => {
    if (!album) return;
    
    const audioTracks = album.tracks.map(t => ({
      ...t,
      artist: album.artist,
      album: album.title,
      image: t.image || album.coverArt
    }));
    
    // Debug: Check if tracks have value data
    console.log('🔍 Audio tracks being passed to globalPlayAlbum (single track):', audioTracks.map(t => ({
      title: t.title,
      hasValue: !!t.value,
      valueType: t.value?.type
    })));
    
    globalPlayAlbum(audioTracks, index, album.title);
  };


  const isTrackPlaying = (track: Track) => {
    return currentTrack?.url === track.url && globalIsPlaying;
  };

  const formatDuration = (duration: string): string => {
    if (!duration) return '0:00';
    if (duration.includes(':')) return duration;
    
    const seconds = parseInt(duration);
    if (!isNaN(seconds)) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    return duration;
  };

  const getReleaseYear = () => {
    if (!album) return '';
    try {
      return new Date(album.releaseDate).getFullYear();
    } catch {
      return '';
    }
  };

  const getAlbumSlug = (albumData: Album) => {
    return albumData.title
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const getPublisherSlug = (publisherName: string) => {
    return publisherName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  // Combine and deduplicate related albums
  const getCombinedRelatedAlbums = () => {
    const combined: Array<Album | PodrollAlbum> = [];
    const seen = new Set<string>();
    
    // Add site albums first (they have priority)
    relatedAlbums.forEach(album => {
      const key = `${album.title.toLowerCase()}|${album.artist.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        combined.push(album);
      }
    });
    
    // Add podroll albums that aren't duplicates
    podrollAlbums.forEach(podrollAlbum => {
      const key = `${podrollAlbum.title.toLowerCase()}|${podrollAlbum.artist.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        combined.push(podrollAlbum);
      }
    });
    
    return combined.slice(0, 8); // Limit to 8 total albums
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white"></div>
      </div>
    );
  }

  if (error || (!album && !isLoading)) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
        <h1 className="text-2xl font-semibold mb-4">{error || 'Album not found'}</h1>
        <Link 
          href="/"
          className="text-blue-400 hover:text-blue-300 transition-colors"
        >
          ← Back to albums
        </Link>
      </div>
    );
  }

  // TypeScript guard: album is guaranteed to be non-null here or we're loading
  if (!album) {
    // Still loading, show spinner
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white relative overflow-hidden">
      {/* Dynamic Background with Bloodshot Lies fallback */}
      <div className="fixed inset-0 z-0">
        {/* Primary album background */}
        {backgroundImage && backgroundLoaded ? (
          <Image
            src={backgroundImage}
            alt={`${album.title} background`}
            fill
            className="object-cover w-full h-full"
            priority
          />
        ) : (
          /* Fallback to default background */
          <div className="w-full h-full bg-gradient-to-br from-gray-900 to-black"></div>
        )}
        
        {/* Dynamic overlay based on album */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900/95 via-black/90 to-gray-900/95"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/60"></div>
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <header className="bg-black/20 backdrop-blur-sm border-b border-white/10 sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link
                  href="/"
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors group"
                  title="Back to albums"
                >
                  <ArrowLeft className="w-5 h-5 group-hover:scale-110 transition-transform" />
                </Link>
                
                <div className="hidden sm:flex items-center gap-2 text-sm">
                  <Link href="/" className="text-gray-400 hover:text-white transition-colors">
                    Into the Doerfel-Verse
                  </Link>
                  <span className="text-gray-600">/</span>
                  <span className="font-medium truncate max-w-[200px]">{album.title}</span>
                </div>
              </div>

              {/* Desktop Version Info */}
              <div className="hidden sm:block text-xs text-gray-400">
                {album.tracks.length} tracks • {getReleaseYear()}
              </div>
            </div>
          </div>
        </header>

        {/* Album Hero Section */}
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col lg:flex-row gap-6 items-start">
              {/* Album Artwork */}
              <div className="flex-shrink-0 mx-auto lg:mx-0">
                <div className="w-64 h-64 lg:w-80 lg:h-80 relative rounded-xl shadow-2xl overflow-hidden border border-white/20 group cursor-pointer">
                  <Image
                    src={album.coverArt}
                    alt={album.title}
                    fill
                    className="object-cover"
                    priority
                    sizes="(min-width: 1024px) 320px, 256px"
                  />
                  
                  {/* Play Button Overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      onClick={handlePlayAlbum}
                      className="p-4 lg:p-6 bg-white/20 backdrop-blur-sm border border-white/40 text-white rounded-full hover:scale-110 hover:bg-white/30 transition-all shadow-2xl"
                      title={`Play ${album.title}`}
                    >
                      <svg className="w-8 h-8 lg:w-12 lg:h-12 ml-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Album Info */}
              <div className="flex-1 text-center lg:text-left">
                <div className="mb-4">
                  <h1 className="text-4xl lg:text-5xl font-bold mb-2 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                    {album.title}
                  </h1>
                  <p className="text-xl lg:text-2xl text-gray-300 mb-2">{album.artist}</p>
                  
                  {/* Publisher Link */}
                  {album.publisher && (
                    <div className="mb-4">
                      <Link
                        href={`/publisher/${getPublisherSlug(album.artist)}`}
                        className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                        title={`View all albums by ${album.artist}`}
                      >
                        <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                        View all albums by {album.artist}
                      </Link>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-center lg:justify-start gap-4 text-sm text-gray-400 mb-6">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                      {getReleaseYear()}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                      {album.tracks.length} tracks
                    </span>
                  </div>

                  {album.description && (
                    <div className="max-w-2xl mx-auto lg:mx-0 mb-6">
                      <p className="text-gray-300 leading-relaxed">{album.description}</p>
                    </div>
                  )}

                </div>


                {/* Play Controls */}
                <div className="flex items-center justify-center lg:justify-start gap-4 mb-6">
                  <button
                    onClick={handlePlayAlbum}
                    className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-full transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    <Play className="w-5 h-5" />
                    <span className="font-semibold">Play Album</span>
                  </button>
                  
                  <button
                    onClick={() => toggleShuffle()}
                    className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors backdrop-blur-sm border border-white/20"
                    title="Shuffle"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M14.83 13.41L13.42 14.82L16.55 17.95L14.5 20H20V14.5L17.96 16.54L14.83 13.41M14.5 4L16.54 6.04L4 18.59L5.41 20L17.96 7.46L20 9.5V4M10.59 9.17L5.41 4L4 5.41L9.17 10.58L10.59 9.17Z"/>
                    </svg>
                  </button>
                  
                  {/* Album Boost Button */}
                  <button
                    onClick={() => setShowAlbumBoostModal(true)}
                    className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-yellow-500 to-orange-600 text-white rounded-full font-semibold transition-all duration-200 hover:from-yellow-400 hover:to-orange-500 hover:shadow-lg transform hover:scale-105 active:scale-95"
                  >
                    <Zap className="w-4 h-4" />
                    <span>Boost</span>
                  </button>
                </div>

                {/* Funding Information - Support This Artist */}
                {album.funding && album.funding.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold mb-3 text-white text-center lg:text-left">Support This Artist</h3>
                    <div className="flex flex-wrap justify-center lg:justify-start gap-3">
                      {album.funding.map((funding, index) => (
                        <a
                          key={index}
                          href={funding.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-4 py-2 rounded-full text-sm font-medium transition-all transform hover:scale-105 flex items-center gap-2"
                        >
                          💝 {funding.message || 'Support'}
                        </a>
                      ))}
                    </div>
                  </div>
                )}


              </div>
            </div>
          </div>
        </div>

        {/* Track List */}
        <div className="container mx-auto px-4 pb-8">
          <div className="max-w-4xl mx-auto">
            <div className="bg-black/40 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
              <div className="p-6 border-b border-white/10">
                <h2 className="text-2xl font-bold">Tracks</h2>
              </div>
              
              <div className="divide-y divide-white/5">
                {album.tracks.map((track, index) => {
                  const isCurrentTrack = currentTrack?.url === track.url;
                  const isCurrentlyPlaying = isTrackPlaying(track);
                  
                  return (
                    <div
                      key={track.trackNumber}
                      className={`flex items-center gap-4 p-4 hover:bg-white/5 transition-colors cursor-pointer group ${
                        isCurrentTrack ? 'bg-white/10' : ''
                      }`}
                      onClick={() => handlePlayTrack(track, index)}
                    >
                      {/* Track Number / Play Icon */}
                      <div className="w-8 flex items-center justify-center">
                        {isCurrentlyPlaying ? (
                          <div className="w-4 h-4 flex items-center justify-center">
                            <div className="w-1 h-3 bg-blue-400 animate-pulse mr-0.5"></div>
                            <div className="w-1 h-2 bg-blue-400 animate-pulse delay-75 mr-0.5"></div>
                            <div className="w-1 h-4 bg-blue-400 animate-pulse delay-150"></div>
                          </div>
                        ) : (
                          <span className={`text-sm font-medium ${isCurrentTrack ? 'text-blue-400' : 'text-gray-400 group-hover:text-white'}`}>
                            {track.trackNumber}
                          </span>
                        )}
                      </div>

                      {/* Track Artwork */}
                      <div className="w-12 h-12 relative flex-shrink-0 rounded overflow-hidden">
                        <Image
                          src={track.image || album.coverArt}
                          alt={track.title}
                          fill
                          className="object-cover"
                          sizes="48px"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Play className="w-4 h-4 text-white" />
                        </div>
                      </div>

                      {/* Track Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className={`font-medium truncate ${
                          isCurrentTrack ? 'text-blue-400' : 'text-white'
                        }`}>
                          {track.title}
                        </h3>
                        <p className="text-sm text-gray-400 truncate">{album.artist}</p>
                      </div>

                      {/* Duration */}
                      <div className="text-sm text-gray-400 font-mono">
                        {formatDuration(track.duration)}
                      </div>

                      {/* Track Lightning Boost Button */}
                      <div 
                        className="flex items-center justify-center ml-2"
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent track play when clicking boost
                        }}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTrack(track);
                            setShowTrackBoostModal(true);
                          }}
                          className="inline-flex items-center gap-2 bg-gradient-to-r from-yellow-500 to-orange-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 hover:from-yellow-400 hover:to-orange-500 hover:shadow-lg transform hover:scale-105 active:scale-95"
                        >
                          <Zap className="w-4 h-4" />
                          <span className="hidden sm:inline">Boost</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Related Albums - Only Podroll Connections */}
        {(() => {
          const combinedAlbums = getCombinedRelatedAlbums();
          return combinedAlbums.length > 0 && (
            <div className="container mx-auto px-4 pb-8">
              <div className="max-w-4xl mx-auto">
                <h2 className="text-2xl font-bold mb-6">Related Shows</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {combinedAlbums.map((relatedItem, index) => {
                    // Check if this is a site album (has tracks) or podroll album (has url)
                    const isSiteAlbum = 'tracks' in relatedItem;
                    
                    if (isSiteAlbum) {
                      // Site album - use Link for internal navigation
                      return (
                        <Link
                          key={`site-${index}`}
                          href={`/album/${getAlbumSlug(relatedItem as Album)}`}
                          className="group block"
                        >
                          <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 hover:bg-white/10 transition-colors border border-white/10">
                            <div className="aspect-square mb-3 rounded overflow-hidden">
                              <Image
                                src={relatedItem.coverArt}
                                alt={relatedItem.title}
                                width={200}
                                height={200}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                            </div>
                            <h3 className="font-semibold text-sm mb-1 truncate group-hover:text-blue-400 transition-colors">
                              {relatedItem.title}
                            </h3>
                            <p className="text-xs text-gray-400 truncate">{relatedItem.artist}</p>
                          </div>
                        </Link>
                      );
                    } else {
                      // Podroll album - check if it exists on the site
                      const podrollItem = relatedItem as PodrollAlbum;
                      const matchingSiteAlbum = siteAlbums.find(siteAlbum => 
                        siteAlbum.feedUrl === podrollItem.url
                      );
                      
                      if (matchingSiteAlbum) {
                        // Found on site - use internal link
                        return (
                          <Link
                            key={`internal-${index}`}
                            href={`/album/${getAlbumSlug(matchingSiteAlbum)}`}
                            className="group block"
                          >
                            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 hover:bg-white/10 transition-colors border border-white/10">
                              <div className="aspect-square mb-3 rounded overflow-hidden">
                                <Image
                                  src={podrollItem.coverArt}
                                  alt={podrollItem.title}
                                  width={200}
                                  height={200}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                />
                              </div>
                              <h3 className="font-semibold text-sm mb-1 truncate group-hover:text-blue-400 transition-colors">
                                {podrollItem.title}
                              </h3>
                              <p className="text-xs text-gray-400 truncate">{podrollItem.artist}</p>
                            </div>
                          </Link>
                        );
                      } else {
                        // External podcast - use RSS feed link
                        return (
                          <a
                            key={`external-${index}`}
                            href={podrollItem.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group block"
                          >
                            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 hover:bg-white/10 transition-colors border border-white/10 relative">
                              {/* External link indicator */}
                              <div className="absolute top-2 right-2 w-4 h-4 bg-blue-500/80 rounded-full flex items-center justify-center">
                                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </div>
                              <div className="aspect-square mb-3 rounded overflow-hidden">
                                <Image
                                  src={podrollItem.coverArt}
                                  alt={podrollItem.title}
                                  width={200}
                                  height={200}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                />
                              </div>
                              <h3 className="font-semibold text-sm mb-1 truncate group-hover:text-blue-400 transition-colors">
                                {podrollItem.title}
                              </h3>
                              <p className="text-xs text-gray-400 truncate">{podrollItem.artist}</p>
                            </div>
                          </a>
                        );
                      }
                    }
                  })}
                </div>
              </div>
            </div>
          );
        })()}


        {/* Album Boost Modal */}
        {showAlbumBoostModal && album && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative bg-gradient-to-b from-gray-900 to-black rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[85vh] sm:max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-300">
              {/* Header with Album Art */}
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/80 z-10" />
                <Image
                  src={album.coverArt}
                  alt={album.title}
                  width={400}
                  height={200}
                  className="w-full h-32 sm:h-40 object-cover"
                />
                <button
                  onClick={() => setShowAlbumBoostModal(false)}
                  className="absolute top-4 right-4 z-20 p-2 bg-black/50 hover:bg-black/70 rounded-full transition-colors backdrop-blur-sm"
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <div className="absolute bottom-4 left-6 right-6 z-20">
                  <h3 className="text-xl sm:text-2xl font-bold text-white mb-1">{album.title}</h3>
                  <p className="text-sm sm:text-base text-gray-200">{album.artist}</p>
                </div>
              </div>
              
              <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(85vh-8rem)] sm:max-h-[calc(90vh-10rem)]">
                {/* Amount Input */}
                <div>
                  <label className="text-gray-400 text-sm font-medium">Amount</label>
                  <div className="flex items-center gap-3 mt-2">
                    <input
                      type="number"
                      value={boostAmount}
                      onChange={(e) => setBoostAmount(Math.max(1, parseInt(e.target.value) || 1))}
                      className="flex-1 px-4 py-3 bg-gray-800/50 border border-gray-700 text-white rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                      placeholder="Enter amount"
                      min="1"
                    />
                    <span className="text-gray-400 font-medium">sats</span>
                  </div>
                </div>
                
                {/* Sender Name */}
                <div>
                  <label className="text-gray-400 text-sm font-medium">Your Name (Optional)</label>
                  <input
                    type="text"
                    value={senderName}
                    onChange={(e) => {
                      setSenderName(e.target.value);
                      if (e.target.value.trim()) {
                        localStorage.setItem('boost-sender-name', e.target.value.trim());
                      }
                    }}
                    className="w-full mt-2 px-4 py-3 bg-gray-800/50 border border-gray-700 text-white rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    placeholder="Anonymous"
                    maxLength={50}
                  />
                </div>

                {/* Boostagram Message */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-gray-400 text-sm font-medium">Message (Optional)</label>
                    <span className="text-gray-500 text-xs">{boostMessage.length}/250</span>
                  </div>
                  <textarea
                    value={boostMessage}
                    onChange={(e) => setBoostMessage(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 text-white rounded-xl text-base resize-none focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    placeholder="Share your thoughts..."
                    maxLength={250}
                    rows={3}
                  />
                </div>
                
                {/* Boost Button */}
                <BitcoinConnectPayment
                  amount={boostAmount}
                  description={`Boost for ${album.title} by ${album.artist}`}
                  onSuccess={handleBoostSuccess}
                  onError={handleBoostError}
                  className="w-full !mt-6"
                  recipients={paymentRecipients || undefined}
                  recipient={getFallbackRecipient().address}
                  enableBoosts={true}
                  boostMetadata={{
                    title: album.title,
                    artist: album.artist,
                    album: album.title,
                    url: `https://doerfelverse.com/album/${encodeURIComponent(albumTitle)}`,
                    appName: 'ITDV Lightning',
                    senderName: senderName?.trim() || 'Super Fan',
                    message: boostMessage?.trim() || undefined,
                    itemGuid: album.tracks?.[0]?.guid,
                    podcastGuid: album.tracks?.[0]?.podcastGuid,
                    podcastFeedGuid: album.feedGuid,
                    feedUrl: album.feedUrl,
                    publisherGuid: album.publisherGuid,
                    publisherUrl: album.publisherUrl,
                    imageUrl: album.coverArt
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Track Boost Modal */}
        {showTrackBoostModal && selectedTrack && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="relative bg-gray-900 rounded-xl shadow-2xl max-w-sm w-full">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Zap className="w-5 h-5 text-yellow-500" />
                    Boost Track
                  </h3>
                  <button
                    onClick={() => {
                      setShowTrackBoostModal(false);
                      setSelectedTrack(null);
                    }}
                    className="p-1 hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <div className="text-center mb-6">
                  <p className="text-white font-medium">{selectedTrack.title}</p>
                  <p className="text-gray-400 text-sm">{album?.artist}</p>
                </div>
                
                {/* Amount Selection */}
                <div className="mb-6">
                  <label className="block text-white text-sm font-medium mb-2">
                    Boost Amount
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={trackBoostAmount}
                      onChange={(e) => setTrackBoostAmount(Math.max(1, parseInt(e.target.value) || 1))}
                      className="flex-1 px-3 py-2 bg-gray-700 text-white rounded-lg text-sm"
                      placeholder="Enter amount in sats"
                      min="1"
                    />
                    <span className="text-gray-400 text-sm">sats</span>
                  </div>
                </div>

                {/* Sender Name */}
                <div className="mb-6">
                  <label className="block text-white text-sm font-medium mb-2">
                    Your Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg text-sm"
                    placeholder="Enter your name to be credited"
                    maxLength={50}
                  />
                </div>

                {/* Boostagram Message */}
                <div className="mb-6">
                  <label className="block text-white text-sm font-medium mb-2">
                    Message (Optional)
                  </label>
                  <textarea
                    value={trackBoostMessage}
                    onChange={(e) => setTrackBoostMessage(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg text-sm resize-none"
                    placeholder="Enter your boostagram message (up to 250 characters)"
                    maxLength={250}
                    rows={3}
                  />
                  <div className="flex justify-between items-center mt-1">
                    <p className="text-gray-500 text-xs">Custom message for your boost</p>
                    <p className="text-gray-400 text-xs">{trackBoostMessage.length}/250</p>
                  </div>
                </div>
                
                <BitcoinConnectPayment
                  amount={trackBoostAmount}
                  description={`Boost for "${selectedTrack.title}" by ${album?.artist}`}
                  onSuccess={(response) => {
                    handleBoostSuccess(response);
                    setShowTrackBoostModal(false);
                    setSelectedTrack(null);
                    setTrackBoostMessage('');
                  }}
                  onError={handleBoostError}
                  className="w-full"
                  recipients={getTrackPaymentRecipients(selectedTrack) || undefined}
                  recipient={getFallbackRecipient().address}
                  enableBoosts={true}
                  boostMetadata={{
                    title: selectedTrack.title,
                    artist: album?.artist || 'Unknown Artist',
                    album: album?.title || 'Unknown Album',
                    episode: selectedTrack.title,
                    url: `https://doerfelverse.com/album/${encodeURIComponent(albumTitle)}`,
                    appName: 'ITDV Lightning',
                    senderName: senderName?.trim() || undefined,
                    message: trackBoostMessage?.trim() || undefined,
                    // Include RSS podcast GUIDs for proper Nostr tagging
                    itemGuid: selectedTrack.guid,
                    podcastGuid: selectedTrack.podcastGuid,
                    podcastFeedGuid: album?.feedGuid,
                    feedUrl: album?.feedUrl,
                    publisherGuid: album?.publisherGuid,
                    publisherUrl: album?.publisherUrl,
                    imageUrl: selectedTrack.imageUrl || album?.coverArt
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Bottom spacing for audio player */}
        <div className="h-24" />
      </div>
    </div>
  );
}