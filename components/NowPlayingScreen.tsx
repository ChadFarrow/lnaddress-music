'use client';

import React, { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAudio } from '@/contexts/AudioContext';
import { useLightning } from '@/contexts/LightningContext';
import { useSwipeGestures } from '@/hooks/useSwipeGestures';
import { extractColorsFromImage, createAlbumBackground, createTextOverlay, createButtonStyles, ExtractedColors } from '@/lib/color-utils';
import { performanceMonitor, getMobileOptimizations, getCachedColors, debounce } from '@/lib/performance-utils';
import { BitcoinConnectPayment } from '@/components/BitcoinConnect';
import { useBitcoinConnect } from '@/contexts/BitcoinConnectContext';
import { triggerSuccessConfetti } from '@/lib/ui-utils';
import { createAlbumSlug } from '@/lib/slug-utils';
import { PAYMENT_AMOUNTS } from '@/lib/constants';
import { PaymentConfirmationModal, type PaymentConfirmation, type PaymentRecipient } from '@/components/PaymentConfirmationModal';
import { useNWC } from '@/hooks/useNWC';
import { useBreez } from '@/hooks/useBreez';

interface NowPlayingScreenProps {
  isOpen: boolean;
  onClose: () => void;
}

// Global color cache to persist across component remounts
const globalColorCache = new Map<string, ExtractedColors>();
let colorDataPromise: Promise<any> | null = null;

