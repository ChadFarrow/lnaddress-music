# Audio Player Hooks

This directory contains modular hooks for building the audio player functionality. These hooks were extracted from a monolithic 800-line `AudioContext` to improve maintainability and reusability.

## Hooks Overview

### `usePlaybackState.ts`
**Purpose:** Core playback state and controls
**Responsibilities:**
- Track selection and playback
- Play/pause/stop/resume controls
- Seeking and time tracking
- Current track and album state

**State:**
- `currentTrack` - Currently playing track
- `currentAlbum` - Current album name
- `isPlaying` - Playback status
- `currentTime` - Current playback position
- `duration` - Track duration

**Actions:**
- `playTrack(track, album?)` - Play a specific track
- `pause()` - Pause playback
- `resume()` - Resume playback
- `stop()` - Stop and reset
- `seekTo(time)` - Seek to position

---

### `useVolumeControl.ts`
**Purpose:** Volume and mute management
**Responsibilities:**
- Volume level control (0-1)
- Mute/unmute functionality
- Persist volume to localStorage
- Sync with audio element

**State:**
- `volume` - Current volume level (0-1)
- `isMuted` - Mute status

**Actions:**
- `setVolume(level)` - Set volume (auto-unmutes if > 0)
- `toggleMute()` - Toggle mute state

---

### `usePlaylist.ts`
**Purpose:** Playlist/queue management and navigation
**Responsibilities:**
- Track queue management
- Next/previous navigation
- Shuffle and repeat modes
- Track index tracking

**State:**
- `playlist` - Array of tracks in queue
- `currentTrackIndex` - Index of current track
- `isShuffling` - Shuffle mode enabled
- `isRepeating` - Repeat mode enabled

**Actions:**
- `playAlbum(tracks, startIndex?)` - Load album into queue
- `nextTrack()` - Get next track (respects shuffle/repeat)
- `previousTrack()` - Get previous track
- `toggleShuffle()` - Toggle shuffle mode
- `toggleRepeat()` - Toggle repeat mode

---

### `useAutoBoost.ts`
**Purpose:** Lightning auto-boost feature
**Responsibilities:**
- Enable/disable auto-boost
- Set boost amount
- Persist settings to localStorage

**State:**
- `isAutoBoostEnabled` - Auto-boost on/off
- `autoBoostAmount` - Sats per boost

**Actions:**
- `toggleAutoBoost()` - Toggle auto-boost
- `setAutoBoostAmount(amount)` - Set boost amount

---

### `useNowPlayingUI.ts`
**Purpose:** Now Playing screen visibility
**Responsibilities:**
- Control Now Playing modal/screen visibility

**State:**
- `isNowPlayingOpen` - Screen visibility

**Actions:**
- `openNowPlaying()` - Show Now Playing screen
- `closeNowPlaying()` - Hide Now Playing screen
- `toggleNowPlaying()` - Toggle visibility

---

## Usage Example

### Using Individual Hooks

```tsx
import { useRef } from 'react';
import { usePlaybackState } from '@/hooks/usePlaybackState';
import { useVolumeControl } from '@/hooks/useVolumeControl';
import { usePlaylist } from '@/hooks/usePlaylist';

function MyAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);

  const playback = usePlaybackState(audioRef);
  const volume = useVolumeControl(audioRef);
  const playlist = usePlaylist();

  return (
    <div>
      <audio ref={audioRef} />

      <button onClick={() => playback.actions.playTrack(someTrack)}>
        Play
      </button>

      <input
        type="range"
        value={volume.volume}
        onChange={(e) => volume.setVolume(parseFloat(e.target.value))}
      />

      <button onClick={playlist.toggleShuffle}>
        Shuffle: {playlist.isShuffling ? 'ON' : 'OFF'}
      </button>
    </div>
  );
}
```

### Using the Composed Context

The refactored `AudioContextRefactored` composes all these hooks together and maintains backward compatibility with the original API:

```tsx
import { AudioProvider, useAudio } from '@/contexts/AudioContextRefactored';

function App() {
  return (
    <AudioProvider>
      <YourComponents />
    </AudioProvider>
  );
}

function PlayerControls() {
  const {
    currentTrack,
    isPlaying,
    playTrack,
    pause,
    nextTrack,
    volume,
    setVolume
  } = useAudio();

  return (
    // ... UI components
  );
}
```

## Benefits of This Architecture

1. **Separation of Concerns** - Each hook manages one specific aspect
2. **Testability** - Easier to unit test individual hooks
3. **Reusability** - Hooks can be used independently or composed
4. **Maintainability** - Smaller, focused files (each ~50-100 lines)
5. **Type Safety** - Full TypeScript support with clear interfaces
6. **Performance** - More granular re-renders possible
7. **Backward Compatible** - Existing code continues to work via the composed context

## Migration Path

To migrate from the old monolithic `AudioContext` to the refactored version:

1. **Option 1: Drop-in Replacement**
   ```tsx
   // Change this:
   import { AudioProvider, useAudio } from '@/contexts/AudioContext';

   // To this:
   import { AudioProvider, useAudio } from '@/contexts/AudioContextRefactored';
   ```

2. **Option 2: Use Individual Hooks** (for new code)
   ```tsx
   import { usePlaybackState } from '@/hooks/usePlaybackState';
   import { useVolumeControl } from '@/hooks/useVolumeControl';
   // etc.
   ```

## File Size Comparison

| File | Lines | Purpose |
|------|-------|---------|
| `AudioContext.tsx` (original) | 800 | Monolithic context |
| `usePlaybackState.ts` | ~150 | Playback logic |
| `useVolumeControl.ts` | ~60 | Volume logic |
| `usePlaylist.ts` | ~85 | Playlist logic |
| `useAutoBoost.ts` | ~55 | Auto-boost logic |
| `useNowPlayingUI.ts` | ~25 | UI state |
| `AudioContextRefactored.tsx` | ~220 | Composition layer |
| **Total** | ~595 | 25% reduction + better organization |

## Future Improvements

- Add `usePlaybackHistory` for recently played tracks
- Add `useEqualizer` for audio effects
- Add `usePlaybackSpeed` for variable speed playback
- Add `useOfflineQueue` for offline playback
