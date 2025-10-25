/**
 * UI utilities
 * Reusable UI effects and animations
 */

import confetti from 'canvas-confetti';
import { UI_SETTINGS } from './constants';

/**
 * Triggers success confetti animation
 * Used for successful payments and boosts
 */
export function triggerSuccessConfetti(): void {
  const count = UI_SETTINGS.CONFETTI_COUNT;
  const defaults = {
    origin: { y: 0.7 },
    colors: UI_SETTINGS.CONFETTI_COLORS,
  };

  function fire(particleRatio: number, opts: confetti.Options) {
    confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio),
    });
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
    scalar: 0.8,
  });

  fire(0.1, {
    spread: 120,
    startVelocity: 25,
    decay: 0.92,
    scalar: 1.2,
  });

  fire(0.1, {
    spread: 120,
    startVelocity: 45,
  });
}

/**
 * Triggers a more subtle confetti effect
 * For smaller successes or repeated actions
 */
export function triggerSubtleConfetti(): void {
  confetti({
    particleCount: 50,
    spread: 60,
    origin: { y: 0.6 },
    colors: UI_SETTINGS.CONFETTI_COLORS,
  });
}

/**
 * Formats satoshis for display
 * Adds thousand separators
 */
export function formatSats(sats: number): string {
  return sats.toLocaleString();
}

/**
 * Formats duration in seconds to MM:SS or HH:MM:SS
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Truncates text to a maximum length with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Copies text to clipboard
 * Returns true if successful
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}