const NowPlayingScreen: React.FC<NowPlayingScreenProps> = ({ isOpen, onClose }) => {
  const router = useRouter();
  const { isLightningEnabled } = useLightning();
  const [extractedColors, setExtractedColors] = useState<ExtractedColors | null>(null);
  const [isLoadingColors, setIsLoadingColors] = useState(false);
  const [showBoostModal, setShowBoostModal] = useState(false);
  const [boostAmount, setBoostAmount] = useState<string>(PAYMENT_AMOUNTS.MANUAL_BOOST_DEFAULT.toString());
  const [senderName, setSenderName] = useState('');
  const [boostMessage, setBoostMessage] = useState('');
  const [albumData, setAlbumData] = useState<any>(null);
  const [confirmPayment, setConfirmPayment] = useState<PaymentConfirmation | null>(null);
  const colorCache = useRef<Map<string, ExtractedColors>>(globalColorCache);

  const { checkConnection } = useBitcoinConnect();
  const nwc = useNWC();
  const breez = useBreez();

  const {
    currentTrack,
    currentAlbum,
    isPlaying,
    currentTime,
    duration,
    isShuffling,
    isRepeating,
    pause,
    resume,
    nextTrack,
    previousTrack,
    seekTo,
    toggleShuffle,
    toggleRepeat,
    isAutoBoostEnabled,
    toggleAutoBoost,
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
        setExtractedColors(colorCache.current.get(cacheKey)!);
        performanceMonitor.recordCacheHit();
        return;
      }

      // Note: Skip preloaded cache check for now to ensure we check for track-specific colors
      // We'll check preloaded colors later as a fallback

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
          colors = trackMatch.colors;
        }
      }

      // Fallback to album colors
      if (!colors && album?.colors) {
        colors = album.colors;
      }

      // Final fallback: check preloaded cache
      if (!colors) {
        const preloadedColors = getCachedColors(albumTitle);
        if (preloadedColors) {
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

  // Load album data when album changes
  useEffect(() => {
    if (currentAlbum && isOpen) {
      fetchAlbumData(currentAlbum);
    } else {
      setAlbumData(null);
    }
  }, [currentAlbum, isOpen]);

  // Load saved sender name on component mount
  useEffect(() => {
    if (isOpen) {
      const savedSenderName = localStorage.getItem('boost-sender-name');
      if (savedSenderName) {
        setSenderName(savedSenderName);
      }
    }
  }, [isOpen]);

  // Save sender name to localStorage when it changes
  useEffect(() => {
    if (senderName.trim()) {
      localStorage.setItem('boost-sender-name', senderName.trim());
    }
  }, [senderName]);

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

  const handleViewAlbum = () => {
    if (currentAlbum) {
      // Convert album title to URL-friendly slug (consistent with AlbumCard)
      const albumSlug = createAlbumSlug(currentAlbum);

      router.push(`/album/${albumSlug}`);
      onClose(); // Close the now playing screen
    }
  };

  const handleBoostSuccess = (response: any) => {
    setShowBoostModal(false);
    setBoostMessage(''); // Clear the message input after successful boost
    
    // Trigger wallet balance refresh
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('boost:payment-sent', { 
        detail: { response, amount: boostAmount } 
      }));
    }
    
    // Trigger confetti effect for payment success
    triggerSuccessConfetti();
  };

  const handleBoostError = (error: string) => {
    console.error('Boost failed:', error);
  };

  // Fetch album data to get podcast:value splits (fallback only)
  const fetchAlbumData = async (albumTitle: string) => {
    try {
      // Convert album title to URL-friendly format (same as album page)
      const albumId = albumTitle.toLowerCase()
        .replace(/[^\w\s-]/g, '')       // Remove punctuation except spaces and hyphens
        .replace(/\s+/g, '-')           // Replace spaces with dashes
        .replace(/-+/g, '-')            // Replace multiple consecutive dashes with single dash
        .replace(/^-+|-+$/g, '');       // Remove leading/trailing dashes

      const response = await fetch(`/api/album/${encodeURIComponent(albumId)}`);
      const data = await response.json();

      if (data.success && data.album) {
        setAlbumData(data.album);
      } else {
        setAlbumData(null);
      }
    } catch (error) {
      console.error('Failed to fetch fallback album data:', error);
      setAlbumData(null);
    }
  };

  // Get ALL Lightning payment recipients from RSS value data (both node and lnaddress types)
  const getAllPaymentRecipients = (): Array<{ address: string; split: number; name?: string; fee?: boolean; type: string }> | null => {
    // First, check if current track has value data
    if (currentTrack?.value && currentTrack.value.type === 'lightning') {
      const recipients = currentTrack.value.recipients
        .map((r: any) => ({
          address: r.address,
          split: r.split,
          name: r.name,
          fee: r.fee,
          type: r.type // Include the type field for payment routing
        }));

      return recipients;
    }

    // Fall back to album-level value data if available
    if (albumData?.value && albumData.value.type === 'lightning') {
      const recipients = albumData.value.recipients
        .map((r: any) => ({
          address: r.address,
          split: r.split,
          name: r.name,
          fee: r.fee,
          type: r.type // Include the type field for payment routing
        }));

      return recipients;
    }

    return null; // Will use fallback single recipient
  };

  // Get Lightning payment recipients from RSS value data (keysend only for backward compatibility)
  const getPaymentRecipients = (): Array<{ address: string; split: number; name?: string; fee?: boolean }> | null => {
    const allRecipients = getAllPaymentRecipients();
    if (!allRecipients) return null;

    // Filter to only node recipients
    return allRecipients.filter(r => r.type === 'node');
  };

  // Get fallback recipient for payments (same as AlbumCard)
  const getFallbackRecipient = (): { address: string; amount: number } | null => {
    // For Breez SDK, we cannot send to raw node pubkeys
    // Return null to indicate no valid payment destination
    return null;
  };

  // Show payment confirmation modal with recipient filtering
  const showPaymentConfirmation = async () => {
    await checkConnection();

    const amount = parseInt(boostAmount) || 1;

    // Debug: Log what data we have
    console.log('🔍 Payment recipients debug:', {
      hasCurrentTrackValue: !!currentTrack?.value,
      currentTrackValue: currentTrack?.value,
      hasAlbumData: !!albumData,
      albumDataValue: albumData?.value,
      currentAlbum
    });

    const allRecipients = getAllPaymentRecipients();

    if (!allRecipients || allRecipients.length === 0) {
      console.error('No recipients available for payment');
      console.error('Track value:', currentTrack?.value);
      console.error('Album data:', albumData);
      return;
    }

    // Determine which recipient types are supported based on connected wallet
    const supportedTypes = nwc.isConnected
      ? nwc.supportsKeysend
        ? ['lnaddress', 'node'] // Alby/Alby Hub supports both lightning addresses and keysend to nodes
        : ['lnaddress'] // Other NWC wallets only support lightning addresses
      : breez.isConnected
      ? ['lnaddress'] // Breez only supports lightning addresses
      : [];

    // Calculate total split across ALL recipients (not just supported)
    const totalSplit = allRecipients.reduce((sum, r) => sum + r.split, 0);

    // Map recipients with wallet capability filtering
    const recipientsWithSupport: PaymentRecipient[] = allRecipients.map(recipient => {
      const recipientAmount = Math.round((recipient.split / totalSplit) * amount);
      const supported = supportedTypes.includes(recipient.type);

      return {
        name: recipient.name || 'Unknown',
        address: recipient.address,
        type: recipient.type,
        split: recipient.split,
        amount: recipientAmount,
        supported
      };
    });

    setConfirmPayment({
      title: currentTrack?.title || 'Unknown Song',
      amount,
      recipients: recipientsWithSupport,
      processing: false
    });
    setShowBoostModal(true);
  };

  // Send payments to recipients
  const sendPayment = async () => {
    if (!confirmPayment) return;

    // Mark as processing
    setConfirmPayment(prev => prev ? { ...prev, processing: true } : null);

    // Initialize status for all recipients
    const recipientStatus = new Map<string, { status: 'pending' | 'processing' | 'success' | 'failed'; error?: string }>();
    confirmPayment.recipients.forEach(recipient => {
      if (recipient.supported === false) {
        recipientStatus.set(recipient.address, { status: 'failed', error: `Wallet doesn't support ${recipient.type}` });
      } else {
        recipientStatus.set(recipient.address, { status: 'pending' });
      }
    });
    setConfirmPayment(prev => prev ? { ...prev, recipientStatus } : null);

    const supportedRecipients = confirmPayment.recipients.filter(r => r.supported);
    const amount = parseInt(boostAmount) || 1;

    try {
      // Send to each supported recipient sequentially
      for (const recipient of supportedRecipients) {
        // Skip unsupported recipients
        if (recipient.supported === false) {
          console.log(`⏭️ Skipping ${recipient.name} - not supported`);
          continue;
        }

        console.log(`Sending ${recipient.amount} sats (${recipient.split}%) to ${recipient.name} (${recipient.address})`);

        // Mark as processing
        recipientStatus.set(recipient.address, { status: 'processing' });
        setConfirmPayment(prev => prev ? { ...prev, recipientStatus: new Map(recipientStatus) } : null);

        try {
          // Build the message with sender name if provided
          let fullMessage = boostMessage || `Boost payment`;
          if (senderName) {
            fullMessage = `From ${senderName}: ${fullMessage}`;
          }

          // Use appropriate wallet based on what's connected
          if (nwc.isConnected) {
            // NWC wallet supports both lightning addresses and keysend
            if (recipient.type === 'lnaddress') {
              // Pay to lightning address via LNURL
              const invoice = await fetch(`https://${recipient.address.split('@')[1]}/.well-known/lnurlp/${recipient.address.split('@')[0]}`)
                .then(r => r.json())
                .then(async data => {
                  const amountMsats = recipient.amount * 1000;
                  const callbackUrl = `${data.callback}?amount=${amountMsats}&comment=${encodeURIComponent(fullMessage)}`;
                  return fetch(callbackUrl).then(r => r.json()).then(d => d.pr);
                });

              const result = await nwc.payInvoice(invoice);
              if (!result.success) {
                throw new Error(result.error || 'Payment failed');
              }
            } else if (recipient.type === 'node') {
              // Pay to node address via keysend
              const result = await nwc.payKeysend(
                recipient.address, // node pubkey
                recipient.amount,
                fullMessage
              );
              if (!result.success) {
                throw new Error(result.error || 'Keysend payment failed');
              }
            }
          } else if (breez.isConnected) {
            // Breez SDK only supports lightning addresses
            await breez.sendPayment({
              destination: recipient.address,
              amountSats: recipient.amount,
              message: fullMessage
            });
          }

          recipientStatus.set(recipient.address, { status: 'success' });
          setConfirmPayment(prev => prev ? { ...prev, recipientStatus: new Map(recipientStatus) } : null);
          console.log(`✓ Payment successful to ${recipient.name}`);
        } catch (error: any) {
          recipientStatus.set(recipient.address, { status: 'failed', error: error.message || 'Payment failed' });
          setConfirmPayment(prev => prev ? { ...prev, recipientStatus: new Map(recipientStatus) } : null);
          console.error(`✗ Payment failed to ${recipient.name}:`, error);
        }
      }

      // All payments complete (or failed)
      setConfirmPayment(prev => prev ? { ...prev, processing: false } : null);

      // Trigger success effects
      handleBoostSuccess({ amount });

      // Close modal after delay
      setTimeout(() => {
        setConfirmPayment(null);
        setShowBoostModal(false);
        setBoostMessage(''); // Clear message after successful boost
      }, 2000);

    } catch (error: any) {
      console.error('Error sending payments:', error);
      setConfirmPayment(prev => prev ? { ...prev, processing: false } : null);
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

  // Generate dynamic button styles that match the background
  const buttonStyles = extractedColors 
    ? createButtonStyles(extractedColors)
    : {
        background: 'rgba(255, 255, 255, 0.1)',
        border: 'rgba(255, 255, 255, 0.2)',
        hoverBackground: 'rgba(255, 255, 255, 0.2)',
        hoverBorder: 'rgba(255, 255, 255, 0.3)',
      };

  return (
    <div 
      ref={swipeRef}
      className="fixed inset-0 z-[100] flex flex-col transition-colors duration-500 ease-in-out"
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
      <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-8 pb-4 sm:pb-8" style={{ paddingBottom: `max(2rem, calc(2rem + env(safe-area-inset-bottom)))` }}>
        {/* Album Art - Responsive to window size */}
        <div className="w-full max-w-xs sm:max-w-sm md:max-w-md aspect-square relative mb-6 sm:mb-8">
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
        <div className="flex flex-col items-center gap-4 mb-8">
          {/* Media Controls Row */}
          <div className="flex items-center justify-center gap-4 sm:gap-6">
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

          {/* Boost Button Row - only show when Lightning is enabled */}
          {isLightningEnabled && (
            <div className="flex items-center justify-center w-full relative">
              <button
                onClick={showPaymentConfirmation}
                className="flex items-center gap-2 px-4 py-2 backdrop-blur-sm rounded-full text-white hover:text-yellow-300 transform hover:scale-105 transition-all duration-150 text-sm"
                style={{
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'manipulation',
                background: buttonStyles.background,
                border: `1px solid ${buttonStyles.border}`
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = buttonStyles.hoverBackground;
                e.currentTarget.style.border = `1px solid ${buttonStyles.hoverBorder}`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = buttonStyles.background;
                e.currentTarget.style.border = `1px solid ${buttonStyles.border}`;
              }}
              title="Boost this song"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M7 2v11h3v9l7-12h-4l4-8z"/>
              </svg>
              <span className="font-medium">Boost Song</span>
              </button>
              
              {/* Auto boost button positioned to the right */}
              <button
                onClick={toggleAutoBoost}
                className={`absolute right-0 flex items-center gap-1 px-3 py-1 rounded-full text-xs transition-colors ${
                  isAutoBoostEnabled 
                    ? 'bg-yellow-400/20 text-yellow-400 border border-yellow-400/30' 
                    : 'bg-white/10 text-white/60 border border-white/20 hover:text-white hover:border-white/30'
                }`}
                title={`Auto boost ${isAutoBoostEnabled ? 'enabled' : 'disabled'} - 25 sats`}
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M7 2v11h3v9l7-12h-4l4-8z"/>
                </svg>
                <span className="font-medium">Auto</span>
              </button>
            </div>
          )}
        </div>

      </div>

      {/* Payment Confirmation Modal */}
      {isLightningEnabled && (
        <PaymentConfirmationModal
          confirmation={confirmPayment}
          paymentAmount={boostAmount}
          senderName={senderName}
          paymentMessage={boostMessage}
          onAmountChange={setBoostAmount}
          onSenderNameChange={setSenderName}
          onMessageChange={setBoostMessage}
          onCancel={() => {
            setConfirmPayment(null);
            setShowBoostModal(false);
          }}
          onConfirm={sendPayment}
        />
      )}

    </div>
  );
};

export default NowPlayingScreen;