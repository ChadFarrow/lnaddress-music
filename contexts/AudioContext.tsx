'use client';

import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { toast } from '@/components/Toast';
import { makeAutoBoostPayment } from '@/utils/payment-utils';
import { useBoostToNostr } from '@/hooks/useBoostToNostr';
import { PAYMENT_AMOUNTS, IMAGE_SETTINGS } from '@/lib/constants';

interface Track {
  title: string;
  duration: string;
  url: string;
  trackNumber: number;
  image?: string;
  artist?: string;
  album?: string;
  value?: {
    type: string;
    method: string;
    suggested?: string;
    recipients: Array<{
      type: string;
      address: string;
      split: number;
      name?: string;
      fee?: boolean;
      customKey?: string;
      customValue?: string;
    }>;
  };
  // Podcast GUIDs for Nostr boost tagging
  guid?: string;
  podcastGuid?: string; // podcast:guid at item level
  feedGuid?: string;
  feedUrl?: string;
  publisherGuid?: string;
  publisherUrl?: string;
  imageUrl?: string;
}

interface AudioContextType {
  // Current track info
  currentTrack: Track | null;
  currentAlbum: string | null;
  
  // Playback state
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  
  // Playlist
  playlist: Track[];
  currentTrackIndex: number;
  isShuffling: boolean;
  isRepeating: boolean;
  
  // Auto Boost
  isAutoBoostEnabled: boolean;
  autoBoostAmount: number;
  toggleAutoBoost: () => void;
  setAutoBoostAmount: (amount: number) => void;
  
  // Now Playing Screen
  isNowPlayingOpen: boolean;
  openNowPlaying: () => void;
  closeNowPlaying: () => void;
  
