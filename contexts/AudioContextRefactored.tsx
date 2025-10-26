'use client';

import React, { createContext, useContext, useRef, useCallback, useEffect } from 'react';
import { toast } from '@/components/Toast';
import { makeAutoBoostPayment } from '@/utils/payment-utils';
import { useBoostToNostr } from '@/hooks/useBoostToNostr';
import { usePlaybackState, Track } from '@/hooks/usePlaybackState';
import { useVolumeControl } from '@/hooks/useVolumeControl';
import { usePlaylist } from '@/hooks/usePlaylist';
import { useAutoBoost } from '@/hooks/useAutoBoost';
import { useNowPlayingUI } from '@/hooks/useNowPlayingUI';

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

  // Compose audio functionality from individual hooks
  const playbackState = usePlaybackState(audioRef);
  const volumeControl = useVolumeControl(audioRef);
  const playlistControl = usePlaylist();
  const autoBoost = useAutoBoost();
  const nowPlayingUI = useNowPlayingUI();

  // Nostr boost integration
  const { postBoost } = useBoostToNostr();

  // Handle track ending - play next track
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      const nextTrackData = playlistControl.nextTrack();
      if (nextTrackData) {
        playbackState.actions.playTrack(nextTrackData, playbackState.state.currentAlbum || undefined);
      }
    };

    audio.addEventListener('ended', handleEnded);
    return () => audio.removeEventListener('ended', handleEnded);
  }, [playlistControl, playbackState]);

  // Auto-boost payment when track plays
  useEffect(() => {
    if (!playbackState.state.isPlaying || !playbackState.state.currentTrack) return;
    if (!autoBoost.isAutoBoostEnabled) return;

    const handleAutoBoost = async () => {
      const track = playbackState.state.currentTrack;
      if (!track?.value?.recipients) return;

      try {
        await makeAutoBoostPayment({
          amount: autoBoost.autoBoostAmount,
          description: `Auto-boost: ${track.title}`,
          recipients: track.value.recipients,
          fallbackRecipient: track.value.recipients[0]?.address || '',
          boostMetadata: {
            trackTitle: track.title,
            artist: track.artist,
            album: track.album,
            feedGuid: track.feedGuid,
            itemGuid: track.guid || track.podcastGuid,
          }
        });

        // Send to Nostr
        await postBoost(autoBoost.autoBoostAmount, {
          title: track.title,
          artist: track.artist || 'Unknown Artist',
          feedGuid: track.feedGuid,
          feedUrl: track.feedUrl,
          itemGuid: track.guid || track.podcastGuid,
          publisherGuid: track.publisherGuid,
          publisherUrl: track.publisherUrl,
          image: track.imageUrl || track.image,
        });

        toast.success(`Auto-boosted ${autoBoost.autoBoostAmount} sats!`);
      } catch (error) {
        console.error('Auto-boost failed:', error);
        toast.error('Auto-boost payment failed');
      }
    };

    handleAutoBoost();
  }, [playbackState.state.isPlaying, playbackState.state.currentTrack?.url]); // Only re-run when track changes

  // Combined playAlbum function
  const playAlbum = useCallback((tracks: Track[], startIndex = 0, album?: string) => {
    const trackToPlay = playlistControl.playAlbum(tracks, startIndex);
    if (trackToPlay) {
      playbackState.actions.playTrack(trackToPlay, album);
    }
  }, [playlistControl, playbackState]);

  // Play album and open Now Playing screen
  const playAlbumAndOpenNowPlaying = useCallback((tracks: Track[], startIndex = 0, album?: string) => {
    playAlbum(tracks, startIndex, album);
    nowPlayingUI.openNowPlaying();
  }, [playAlbum, nowPlayingUI]);

  // Navigation functions
  const nextTrack = useCallback(() => {
    const nextTrackData = playlistControl.nextTrack();
    if (nextTrackData) {
      playbackState.actions.playTrack(nextTrackData, playbackState.state.currentAlbum || undefined);
    }
  }, [playlistControl, playbackState]);

  const previousTrack = useCallback(() => {
    const prevTrackData = playlistControl.previousTrack();
    if (prevTrackData) {
      playbackState.actions.playTrack(prevTrackData, playbackState.state.currentAlbum || undefined);
    }
  }, [playlistControl, playbackState]);

  const value: AudioContextType = {
    // Playback state
    currentTrack: playbackState.state.currentTrack,
    currentAlbum: playbackState.state.currentAlbum,
    isPlaying: playbackState.state.isPlaying,
    currentTime: playbackState.state.currentTime,
    duration: playbackState.state.duration,

    // Volume
    volume: volumeControl.volume,
    isMuted: volumeControl.isMuted,
    setVolume: volumeControl.setVolume,
    toggleMute: volumeControl.toggleMute,

    // Playlist
    playlist: playlistControl.playlist,
    currentTrackIndex: playlistControl.currentTrackIndex,
    isShuffling: playlistControl.isShuffling,
    isRepeating: playlistControl.isRepeating,
    toggleShuffle: playlistControl.toggleShuffle,
    toggleRepeat: playlistControl.toggleRepeat,

    // Auto-boost
    isAutoBoostEnabled: autoBoost.isAutoBoostEnabled,
    autoBoostAmount: autoBoost.autoBoostAmount,
    toggleAutoBoost: autoBoost.toggleAutoBoost,
    setAutoBoostAmount: autoBoost.setAutoBoostAmount,

    // Now Playing UI
    isNowPlayingOpen: nowPlayingUI.isNowPlayingOpen,
    openNowPlaying: nowPlayingUI.openNowPlaying,
    closeNowPlaying: nowPlayingUI.closeNowPlaying,

    // Actions
    playTrack: playbackState.actions.playTrack,
    playAlbum,
    playAlbumAndOpenNowPlaying,
    pause: playbackState.actions.pause,
    resume: playbackState.actions.resume,
    stop: playbackState.actions.stop,
    nextTrack,
    previousTrack,
    seekTo: playbackState.actions.seekTo,
  };

  return (
    <AudioContext.Provider value={value}>
      {children}
      <audio
        ref={audioRef}
        preload="metadata"
        style={{ display: 'none' }}
      />
    </AudioContext.Provider>
  );
};
