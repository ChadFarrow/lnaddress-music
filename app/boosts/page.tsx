'use client';

import { useState, useEffect } from 'react';
import { getBoostToNostrService } from '@/lib/boost-to-nostr-service';
import { type Event } from 'nostr-tools';
import { nip19 } from 'nostr-tools';
import Link from 'next/link';

interface ParsedBoost {
  id: string;
  author: string;
  authorNpub: string;
  content: string;
  amount?: string;
  trackTitle?: string;
  trackArtist?: string;
  trackAlbum?: string;
  timestamp: number;
  tags: string[][];
  url?: string;
  replies?: ParsedReply[];
  isFromApp?: boolean;  // Flag to indicate if this boost is from the app's account
}

interface ParsedReply {
  id: string;
  author: string;
  authorNpub: string;
  content: string;
  timestamp: number;
}

function parseBoostFromEvent(event: Event): ParsedBoost | null {
  try {
    // Extract amount from content (looking for "⚡ X sats")
    const amountMatch = event.content.match(/⚡\s*([\d.]+[MkK]?)\s*sats/);
    const amount = amountMatch ? amountMatch[1] : undefined;

    // Extract track info from content
    const titleMatch = event.content.match(/"([^"]+)"/);
    const trackTitle = titleMatch ? titleMatch[1] : undefined;

    const artistMatch = event.content.match(/by\s+([^\\n]+)/);
    const trackArtist = artistMatch ? artistMatch[1].trim() : undefined;

    const albumMatch = event.content.match(/From:\s*([^\\n]+)/);
    const trackAlbum = albumMatch ? albumMatch[1].trim() : undefined;

    // Extract URL from content
    const urlMatch = event.content.match(/🎧\s*(https?:\/\/[^\s]+)/);
    const url = urlMatch ? urlMatch[1] : undefined;

    // Create npub from pubkey
    const authorNpub = nip19.npubEncode(event.pubkey);

    return {
      id: event.id,
      author: event.pubkey,
      authorNpub,
      content: event.content,
      amount,
      trackTitle,
      trackArtist,
      trackAlbum,
      timestamp: event.created_at,
      tags: event.tags,
      url
    };
  } catch (error) {
    console.error('Error parsing boost event:', error);
    return null;
  }
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor(diff / (1000 * 60));

  if (days > 7) {
    return date.toLocaleDateString();
  } else if (days > 0) {
    return `${days}d ago`;
  } else if (hours > 0) {
    return `${hours}h ago`;
  } else if (minutes > 0) {
    return `${minutes}m ago`;
  } else {
    return 'just now';
  }
}