  // Actions
  playTrack: (track: Track, album?: string) => void;
  playAlbum: (tracks: Track[], startIndex?: number, album?: string) => void;
  playAlbumAndOpenNowPlaying: (tracks: Track[], startIndex?: number, album?: string) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  nextTrack: () => void;
  previousTrack: () => void;
  seekTo: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
};

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [currentAlbum, setCurrentAlbum] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isShuffling, setIsShuffling] = useState(false);
  const [isRepeating, setIsRepeating] = useState(false);
  const [isNowPlayingOpen, setIsNowPlayingOpen] = useState(false);

  // Shuffle history to avoid repeating recently played tracks
  const shuffleHistoryRef = useRef<number[]>([]);

  // Auto Boost state
  const [isAutoBoostEnabled, setIsAutoBoostEnabled] = useState(false);
  const [autoBoostAmount, setAutoBoostAmount] = useState<number>(PAYMENT_AMOUNTS.AUTO_BOOST_DEFAULT);

  // Initialize Nostr boost system for auto boosts
  const { postBoost, generateKeys, publicKey } = useBoostToNostr({ 
    autoGenerateKeys: typeof window !== 'undefined'
  });

  // Initialize audio element
  useEffect(() => {
    audioRef.current = new Audio();
    const audio = audioRef.current;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleDurationChange = () => {
      console.log('Duration changed:', audio.duration);
      setDuration(audio.duration);
    };
    const handleLoadStart = () => setCurrentTime(0);
    const handleError = (e: Event) => {
      console.error('Audio error:', e);
      if (currentTrack) {
        const error = (e.target as HTMLAudioElement)?.error;
        const errorMessage = error
          ? `Error ${error.code}: ${error.message}`
          : 'Unknown audio error';
        console.error(`Failed to load track "${currentTrack.title}":`, errorMessage);
        toast.error(`Unable to load "${currentTrack.title}". ${errorMessage}`);
      }
      setIsPlaying(false);
    };
    const handleStalled = () => {
      console.warn('Audio loading stalled for:', currentTrack?.title);
      toast.warning(`Loading "${currentTrack?.title}" is taking longer than expected...`);
    };
    const handleWaiting = () => {
      console.log('Audio buffering:', currentTrack?.title);
    };
    const handleCanPlay = () => {
      console.log('Audio can play:', currentTrack?.title);
    };
    const handleLoadedMetadata = () => {
      console.log('Metadata loaded, duration:', audio.duration);
      setDuration(audio.duration);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('error', handleError);
    audio.addEventListener('stalled', handleStalled);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('canplay', handleCanPlay);

    return () => {
      audio.pause();
      audio.src = '';
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('stalled', handleStalled);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('canplay', handleCanPlay);
    };
  }, []); // Only create audio element once on mount

  const playTrack = (track: Track, album?: string) => {
    if (!audioRef.current) return;

    setCurrentTrack(track);
    setCurrentAlbum(album || null);
    setPlaylist([track]);
    setCurrentTrackIndex(0);

    // Reset shuffle history when playing a new track
    shuffleHistoryRef.current = [];

    // Parse duration from track data if available (format: "M:SS" or "H:MM:SS")
    if (track.duration && typeof track.duration === 'string') {
      const parts = track.duration.split(':').map(p => parseInt(p, 10));
      let durationSeconds = 0;
      if (parts.length === 2) {
        // M:SS format
        durationSeconds = parts[0] * 60 + parts[1];
      } else if (parts.length === 3) {
        // H:MM:SS format
        durationSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
      }
      if (durationSeconds > 0) {
        console.log('Setting duration from track data:', durationSeconds, 'seconds');
        setDuration(durationSeconds);
      }
    }

    audioRef.current.src = track.url;
    audioRef.current.load();
    audioRef.current.play().catch(error => {
      if (error.name === 'AbortError' || error.message.includes('aborted')) {
        console.log('Audio loading was cancelled (expected behavior)');
      } else {
        console.error('Failed to play track:', track.title, error);
        toast.error(`Unable to play "${track.title}". The audio file may be unavailable.`);
        setIsPlaying(false);
      }
    });
    setIsPlaying(true);

    // Update Media Session API
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist || 'Unknown Artist',
        album: album || undefined,
        artwork: track.image ? [
          { src: track.image, sizes: IMAGE_SETTINGS.DEFAULT_ARTWORK_SIZE, type: IMAGE_SETTINGS.DEFAULT_ARTWORK_TYPE }
        ] : []
      });
    }
  };

  const playAlbum = (tracks: Track[], startIndex = 0, album?: string) => {
    if (!audioRef.current || tracks.length === 0) return;

    const track = tracks[startIndex];
    setCurrentTrack(track);
    setCurrentAlbum(album || null);
    setPlaylist(tracks);
    setCurrentTrackIndex(startIndex);

    // Reset shuffle history when playing a new album
    shuffleHistoryRef.current = [startIndex]; // Start with the current track in history

    // Parse duration from track data if available (format: "M:SS" or "H:MM:SS")
    if (track.duration && typeof track.duration === 'string') {
      const parts = track.duration.split(':').map(p => parseInt(p, 10));
      let durationSeconds = 0;
      if (parts.length === 2) {
        // M:SS format
        durationSeconds = parts[0] * 60 + parts[1];
      } else if (parts.length === 3) {
        // H:MM:SS format
        durationSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
      }
      if (durationSeconds > 0) {
        console.log('Setting duration from track data:', durationSeconds, 'seconds');
        setDuration(durationSeconds);
      }
    }

    audioRef.current.src = track.url;
    audioRef.current.load();
    audioRef.current.play().catch(error => {
      if (error.name === 'AbortError' || error.message.includes('aborted')) {
        console.log('Audio loading was cancelled (expected behavior)');
      } else {
        console.error('Failed to play track:', track.title, error);
        toast.error(`Unable to play "${track.title}". The audio file may be unavailable.`);
        setIsPlaying(false);
      }
    });
    setIsPlaying(true);

    // Update Media Session API
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist || 'Unknown Artist',
        album: album || undefined,
        artwork: track.image ? [
          { src: track.image, sizes: IMAGE_SETTINGS.DEFAULT_ARTWORK_SIZE, type: IMAGE_SETTINGS.DEFAULT_ARTWORK_TYPE }
        ] : []
      });
    }
  };

  const playAlbumAndOpenNowPlaying = (tracks: Track[], startIndex = 0, album?: string) => {
    playAlbum(tracks, startIndex, album);
    setIsNowPlayingOpen(true);
  };

  const openNowPlaying = () => {
    setIsNowPlayingOpen(true);
  };

  const closeNowPlaying = () => {
    setIsNowPlayingOpen(false);
  };

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const resume = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.play().catch(error => {
        if (error.name === 'AbortError' || error.message.includes('aborted')) {
          console.log('Audio loading was cancelled (expected behavior)');
        } else {
          console.warn('Audio playback error:', error);
        }
      });
      setIsPlaying(true);
    }
  }, []);

  const stop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      setCurrentTime(0);
    }
  };

  const nextTrack = useCallback(() => {
    if (playlist.length === 0) return;

    // Pause current audio before switching tracks to prevent overlapping playback
    if (audioRef.current) {
      audioRef.current.pause();
    }

    let nextIndex: number;

    if (isShuffling && playlist.length > 1) {
      // Improved shuffle algorithm with history tracking
      const maxHistorySize = Math.min(Math.floor(playlist.length / 2), 5); // Keep history of up to 5 or half playlist size

      // Get available tracks (exclude recently played)
      let availableIndices = [];
      for (let i = 0; i < playlist.length; i++) {
        if (!shuffleHistoryRef.current.includes(i)) {
          availableIndices.push(i);
        }
      }

      // If all tracks have been played recently, reset history but exclude current track
      if (availableIndices.length === 0) {
        shuffleHistoryRef.current = [currentTrackIndex];
        availableIndices = [];
        for (let i = 0; i < playlist.length; i++) {
          if (i !== currentTrackIndex) {
            availableIndices.push(i);
          }
        }
      }

      // Pick random track from available indices
      nextIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];

      // Add to history and maintain max size
      shuffleHistoryRef.current.push(nextIndex);
      if (shuffleHistoryRef.current.length > maxHistorySize) {
        shuffleHistoryRef.current.shift(); // Remove oldest
      }
    } else {
      // Sequential playback
      nextIndex = currentTrackIndex + 1;
      if (nextIndex >= playlist.length) {
        nextIndex = 0; // Loop back to start
      }
      // Clear shuffle history when not shuffling
      shuffleHistoryRef.current = [];
    }

    const nextTrack = playlist[nextIndex];
    setCurrentTrack(nextTrack);
    setCurrentTrackIndex(nextIndex);

    // Parse duration from track data if available (format: "M:SS" or "H:MM:SS")
    if (nextTrack.duration && typeof nextTrack.duration === 'string') {
      const parts = nextTrack.duration.split(':').map(p => parseInt(p, 10));
      let durationSeconds = 0;
      if (parts.length === 2) {
        // M:SS format
        durationSeconds = parts[0] * 60 + parts[1];
      } else if (parts.length === 3) {
        // H:MM:SS format
        durationSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
      }
      if (durationSeconds > 0) {
        console.log('Setting duration from track data:', durationSeconds, 'seconds');
        setDuration(durationSeconds);
      }
    }

    if (audioRef.current) {
      audioRef.current.src = nextTrack.url;
      audioRef.current.load();
      if (isPlaying) {
        audioRef.current.play().catch(error => {
          // Silently handle expected audio loading errors (user navigation, network issues, etc.)
          if (error.name === 'AbortError' || error.message.includes('aborted')) {
            console.log('Audio loading was cancelled (expected behavior)');
          } else {
            console.error('Failed to play next track:', nextTrack.title, error);
            toast.error(`Unable to play "${nextTrack.title}". Skipping to next track...`);
          }
        });
      }
    }

    // Update Media Session API
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: nextTrack.title,
        artist: nextTrack.artist || 'Unknown Artist',
        album: nextTrack.album || currentAlbum || undefined,
        artwork: nextTrack.image ? [
          { src: nextTrack.image, sizes: '512x512', type: 'image/png' }
        ] : []
      });
    }
  }, [playlist, currentTrackIndex, isShuffling, isPlaying, currentAlbum]);

  const previousTrack = useCallback(() => {
    if (playlist.length === 0) return;

    // Pause current audio before switching tracks to prevent overlapping playback
    if (audioRef.current) {
      audioRef.current.pause();
    }

    let prevIndex = currentTrackIndex - 1;
    if (prevIndex < 0) {
      prevIndex = playlist.length - 1; // Loop to end
    }

    const prevTrack = playlist[prevIndex];
    setCurrentTrack(prevTrack);
    setCurrentTrackIndex(prevIndex);

    // Parse duration from track data if available (format: "M:SS" or "H:MM:SS")
    if (prevTrack.duration && typeof prevTrack.duration === 'string') {
      const parts = prevTrack.duration.split(':').map(p => parseInt(p, 10));
      let durationSeconds = 0;
      if (parts.length === 2) {
        // M:SS format
        durationSeconds = parts[0] * 60 + parts[1];
      } else if (parts.length === 3) {
        // H:MM:SS format
        durationSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
      }
      if (durationSeconds > 0) {
        console.log('Setting duration from track data:', durationSeconds, 'seconds');
        setDuration(durationSeconds);
      }
    }

    if (audioRef.current) {
      audioRef.current.src = prevTrack.url;
      audioRef.current.load();
      if (isPlaying) {
        audioRef.current.play().catch(error => {
          if (error.name === 'AbortError' || error.message.includes('aborted')) {
            console.log('Audio loading was cancelled (expected behavior)');
          } else {
            console.warn('Audio playback error:', error);
          }
        });
      }
    }

    // Update Media Session API
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: prevTrack.title,
        artist: prevTrack.artist || 'Unknown Artist',
        album: prevTrack.album || currentAlbum || undefined,
        artwork: prevTrack.image ? [
          { src: prevTrack.image, sizes: '512x512', type: 'image/png' }
        ] : []
      });
    }
  }, [playlist, currentTrackIndex, isPlaying, currentAlbum]);

  // Make triggerAutoBoost a useCallback to avoid recreation
  const triggerAutoBoost = useCallback(async (track: Track) => {
    try {
      console.log('🚀 Auto boost triggered for:', track.title);
      
      // Get payment recipients from track or album data (same logic as manual boost)
      const getPaymentRecipients = () => {
        let recipients: any[] = [];

        // Check if current track has value data
        if (track.value && track.value.recipients && track.value.recipients.length > 0) {
          recipients = track.value.recipients
            .filter((r: any) => r.address && r.split > 0)
            .map((r: any) => ({
              address: r.address,
              split: r.split,
              name: r.name,
              fee: r.fee,
              type: r.type || 'node' // Use the type from value data
            }));
          console.log('✅ Using track-level podcast:value recipients for auto boost');
        }

        // Note: Platform fee recipient removed - cannot use raw node pubkey with Breez SDK

        return recipients.length > 0 ? recipients : null;
      };

      // Get fallback recipient (same as manual boost)
      const getFallbackRecipient = () => {
        // For Breez SDK, we cannot send to raw node pubkeys
        // Use site owner's Lightning address as fallback
        return 'chadf@getalby.com';
      };

      // Create boost metadata
      const boostMetadata = {
        title: track.title || 'Unknown Song',
        artist: track.artist || 'Unknown Artist',
        album: currentAlbum || 'Unknown Album',
        episode: track.title,
        url: currentAlbum ? `https://zaps.podtards.com/album/${encodeURIComponent(currentAlbum)}#${encodeURIComponent(track.title || '')}` : 'https://zaps.podtards.com',
        appName: 'lnaddress music',
        timestamp: Math.floor(currentTime),
        senderName: 'Auto Boost', // Identify as auto boost
        // No message for auto boosts to keep TLVs clean
        itemGuid: track.guid,
        podcastGuid: track.podcastGuid,
        podcastFeedGuid: track.feedGuid,
        feedUrl: track.feedUrl,
        publisherGuid: track.publisherGuid,
        publisherUrl: track.publisherUrl,
        imageUrl: track.imageUrl
      };

      // Make the payment
      const paymentResult = await makeAutoBoostPayment({
        amount: autoBoostAmount,
        description: `Auto boost for ${track.title || 'Unknown Song'} by ${track.artist || 'Unknown Artist'}`,
        recipients: getPaymentRecipients() || undefined,
        fallbackRecipient: getFallbackRecipient(),
        boostMetadata
      });

      if (paymentResult.success) {
        // Post to Nostr after successful Lightning payment
        try {
          const trackMetadata = {
            title: track.title,
            artist: track.artist,
            album: currentAlbum || undefined,
            url: currentAlbum ? `https://zaps.podtards.com/album/${encodeURIComponent(currentAlbum)}#${encodeURIComponent(track.title || '')}` : 'https://zaps.podtards.com',
            imageUrl: track.imageUrl || track.image,
            timestamp: Math.floor(currentTime),
            duration: duration ? Math.floor(duration) : undefined,
            senderName: 'Auto Boost',
            guid: track.guid,
            podcastGuid: track.podcastGuid,
            feedGuid: track.feedGuid,
            feedUrl: track.feedUrl,
            publisherGuid: track.publisherGuid,
            publisherUrl: track.publisherUrl
          };

          const nostrResult = await postBoost(
            autoBoostAmount,
            trackMetadata,
            `Auto boost for "${track.title}"` // Identify auto boost in Nostr
          );

          if (nostrResult.success) {
            console.log('✅ Auto boost posted to Nostr:', nostrResult.eventId);
          } else {
            console.warn('⚠️ Auto boost Nostr post failed:', nostrResult.error);
          }
        } catch (nostrError) {
          console.warn('⚠️ Auto boost Nostr post failed:', nostrError);
        }

        toast.success(`⚡ Auto boosted "${track.title}" with ${autoBoostAmount} sats!`, 3000);
        console.log('✅ Auto boost payment successful:', paymentResult.results);
      } else {
        throw new Error(paymentResult.error || 'Auto boost payment failed');
      }
      
    } catch (error) {
      console.error('Auto boost failed:', error);
      toast.error(`Auto boost failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [autoBoostAmount, currentAlbum, currentTime, duration, postBoost]);

  // Listen for manual boost payment events and post to Nostr
  useEffect(() => {
    const handleBoostPaymentSent = async (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log('🎯 [AudioContext] Caught boost:payment-sent event for Nostr posting:', customEvent.detail);

      const amount = customEvent.detail?.amount || 0;
      const albumFromEvent = customEvent.detail?.album;

      // Post to Nostr after successful manual boost payment
      console.log('📝 [AudioContext] Starting Nostr post for manual boost...');
      console.log('📝 [AudioContext] Album from event:', albumFromEvent?.title);
      console.log('📝 [AudioContext] Current track:', currentTrack?.title);

      try {
        // Use album data from event if boosting from album card, otherwise use currentTrack
        const useAlbumData = albumFromEvent && !currentTrack;

        const trackMetadata = {
          title: useAlbumData ? albumFromEvent.title : currentTrack?.title,
          artist: useAlbumData ? albumFromEvent.artist : currentTrack?.artist,
          album: useAlbumData ? albumFromEvent.title : (currentAlbum || undefined),
          url: useAlbumData
            ? `${process.env.NEXT_PUBLIC_SITE_URL || 'https://lnaddress-music.vercel.app'}/album/${encodeURIComponent(albumFromEvent.title.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-'))}`
            : currentAlbum
              ? `${process.env.NEXT_PUBLIC_SITE_URL || 'https://lnaddress-music.vercel.app'}/album/${encodeURIComponent(currentAlbum.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-'))}#${encodeURIComponent(currentTrack?.title || '')}`
              : process.env.NEXT_PUBLIC_SITE_URL || 'https://lnaddress-music.vercel.app',
          imageUrl: useAlbumData ? (albumFromEvent.imageUrl || albumFromEvent.coverArt) : (currentTrack?.imageUrl || currentTrack?.image),
          timestamp: useAlbumData ? 0 : Math.floor(currentTime),
          duration: useAlbumData ? undefined : (duration ? Math.floor(duration) : undefined),
          senderName: 'Manual Boost',
          // Add podcast GUIDs if available
          guid: useAlbumData ? albumFromEvent.feedGuid : currentTrack?.guid,
          feedGuid: useAlbumData ? albumFromEvent.feedGuid : currentTrack?.feedGuid,
          publisherGuid: useAlbumData ? albumFromEvent.publisherGuid : currentTrack?.publisherGuid,
          feedUrl: useAlbumData ? albumFromEvent.feedUrl : currentTrack?.feedUrl,
          publisherUrl: useAlbumData ? albumFromEvent.publisherUrl : currentTrack?.publisherUrl
        };

        const boostMessage = useAlbumData
          ? `Manual boost for album "${albumFromEvent.title}" by ${albumFromEvent.artist}`
          : `Manual boost for "${currentTrack?.title}"`;

        const nostrResult = await postBoost(
          amount,
          trackMetadata,
          boostMessage
        );

        if (nostrResult.success) {
          console.log('✅ [AudioContext] Manual boost posted to Nostr:', nostrResult.eventId);
          console.log('🔗 View on Primal:', `https://primal.net/e/${nostrResult.eventId}`);
        } else {
          console.error('❌ [AudioContext] Failed to post manual boost to Nostr:', nostrResult.error);
        }
      } catch (error) {
        console.error('❌ [AudioContext] Error posting manual boost to Nostr:', error);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('boost:payment-sent', handleBoostPaymentSent as EventListener);
      console.log('👂 [AudioContext] Listening for boost:payment-sent events');
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('boost:payment-sent', handleBoostPaymentSent as EventListener);
        console.log('👋 [AudioContext] Stopped listening for boost:payment-sent events');
      }
    };
  }, [postBoost, currentTrack, currentAlbum, currentTime, duration]);

  // Handle track ended event - needs to be after nextTrack is declared
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = async () => {
      // Trigger auto boost if enabled and we have a current track
      // IMPORTANT: Auto boost runs in background, don't block track progression
      if (isAutoBoostEnabled && currentTrack) {
        // Fire and forget - don't wait for auto boost to complete
        triggerAutoBoost(currentTrack).catch(error => {
          console.error('Auto boost failed, but continuing playback:', error);
          // Don't show error toast - auto boost already handles this
        });
      }

      // Always progress to next track, regardless of auto boost status
      if (isRepeating) {
        audio.currentTime = 0;
        audio.play();
      } else {
        nextTrack();
      }
    };

    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('ended', handleEnded);
    };
  }, [isRepeating, nextTrack, isAutoBoostEnabled, currentTrack, triggerAutoBoost]);

  const seekTo = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const setVolume = (newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    setVolumeState(clampedVolume);
    if (audioRef.current) {
      audioRef.current.volume = clampedVolume;
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
    }
  };

  const toggleShuffle = () => {
    setIsShuffling(!isShuffling);
  };

  const toggleRepeat = () => {
    setIsRepeating(!isRepeating);
  };

  // Auto Boost functions
  const toggleAutoBoost = () => {
    setIsAutoBoostEnabled(!isAutoBoostEnabled);
    if (!isAutoBoostEnabled) {
      toast.success('🔥 Auto boost enabled! Songs will auto boost 25 sats when finished');
    } else {
      toast.info('Auto boost disabled');
    }
  };

  // Media Session API handlers - after all functions are declared
  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => resume());
      navigator.mediaSession.setActionHandler('pause', () => pause());
      navigator.mediaSession.setActionHandler('previoustrack', () => previousTrack());
      navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack());
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) {
          seekTo(details.seekTime);
        }
      });
    }
  }, [resume, pause, previousTrack, nextTrack, seekTo]);

  const value: AudioContextType = {
    currentTrack,
    currentAlbum,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    playlist,
    currentTrackIndex,
    isShuffling,
    isRepeating,
    isNowPlayingOpen,
    openNowPlaying,
    closeNowPlaying,
    playTrack,
    playAlbum,
    playAlbumAndOpenNowPlaying,
    pause,
    resume,
    stop,
    nextTrack,
    previousTrack,
    seekTo,
    setVolume,
    toggleMute,
    toggleShuffle,
    toggleRepeat,
    isAutoBoostEnabled,
    autoBoostAmount,
    toggleAutoBoost,
    setAutoBoostAmount,
  };

  return (
    <AudioContext.Provider value={value}>
      {children}
    </AudioContext.Provider>
  );
};