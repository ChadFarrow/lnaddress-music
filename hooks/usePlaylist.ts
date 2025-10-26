import { useState, useCallback } from 'react';
import { Track } from './usePlaybackState';

/**
 * Hook for managing playlist/queue and navigation
 */
export function usePlaylist() {
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isShuffling, setIsShuffling] = useState(false);
  const [isRepeating, setIsRepeating] = useState(false);

  const playAlbum = useCallback((tracks: Track[], startIndex = 0) => {
    setPlaylist(tracks);
    setCurrentTrackIndex(startIndex);
    return tracks[startIndex];
  }, []);

  const nextTrack = useCallback(() => {
    if (playlist.length === 0) return null;

    if (isRepeating) {
      // Repeat current track
      return playlist[currentTrackIndex];
    }

    if (isShuffling) {
      // Random next track
      const randomIndex = Math.floor(Math.random() * playlist.length);
      setCurrentTrackIndex(randomIndex);
      return playlist[randomIndex];
    }

    // Sequential next track
    const nextIndex = (currentTrackIndex + 1) % playlist.length;
    setCurrentTrackIndex(nextIndex);
    return playlist[nextIndex];
  }, [playlist, currentTrackIndex, isShuffling, isRepeating]);

  const previousTrack = useCallback(() => {
    if (playlist.length === 0) return null;

    if (isShuffling) {
      // Random previous track
      const randomIndex = Math.floor(Math.random() * playlist.length);
      setCurrentTrackIndex(randomIndex);
      return playlist[randomIndex];
    }

    // Sequential previous track
    const prevIndex = currentTrackIndex === 0
      ? playlist.length - 1
      : currentTrackIndex - 1;
    setCurrentTrackIndex(prevIndex);
    return playlist[prevIndex];
  }, [playlist, currentTrackIndex, isShuffling]);

  const toggleShuffle = useCallback(() => {
    setIsShuffling(prev => !prev);
  }, []);

  const toggleRepeat = useCallback(() => {
    setIsRepeating(prev => !prev);
  }, []);

  return {
    playlist,
    currentTrackIndex,
    isShuffling,
    isRepeating,
    playAlbum,
    nextTrack,
    previousTrack,
    toggleShuffle,
    toggleRepeat,
    setCurrentTrackIndex
  };
}
