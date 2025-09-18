'use client';

import { useState, useEffect } from 'react';
import { getBoostToNostrService } from '@/lib/boost-to-nostr-service';
import { type Event } from 'nostr-tools';
import { nip19, SimplePool } from 'nostr-tools';
import Link from 'next/link';

interface ParsedBoost {
  id: string;
  author: string;
  authorNpub: string;
  authorName?: string;  // Display name of the user
  content: string;
  userMessage?: string;  // User's custom message/comment
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
  authorName?: string;
  content: string;
  timestamp: number;
  replies?: ParsedReply[];  // Nested replies for threading
  depth?: number;          // Depth level for indentation
}

function parseBoostFromEvent(event: Event): ParsedBoost | null {
  try {
    // Extract amount from content (looking for "⚡ X sats")
    const amountMatch = event.content.match(/⚡\s*([\d.]+[MkK]?)\s*sats/);
    const amount = amountMatch ? amountMatch[1] : undefined;

    // Extract track info from content
    const titleMatch = event.content.match(/"([^"]+)"/);
    const trackTitle = titleMatch ? titleMatch[1] : undefined;

    // Look for track artist after "by" (but not "Sent by")
    let trackArtist: string | undefined;
    const artistMatches = event.content.match(/\sby:?\s+([^\\n]+)/g);
    if (artistMatches) {
      for (const match of artistMatches) {
        if (!match.includes('Sent by')) {
          const artistMatch = match.match(/by:?\s+(.+)/);
          if (artistMatch) {
            trackArtist = artistMatch[1].trim();
            break;
          }
        }
      }
    }

    // Look for sender after "Sent by" - be more flexible with whitespace and line endings
    const sentByMatch = event.content.match(/Sent\s+by:?\s+(.+?)(?=\n|$|🎧|nostr:)/i);
    const trackAlbum = sentByMatch ? sentByMatch[1].trim() : undefined;

    // Extract URL from content
    const urlMatch = event.content.match(/🎧\s*(https?:\/\/[^\s]+)/);
    const url = urlMatch ? urlMatch[1] : undefined;

    // Extract user message (text that isn't metadata)
    let userMessage: string | undefined = event.content;

    // Remove the standard boost formatting to get user's custom message
    userMessage = userMessage.replace(/⚡\s*[\d.]+[MkK]?\s*sats/, '').trim();
    if (trackTitle) {
      userMessage = userMessage.replace(new RegExp(`"${trackTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g'), '').trim();
    }
    if (trackArtist) {
      userMessage = userMessage.replace(new RegExp(`by\\s+${trackArtist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g'), '').trim();
    }
    if (trackAlbum) {
      userMessage = userMessage.replace(new RegExp(`Sent\\s+by:?\\s*${trackAlbum.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi'), '').trim();
    }
    userMessage = userMessage.replace(/🎧\s*https?:\/\/[^\s]+/, '').trim();
    userMessage = userMessage.replace(/nostr:[a-zA-Z0-9]+/, '').trim();
    userMessage = userMessage.replace(/\n+/g, ' ').trim();

    // If there's no meaningful message left, set to undefined
    if (!userMessage || userMessage.length < 3) {
      userMessage = undefined;
    }

    // Create npub from pubkey
    const authorNpub = nip19.npubEncode(event.pubkey);

    // Try to get author name from profile tags (this would need to be fetched separately in a real implementation)
    const authorName = event.pubkey.substring(0, 8) + '...'; // Fallback to truncated pubkey


    return {
      id: event.id,
      author: event.pubkey,
      authorNpub,
      authorName,
      content: event.content,
      userMessage,
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

async function fetchUserProfile(pubkey: string): Promise<string | undefined> {
  try {
    const pool = new SimplePool();
    const relays = [
      'wss://relay.primal.net',
      'wss://relay.damus.io',
      'wss://nos.lol'
    ];

    const profiles = await pool.querySync(relays, {
      kinds: [0], // Metadata events
      authors: [pubkey],
      limit: 1
    });

    if (profiles.length > 0) {
      const metadata = JSON.parse(profiles[0].content);
      return metadata.display_name || metadata.name || undefined;
    }

    pool.close(relays);
    return undefined;
  } catch (error) {
    console.warn('Failed to fetch user profile:', error);
    return undefined;
  }
}

function buildThreadedReplies(events: any[], rootEventId: string): ParsedReply[] {
  // Create a map of event ID to reply object
  const replyMap = new Map<string, ParsedReply>();
  const childrenMap = new Map<string, string[]>(); // parent ID -> child IDs

  // First pass: create all reply objects
  for (const event of events) {
    const reply: ParsedReply = {
      id: event.id,
      author: event.pubkey,
      authorNpub: nip19.npubEncode(event.pubkey),
      content: event.content,
      timestamp: event.created_at,
      replies: [],
      depth: 0
    };
    replyMap.set(event.id, reply);
  }

  // Second pass: build parent-child relationships
  for (const event of events) {
    const eTags = event.tags.filter((tag: string[]) => tag[0] === 'e');

    // Find the parent this reply is responding to
    let parentId = rootEventId; // Default to root

    // Look for the most recent 'e' tag which usually indicates the direct parent
    if (eTags.length > 0) {
      // The last e tag is typically the direct parent being replied to
      parentId = eTags[eTags.length - 1][1];
    }

    // Add this reply as a child of its parent
    if (!childrenMap.has(parentId)) {
      childrenMap.set(parentId, []);
    }
    childrenMap.get(parentId)!.push(event.id);
  }

  // Third pass: build the threaded structure recursively
  function buildChildren(parentId: string, depth: number): ParsedReply[] {
    const children = childrenMap.get(parentId) || [];
    const result: ParsedReply[] = [];

    for (const childId of children) {
      const reply = replyMap.get(childId);
      if (reply) {
        reply.depth = depth;
        reply.replies = buildChildren(childId, depth + 1);
        result.push(reply);
      }
    }

    // Sort by timestamp (oldest first for chronological order)
    result.sort((a, b) => a.timestamp - b.timestamp);
    return result;
  }

  // Start with direct replies to the root event
  return buildChildren(rootEventId, 0);
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

// Recursive component for displaying threaded replies
function ThreadedReply({ reply, maxDepth = 3 }: { reply: ParsedReply; maxDepth?: number }) {
  const indentLevel = Math.min(reply.depth || 0, maxDepth);
  const marginLeft = indentLevel * 16; // 16px per level

  return (
    <div
      style={{ marginLeft: `${marginLeft}px` }}
      className={reply.depth && reply.depth > 0 ? 'border-l border-gray-700 pl-4' : ''}
    >
      <div className="bg-gray-900/50 rounded-lg p-4 mb-3">
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
              {reply.authorName || `${reply.authorNpub.slice(0, 12)}...`}
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
            {reply.depth !== undefined && reply.depth < maxDepth && (
              <span className="text-gray-600 text-xs">
                Level {reply.depth + 1}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Nested replies */}
      {reply.replies && reply.replies.length > 0 && (
        <div className="mt-2">
          {reply.replies.map((nestedReply) => (
            <ThreadedReply
              key={nestedReply.id}
              reply={nestedReply}
              maxDepth={maxDepth}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function BoostsPage() {

  const [boosts, setBoosts] = useState<ParsedBoost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedBoosts, setExpandedBoosts] = useState<Set<string>>(new Set());
  const [isRealTimeActive, setIsRealTimeActive] = useState(false);
  const [lastCacheTime, setLastCacheTime] = useState<number | null>(null);

  const loadBoosts = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);

      // Skip cache for now to test reply fetching
      // TODO: Re-enable cache after fixing reply state management
      console.log('⚠️ Cache temporarily disabled for debugging');

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
          service.fetchUserBoosts(appPubkey, 50), // Reduce to 50 most recent for faster loading
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

      // Parse boosts and fetch replies progressively
      const parsedBoosts: ParsedBoost[] = [];

      // Process each boost and immediately fetch its replies
      for (let i = 0; i < allBoosts.length; i++) {
        const event = allBoosts[i];
        const parsedBoost = parseBoostFromEvent(event);

        if (parsedBoost) {
          parsedBoost.isFromApp = true;
          parsedBoost.replies = []; // Start with empty replies
          parsedBoosts.push(parsedBoost);

          // Sort and update the display immediately after adding each boost
          const sortedBoosts = [...parsedBoosts].sort((a, b) => {
            const timeA = a.timestamp || 0;
            const timeB = b.timestamp || 0;
            return timeB - timeA;
          });

          setBoosts(sortedBoosts);
          setLoading(false); // Set loading to false after first boost

          // Start reply fetching in the background for first 5 boosts only (for faster loading)
          if (i < 5) {
            // Don't await - fetch replies in background
            setTimeout(async () => {
              try {
                // Use a shorter timeout for reply fetching
                const timeoutPromise = new Promise<never>((_, reject) =>
                  setTimeout(() => reject(new Error('Reply fetch timeout')), 3000)
                );

                const replies = await Promise.race([
                  service.fetchReplies(parsedBoost.id, 10), // Reduced limit
                  timeoutPromise
                ]);

                if (replies.length > 0) {
                  console.log(`Found ${replies.length} replies for boost ${parsedBoost.id.substring(0, 8)}`);
                }

                if (replies.length > 0) {
                  // Map replies without fetching user profiles for faster display
                  const mappedReplies = replies.map(reply => ({
                    id: reply.id,
                    author: reply.pubkey,
                    authorNpub: nip19.npubEncode(reply.pubkey),
                    authorName: reply.pubkey.substring(0, 8) + '...', // Use truncated key for now
                    content: reply.content,
                    timestamp: reply.created_at,
                    depth: 0,
                    replies: []
                  }));

                  // Update the specific boost with replies
                  setBoosts(prev => prev.map(b =>
                    b.id === parsedBoost.id ? { ...b, replies: mappedReplies } : b
                  ));
                }
              } catch (error) {
                console.warn('Failed to fetch replies for boost:', parsedBoost.id, error);
              }
            }, i * 100); // Stagger requests by 100ms each
          }
        }
      }

      // TODO: Re-enable caching after fixing reply state management
      console.log(`Processed ${parsedBoosts.length} boosts (caching disabled)`);
    } catch (err) {
      console.error('Error loading boosts:', err);
      setError('Failed to load boosts from Nostr relays');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBoosts();

    // Set up real-time subscription for new boosts
    const service = getBoostToNostrService();

    // Get the site's Nostr account from environment
    let appPubkey = process.env.NEXT_PUBLIC_SITE_NOSTR_NPUB;

    if (appPubkey && appPubkey.startsWith('npub')) {
      try {
        const { data } = nip19.decode(appPubkey);
        appPubkey = data as string;

        // Subscribe to new boosts from this account
        const subscription = service.subscribeToBoosts(
          { authors: [appPubkey] },
          {
            onBoost: async (event) => {
              const parsedBoost = parseBoostFromEvent(event);
              if (parsedBoost) {
                parsedBoost.isFromApp = true;

                // Fetch threaded replies for real-time boost
                try {
                  const threadedReplies = await service.fetchThreadedReplies(event.id, 3, 20);
                  const mappedReplies = buildThreadedReplies(threadedReplies, event.id);

                  // Recursively enrich replies with user profiles
                  const enrichRepliesWithProfiles = async (replies: ParsedReply[]): Promise<ParsedReply[]> => {
                    return Promise.all(replies.map(async reply => {
                      const authorName = await fetchUserProfile(reply.author);
                      const enrichedReply = { ...reply, authorName };

                      // Recursively enrich nested replies
                      if (reply.replies && reply.replies.length > 0) {
                        enrichedReply.replies = await enrichRepliesWithProfiles(reply.replies);
                      }

                      return enrichedReply;
                    }));
                  };

                  const enrichedReplies = await enrichRepliesWithProfiles(mappedReplies);

                  parsedBoost.replies = enrichedReplies;
                } catch (error) {
                  console.warn('Failed to fetch threaded replies for real-time boost:', event.id, error);
                  parsedBoost.replies = [];
                }

                setBoosts(prev => {
                  // Check if boost already exists
                  const exists = prev.some(b => b.id === parsedBoost.id);
                  if (exists) return prev;

                  // Add new boost to the beginning and sort by timestamp
                  const updated = [parsedBoost, ...prev];
                  return updated.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                });
              }
            },
            onError: (err) => {
              console.error('Real-time boost subscription error:', err);
              setIsRealTimeActive(false);
            }
          }
        );

        setIsRealTimeActive(true);

        // Cleanup subscription on unmount
        return () => {
          if (subscription && typeof subscription.close === 'function') {
            subscription.close();
          }
          setIsRealTimeActive(false);
        };
      } catch (error) {
        console.error('Failed to set up real-time subscription:', error);
      }
    }
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
            <div className="flex items-center gap-3">
              <p className="text-gray-400">
                Recent boosts sent from this site and their replies from the Nostr network
              </p>
              {isRealTimeActive && (
                <div className="flex items-center gap-2 text-green-400 text-sm">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  Live Updates
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={() => loadBoosts(true)}
              className="px-4 py-2 bg-gray-800 text-gray-400 rounded-lg hover:bg-gray-700 transition"
            >
              🔄 Refresh
            </button>
            {lastCacheTime && (
              <div className="text-xs text-gray-500">
                Cached {formatTimestamp(Math.floor(lastCacheTime / 1000))}
              </div>
            )}
          </div>
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
              onClick={() => loadBoosts(true)}
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
                        {boost.trackAlbum && <span> • Sent by: {boost.trackAlbum}</span>}
                      </div>
                    )}

                    {/* User Info and Message - only for external boosts */}
                    {!boost.isFromApp && (
                      <div className="mb-3">
                        {/* User Name */}
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-blue-400 font-medium">
                            {boost.authorName || `${boost.author.substring(0, 8)}...`}
                          </span>
                          <span className="text-gray-500 text-sm">
                            boosted this track
                          </span>
                        </div>

                        {/* User Message */}
                        {boost.userMessage && (
                          <div className="text-gray-300 italic bg-gray-800/30 rounded-lg p-3 border-l-2 border-blue-400/50">
                            "{boost.userMessage}"
                          </div>
                        )}
                      </div>
                    )}

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

                {/* Threaded Replies Section */}
                {boost.replies && boost.replies.length > 0 && expandedBoosts.has(boost.id) && (
                  <div className="mt-4 border-l-2 border-gray-700 pl-4">
                    <div className="text-sm text-gray-400 font-semibold mb-3">
                      Replies ({boost.replies.length}):
                    </div>
                    <div className="space-y-2">
                      {boost.replies.map((reply) => (
                        <ThreadedReply
                          key={reply.id}
                          reply={reply}
                          maxDepth={3}
                        />
                      ))}
                    </div>
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