export default function BoostsPage() {

  const [boosts, setBoosts] = useState<ParsedBoost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedBoosts, setExpandedBoosts] = useState<Set<string>>(new Set());

  const loadBoosts = async () => {
    try {
      setLoading(true);
      setError(null);

      const service = getBoostToNostrService();

      // Get the site's Nostr account from environment
      let appPubkey = process.env.NEXT_PUBLIC_SITE_NOSTR_NPUB;

      // Decode npub to hex if needed
      if (appPubkey && appPubkey.startsWith('npub')) {
        try {
          const { data } = nip19.decode(appPubkey);
          const hexPubkey = data as string;
          console.log(`Using site account: ${appPubkey}`);
          appPubkey = hexPubkey;
        } catch (error) {
          console.error('Failed to decode npub:', error);
          return;
        }
      } else {
        console.error('NEXT_PUBLIC_SITE_NOSTR_NPUB not configured');
        setError('Site Nostr account not configured');
        return;
      }

      // Fetch boosts from the historical account
      let allBoosts: any[] = [];

      try {
        console.log(`Fetching boosts from account: ${appPubkey.substring(0, 8)}...`);

        // Add timeout to prevent hanging
        const fetchWithTimeout = Promise.race([
          service.fetchUserBoosts(appPubkey, 100), // Check more events for historical data
          new Promise<[]>((_, reject) =>
            setTimeout(() => reject(new Error('Fetch timeout after 5 seconds')), 5000)
          )
        ]);

        allBoosts = await fetchWithTimeout;
        console.log(`Found ${allBoosts.length} total events from this account`);
      } catch (error) {
        console.warn(`Failed to fetch boosts:`, error);
        allBoosts = [];
      }

      const parsedBoosts: ParsedBoost[] = [];

      for (const event of allBoosts) {
        // Try to parse boost
        const parsedBoost = parseBoostFromEvent(event);
        if (parsedBoost) {
          parsedBoost.isFromApp = true;
          // Skip fetching replies for now to speed up debugging
          parsedBoost.replies = [];
          parsedBoosts.push(parsedBoost);
        }
      }

      // Sort by timestamp (newest first)
      parsedBoosts.sort((a, b) => {
        const timeA = a.timestamp || 0;
        const timeB = b.timestamp || 0;
        return timeB - timeA;
      });

      setBoosts(parsedBoosts);
    } catch (err) {
      console.error('Error loading boosts:', err);
      setError('Failed to load boosts from Nostr relays');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBoosts();
  }, []);

  const filteredBoosts = boosts;

  // Calculate statistics
  const totalBoosts = boosts.length;
  const totalSats = boosts.reduce((sum, boost) => {
    if (!boost.amount) return sum;

    let sats = 0;
    const amount = boost.amount;

    if (amount.endsWith('M')) {
      sats = parseFloat(amount.slice(0, -1)) * 1000000;
    } else if (amount.endsWith('k') || amount.endsWith('K')) {
      sats = parseFloat(amount.slice(0, -1)) * 1000;
    } else {
      sats = parseFloat(amount);
    }

    return sum + sats;
  }, 0);

  const toggleBoostExpansion = (boostId: string) => {
    setExpandedBoosts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(boostId)) {
        newSet.delete(boostId);
      } else {
        newSet.add(boostId);
      }
      return newSet;
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
              ⚡ Boosts
            </h1>
            <p className="text-gray-400">
              Recent boosts sent from this site and their replies from the Nostr network
            </p>
          </div>

          <button
            onClick={loadBoosts}
            className="px-4 py-2 bg-gray-800 text-gray-400 rounded-lg hover:bg-gray-700 transition"
          >
            🔄 Refresh
          </button>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="bg-gray-800/50 rounded-lg p-6 backdrop-blur-sm">
            <div className="text-2xl font-bold text-yellow-400">{totalBoosts}</div>
            <div className="text-gray-400">Total Boosts</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-6 backdrop-blur-sm">
            <div className="text-2xl font-bold text-orange-400">
              {totalSats.toLocaleString()} sats
            </div>
            <div className="text-gray-400">Total Value</div>
          </div>
        </div>


        {/* Content */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent"></div>
            <p className="mt-4 text-gray-400">Loading boosts from Nostr relays...</p>
          </div>
        ) : error ? (
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-6 text-center">
            <p className="text-red-400">{error}</p>
            <button
              onClick={loadBoosts}
              className="mt-4 px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
            >
              Try Again
            </button>
          </div>
        ) : filteredBoosts.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-xl mb-2">No boosts found</p>
            <p className="text-sm">
              Be the first to send a boost!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredBoosts.map((boost) => (
              <div
                key={boost.id}
                className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 hover:bg-gray-800/70 transition"
              >
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  {/* Boost Info */}
                  <div className="flex-1">
                    {/* Amount and Track */}
                    <div className="flex items-center gap-3 mb-2">
                      {boost.amount && (
                        <span className="text-2xl font-bold text-yellow-400">
                          ⚡ {boost.amount} sats
                        </span>
                      )}
                      {boost.trackTitle && (
                        <span className="text-lg text-white">
                          • "{boost.trackTitle}"
                        </span>
                      )}
                    </div>

                    {/* Artist and Album */}
                    {(boost.trackArtist || boost.trackAlbum) && (
                      <div className="text-gray-400 mb-3">
                        {boost.trackArtist && <span>by {boost.trackArtist}</span>}
                        {boost.trackAlbum && <span> • From: {boost.trackAlbum}</span>}
                      </div>
                    )}

                    {/* Content/Comment */}
                    <div className="text-gray-300 mb-3 whitespace-pre-wrap break-words">
                      {boost.content.split('\\n').map((line, i) => {
                        // Skip lines that are already shown above
                        if (line.includes('⚡') && line.includes('sats')) return null;
                        if (line.includes('"') && boost.trackTitle && line.includes(boost.trackTitle)) return null;
                        if (boost.trackArtist && line.includes(`by ${boost.trackArtist}`)) return null;
                        if (boost.trackAlbum && line.includes(`From: ${boost.trackAlbum}`)) return null;
                        if (line.includes('🎧')) return null;
                        if (line.includes('nostr:')) return null;
                        if (!line.trim()) return null;

                        return <div key={i}>{line}</div>;
                      }).filter(Boolean)}
                    </div>

                    {/* Links and Actions */}
                    <div className="flex flex-wrap gap-3 items-center">
                      {boost.url && (
                        <a
                          href={boost.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-orange-400 hover:text-orange-300 transition"
                        >
                          🎧 Listen
                        </a>
                      )}
                      <a
                        href={`https://primal.net/e/${boost.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-400 hover:text-purple-300 transition"
                      >
                        View on Nostr
                      </a>
                      <a
                        href={`https://primal.net/p/${boost.author}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 transition"
                      >
                        Profile
                      </a>

                      {/* Show replies button if there are replies */}
                      {boost.replies && boost.replies.length > 0 && (
                        <button
                          onClick={() => toggleBoostExpansion(boost.id)}
                          className="text-gray-400 hover:text-gray-300 transition flex items-center gap-1"
                        >
                          💬 {boost.replies.length} {boost.replies.length === 1 ? 'reply' : 'replies'}
                          <span className="text-xs">
                            {expandedBoosts.has(boost.id) ? '▼' : '▶'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Timestamp */}
                  <div className="text-gray-500 text-sm">
                    {formatTimestamp(boost.timestamp)}
                  </div>
                </div>

                {/* Replies Section */}
                {boost.replies && boost.replies.length > 0 && expandedBoosts.has(boost.id) && (
                  <div className="mt-4 pl-4 border-l-2 border-gray-700 space-y-3">
                    <div className="text-sm text-gray-400 font-semibold">Replies:</div>
                    {boost.replies.map((reply) => (
                      <div
                        key={reply.id}
                        className="bg-gray-900/50 rounded-lg p-4"
                      >
                        <div className="flex flex-col gap-2">
                          {/* Reply content */}
                          <div className="text-gray-300 text-sm break-words">
                            {reply.content}
                          </div>

                          {/* Reply metadata */}
                          <div className="flex flex-wrap gap-3 text-xs">
                            <a
                              href={`https://primal.net/p/${reply.author}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-300 transition"
                            >
                              {reply.authorNpub.slice(0, 12)}...
                            </a>
                            <span className="text-gray-500">
                              {formatTimestamp(reply.timestamp)}
                            </span>
                            <a
                              href={`https://primal.net/e/${reply.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-purple-400 hover:text-purple-300 transition"
                            >
                              View reply
                            </a>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}