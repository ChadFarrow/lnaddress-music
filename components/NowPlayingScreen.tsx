'use client';

import React, { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAudio } from '@/contexts/AudioContext';
import { useSwipeGestures } from '@/hooks/useSwipeGestures';
import { extractColorsFromImage, createAlbumBackground, createTextOverlay, ExtractedColors } from '@/lib/color-utils';
import { performanceMonitor, getMobileOptimizations, getCachedColors, debounce } from '@/lib/performance-utils';

interface NowPlayingScreenProps {
  isOpen: boolean;
  onClose: () => void;
}

// Global color cache to persist across component remounts
const globalColorCache = new Map<string, ExtractedColors>();
let colorDataPromise: Promise<any> | null = null;

const NowPlayingScreen: React.FC<NowPlayingScreenProps> = ({ isOpen, onClose }) => {
  const router = useRouter();
  const [extractedColors, setExtractedColors] = useState<ExtractedColors | null>(null);
  const [isLoadingColors, setIsLoadingColors] = useState(false);
  const colorCache = useRef<Map<string, ExtractedColors>>(globalColorCache);

  const {
    currentTrack,
    currentAlbum,
    isPlaying,
    currentTime,
    duration,
    volume,
    isShuffling,
    isRepeating,
    pause,
    resume,
    nextTrack,
    previousTrack,
    seekTo,
    setVolume,
    toggleShuffle,
    toggleRepeat,
  } = useAudio();

  // Add swipe gestures for mobile
  const swipeRef = useSwipeGestures({
    onSwipeLeft: nextTrack,
    onSwipeRight: previousTrack,
    onSwipeDown: onClose,
    threshold: 50,
    velocityThreshold: 0.3
  });

  // Performance-optimized color loading with mobile considerations
  const loadColors = useRef(debounce(async (albumTitle: string, track: any) => {
    const timer = performanceMonitor.startTimer('colorLoad');
    // Create cache key that includes track info for track-specific colors
    const cacheKey = track.image 
      ? `${albumTitle.toLowerCase()}-${track.title?.toLowerCase() || 'unknown'}` 
      : albumTitle.toLowerCase();
    
    try {
      // Check memory cache first
      if (colorCache.current.has(cacheKey)) {
        console.log('🎨 Using memory cache for:', albumTitle);
        setExtractedColors(colorCache.current.get(cacheKey)!);
        performanceMonitor.recordCacheHit();
        return;
      }

      // Note: Skip preloaded cache check for now to ensure we check for track-specific colors
      // We'll check preloaded colors later as a fallback

      console.log('🎨 Loading colors from network for:', albumTitle);
      setIsLoadingColors(true);

      // Create or reuse the shared promise for color data loading
      if (!colorDataPromise) {
        colorDataPromise = fetch('/data/albums-with-colors.json')
          .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
          })
          .catch(error => {
            console.error('Failed to load color data:', error);
            colorDataPromise = null;
            throw error;
          });
      }

      const data = await colorDataPromise;
      const album = data.albums?.find((a: any) => 
        a.title?.toLowerCase() === albumTitle.toLowerCase()
      );
      
      let colors = null;
      
      // Check for track-specific colors first
      if (album?.tracks && track.image) {
        const trackMatch = album.tracks.find((t: any) => 
          t.title?.toLowerCase() === track.title?.toLowerCase() && 
          t.image === track.image && 
          t.colors
        );
        
        if (trackMatch?.colors) {
          console.log('🎵 Using track-specific colors for:', track.title);
          colors = trackMatch.colors;
        }
      }
      
      // Fallback to album colors
      if (!colors && album?.colors) {
        console.log('🎨 Using album colors for:', albumTitle);
        colors = album.colors;
      }
      
      // Final fallback: check preloaded cache
      if (!colors) {
        const preloadedColors = getCachedColors(albumTitle);
        if (preloadedColors) {
          console.log('🎨 Using preloaded cache as final fallback for:', albumTitle);
          colors = preloadedColors;
        }
      }

      if (colors) {
        // Cache with size limit for mobile performance
        const mobileOpts = getMobileOptimizations();
        if (colorCache.current.size >= mobileOpts.maxCacheSize) {
          const firstKey = colorCache.current.keys().next().value;
          if (firstKey) {
            colorCache.current.delete(firstKey);
          }
        }
        
        colorCache.current.set(cacheKey, colors);
        setExtractedColors(colors);
        performanceMonitor.recordCacheMiss();
      } else {
        console.log('🎨 No colors found for:', albumTitle);
        setExtractedColors(null);
      }
      
    } catch (error) {
      console.warn('Failed to load colors:', error);
      setExtractedColors(null);
    } finally {
      setIsLoadingColors(false);
      timer();
    }
  }, getMobileOptimizations().colorLoadDelay)).current;

  useEffect(() => {
    if (!isOpen || !currentTrack) {
      setExtractedColors(null);
      return;
    }

    const albumTitle = currentAlbum;
    if (!albumTitle) {
      console.log('🎨 No album title provided');
      setExtractedColors(null);
      return;
    }

    loadColors(albumTitle, currentTrack);
  }, [isOpen, currentAlbum, currentTrack, loadColors]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !currentTrack) return null;

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    seekTo(newTime);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
  };

  const handleViewAlbum = () => {
    if (currentAlbum) {
      // Convert album title to URL-friendly slug
      const albumSlug = currentAlbum.toLowerCase()
        .replace(/[^\w\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .trim();
      
      router.push(`/album/${albumSlug}`);
      onClose(); // Close the now playing screen
    }
  };

  // Generate mobile-optimized background styles
  const mobileOpts = getMobileOptimizations();
  const backgroundStyle = extractedColors 
    ? { 
        background: createAlbumBackground(extractedColors),
        willChange: mobileOpts.willChange,
        contain: mobileOpts.cssContainment
      }
    : { 
        background: 'linear-gradient(135deg, #1e3a8a 0%, #3730a3 25%, #581c87 75%, #000000 100%)',
        willChange: mobileOpts.willChange,
        contain: mobileOpts.cssContainment
      };

  const overlayStyle = extractedColors 
    ? { background: createTextOverlay(extractedColors) }
    : { background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.3) 100%)' };

  return (
    <div 
      ref={swipeRef}
      className="fixed inset-0 z-[100] flex flex-col transition-all duration-1000 ease-in-out"
      style={backgroundStyle}
    >
      {/* Color overlay for better text readability */}
      <div className="absolute inset-0 pointer-events-none" style={overlayStyle} />
      {/* Header */}
      <div className="flex items-center justify-between p-4 sm:p-6" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
        <button
          onClick={onClose}
          className="p-2 text-white/60 hover:text-white transition-colors"
          title="Close"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        <div className="text-center">
          <p className="text-xs text-white/60 uppercase tracking-wider">Playing from</p>
          <p className="text-sm text-white font-medium">{currentAlbum || 'Queue'}</p>
        </div>

        <button
          onClick={handleViewAlbum}
          className="p-2 text-white/60 hover:text-white transition-colors"
          title="View album"
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
          </svg>
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-8 pb-4 sm:pb-8">
        {/* Album Art */}
        <div className="w-full max-w-md aspect-square relative mb-8">
          {currentTrack.image ? (
            <Image
              src={currentTrack.image}
              alt={currentTrack.title}
              fill
              className="object-cover rounded-lg shadow-2xl"
              sizes="(max-width: 768px) 90vw, 400px"
              priority
            />
          ) : (
            <div className="w-full h-full bg-gray-800 rounded-lg flex items-center justify-center">
              <svg className="w-24 h-24 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
              </svg>
            </div>
          )}
        </div>

        {/* Track Info */}
        <div className="w-full max-w-md text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2 truncate">
            {currentTrack.title}
          </h1>
          <p className="text-lg sm:text-xl text-white/60 truncate">
            {currentTrack.artist || 'Unknown Artist'}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="w-full max-w-md mb-8">
          <input
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer slider-large"
            style={{
              background: `linear-gradient(to right, #ffffff 0%, #ffffff ${(currentTime / (duration || 1)) * 100}%, rgba(255,255,255,0.2) ${(currentTime / (duration || 1)) * 100}%, rgba(255,255,255,0.2) 100%)`
            }}
          />
          <div className="flex justify-between mt-2">
            <span className="text-xs text-white/60">{formatTime(currentTime)}</span>
            <span className="text-xs text-white/60">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Main Controls */}
        <div className="flex items-center justify-center gap-4 sm:gap-6 mb-8">
          <button
            onClick={toggleShuffle}
            className={`p-2 transition-colors ${
              isShuffling ? 'text-white' : 'text-white/40 hover:text-white/60'
            }`}
            title="Toggle shuffle"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
            </svg>
          </button>

          <button
            onClick={previousTrack}
            className="p-3 text-white hover:scale-110 transition-transform"
            title="Previous track"
          >
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
            </svg>
          </button>

          <button
            onClick={isPlaying ? pause : resume}
            className="p-4 bg-white text-black rounded-full hover:scale-110 transition-transform"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
              </svg>
            ) : (
              <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            )}
          </button>

          <button
            onClick={nextTrack}
            className="p-3 text-white hover:scale-110 transition-transform"
            title="Next track"
          >
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
            </svg>
          </button>

          <button
            onClick={toggleRepeat}
            className={`p-2 transition-colors ${
              isRepeating ? 'text-white' : 'text-white/40 hover:text-white/60'
            }`}
            title="Toggle repeat"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
            </svg>
          </button>
        </div>

        {/* Volume Control - Desktop Only */}
        <div className="hidden sm:flex items-center gap-3 w-full max-w-xs">
          <svg className="w-5 h-5 text-white/60" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
          </svg>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={handleVolumeChange}
            className="flex-1 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer slider-large"
            style={{
              background: `linear-gradient(to right, #ffffff 0%, #ffffff ${volume * 100}%, rgba(255,255,255,0.2) ${volume * 100}%, rgba(255,255,255,0.2) 100%)`
            }}
          />
        </div>
      </div>

      <style jsx>{`
        .slider-large::-webkit-slider-thumb {
          appearance: none;
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #ffffff;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        .slider-large::-moz-range-thumb {
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #ffffff;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
      `}</style>
    </div>
  );
};

export default NowPlayingScreen;