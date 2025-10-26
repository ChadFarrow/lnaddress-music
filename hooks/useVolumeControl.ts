import { useState, useCallback, useEffect, RefObject } from 'react';

/**
 * Hook for managing volume and mute state
 */
export function useVolumeControl(audioRef: RefObject<HTMLAudioElement>) {
  const [volume, setVolumeState] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [previousVolume, setPreviousVolume] = useState(1);

  const setVolume = useCallback((newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    setVolumeState(clampedVolume);

    if (audioRef.current) {
      audioRef.current.volume = clampedVolume;
    }

    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('audioVolume', clampedVolume.toString());
    }

    // Auto-unmute if volume is increased
    if (clampedVolume > 0 && isMuted) {
      setIsMuted(false);
    }
  }, [audioRef, isMuted]);

  const toggleMute = useCallback(() => {
    if (isMuted) {
      // Unmute - restore previous volume
      setVolume(previousVolume || 1);
      setIsMuted(false);
    } else {
      // Mute - save current volume and set to 0
      setPreviousVolume(volume);
      setVolume(0);
      setIsMuted(true);
    }
  }, [isMuted, volume, previousVolume, setVolume]);

  // Load saved volume on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedVolume = localStorage.getItem('audioVolume');
      if (savedVolume) {
        const parsedVolume = parseFloat(savedVolume);
        if (!isNaN(parsedVolume)) {
          setVolume(parsedVolume);
        }
      }
    }
  }, [setVolume]);

  return {
    volume,
    isMuted,
    setVolume,
    toggleMute
  };
}
