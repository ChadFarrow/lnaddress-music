import { useState, useRef, useEffect, useCallback, RefObject } from 'react';

export interface Track {
  title: string;
  duration: string;
  url: string;
  trackNumber: number;
  image?: string;
  artist?: string;
  album?: string;
  value?: any;
  guid?: string;
  podcastGuid?: string;
  feedGuid?: string;
  feedUrl?: string;
  publisherGuid?: string;
  publisherUrl?: string;
  imageUrl?: string;
}

export interface PlaybackState {
  currentTrack: Track | null;
  currentAlbum: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
}

export interface PlaybackActions {
  playTrack: (track: Track, album?: string) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  seekTo: (time: number) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
}

/**
 * Hook for managing core playback state (play, pause, stop, seek)
 */
export function usePlaybackState(audioRef: RefObject<HTMLAudioElement>) {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [currentAlbum, setCurrentAlbum] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const playTrack = useCallback((track: Track, album?: string) => {
    if (!audioRef.current) return;

    setCurrentTrack(track);
    setCurrentAlbum(album || null);
    audioRef.current.src = track.url;
    audioRef.current.load();

    audioRef.current.play()
      .then(() => setIsPlaying(true))
      .catch(error => {
        console.error('Error playing track:', error);
        setIsPlaying(false);
      });
  }, [audioRef]);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, [audioRef]);

  const resume = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(error => {
          console.error('Error resuming playback:', error);
          setIsPlaying(false);
        });
    }
  }, [audioRef]);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      setCurrentTime(0);
    }
  }, [audioRef]);

  const seekTo = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, [audioRef]);

  // Listen to audio element events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleDurationChange = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);
    const handlePause = () => setIsPlaying(false);
    const handlePlay = () => setIsPlaying(true);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('play', handlePlay);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('play', handlePlay);
    };
  }, [audioRef]);

  return {
    state: {
      currentTrack,
      currentAlbum,
      isPlaying,
      currentTime,
      duration
    },
    actions: {
      playTrack,
      pause,
      resume,
      stop,
      seekTo,
      setCurrentTime,
      setDuration
    },
    setters: {
      setCurrentTrack,
      setCurrentAlbum,
      setIsPlaying
    }
  };
}
