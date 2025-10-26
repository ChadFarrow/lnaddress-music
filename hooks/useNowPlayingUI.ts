import { useState, useCallback } from 'react';

/**
 * Hook for managing Now Playing screen visibility
 */
export function useNowPlayingUI() {
  const [isNowPlayingOpen, setIsNowPlayingOpen] = useState(false);

  const openNowPlaying = useCallback(() => {
    setIsNowPlayingOpen(true);
  }, []);

  const closeNowPlaying = useCallback(() => {
    setIsNowPlayingOpen(false);
  }, []);

  const toggleNowPlaying = useCallback(() => {
    setIsNowPlayingOpen(prev => !prev);
  }, []);

  return {
    isNowPlayingOpen,
    openNowPlaying,
    closeNowPlaying,
    toggleNowPlaying
  };
}
