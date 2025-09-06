'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Search, Plus, ExternalLink, AlertCircle } from 'lucide-react';

interface DiscoveredFeed {
  url: string;
  title: string;
  artist: string;
  hasAlbum: boolean;
  trackCount: number;
  podrollCount: number;
  alreadyExists: boolean;
  error?: string;
}

interface DiscoveryResult {
  discovered: DiscoveredFeed[];
  stats: {
    total: number;
    new: number;
    existing: number;
    errors: number;
    added: number;
  };
  added: string[];
}

export default function DiscoverPodrollPage() {
  const [url, setUrl] = useState('');
  const [recursive, setRecursive] = useState(true);
  const [depth, setDepth] = useState(2);
  const [autoAdd, setAutoAdd] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [result, setResult] = useState<DiscoveryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDiscover = async () => {
    if (!url.trim()) {
      setError('Please enter a feed URL');
      return;
    }

    setIsDiscovering(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/admin/discover-podroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, recursive, depth, autoAdd })
      });

      if (!response.ok) {
        throw new Error(`Discovery failed: ${response.statusText}`);
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Discovery failed');
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleAddSelected = async (feedUrl: string) => {
    try {
      const response = await fetch('/api/admin/discover-podroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: feedUrl, recursive: false, autoAdd: true })
      });

      if (response.ok) {
        // Refresh the discovery results
        await handleDiscover();
      }
    } catch (err) {
      console.error('Failed to add feed:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Header */}
      <header className="bg-black/20 backdrop-blur-sm border-b border-white/10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="p-2 hover:bg-white/10 rounded-lg transition-colors group"
              title="Back to admin dashboard"
            >
              <ArrowLeft className="w-5 h-5 group-hover:scale-110 transition-transform" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Discover Podroll Feeds</h1>
              <p className="text-gray-400 text-sm">Explore podcast networks and discover connected shows</p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Discovery Form */}
          <div className="bg-gray-800 rounded-lg p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4">Discovery Settings</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Feed URL to Start Discovery
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/feed.xml"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={recursive}
                    onChange={(e) => setRecursive(e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded"
                  />
                  <span className="text-sm">Recursive Discovery</span>
                </label>

                <div className="flex items-center gap-2">
                  <label className="text-sm">Max Depth:</label>
                  <select
                    value={depth}
                    onChange={(e) => setDepth(Number(e.target.value))}
                    disabled={!recursive}
                    className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm"
                  >
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                  </select>
                </div>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={autoAdd}
                    onChange={(e) => setAutoAdd(e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded"
                  />
                  <span className="text-sm">Auto-add New Feeds</span>
                </label>
              </div>

              <button
                onClick={handleDiscover}
                disabled={isDiscovering}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDiscovering ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Discovering...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Discover Feeds
                  </>
                )}
              </button>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}
          </div>

          {/* Results */}
          {result && (
            <div className="space-y-6">
              {/* Stats */}
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Discovery Results</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-blue-400">{result.stats.total}</div>
                    <div className="text-sm text-gray-400">Total Found</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-400">{result.stats.new}</div>
                    <div className="text-sm text-gray-400">New Feeds</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-yellow-400">{result.stats.existing}</div>
                    <div className="text-sm text-gray-400">Already Added</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-400">{result.stats.errors}</div>
                    <div className="text-sm text-gray-400">Errors</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-purple-400">{result.stats.added}</div>
                    <div className="text-sm text-gray-400">Auto-added</div>
                  </div>
                </div>
              </div>

              {/* Feed List */}
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Discovered Feeds</h3>
                <div className="space-y-2">
                  {result.discovered.map((feed, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border ${
                        feed.error
                          ? 'bg-red-900/20 border-red-800'
                          : feed.alreadyExists
                          ? 'bg-gray-700/50 border-gray-600'
                          : 'bg-green-900/20 border-green-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold mb-1">
                            {feed.title} {feed.artist && `by ${feed.artist}`}
                          </h4>
                          <div className="flex items-center gap-4 text-sm text-gray-400 mb-2">
                            <span>{feed.trackCount} tracks</span>
                            {feed.podrollCount > 0 && (
                              <span>{feed.podrollCount} podroll items</span>
                            )}
                            {feed.alreadyExists && (
                              <span className="text-yellow-400">Already in system</span>
                            )}
                            {feed.error && (
                              <span className="text-red-400 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                Error
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <a
                              href={feed.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                            >
                              {feed.url}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                          {feed.error && (
                            <div className="mt-2 text-sm text-red-400">
                              {feed.error}
                            </div>
                          )}
                        </div>
                        
                        {!feed.alreadyExists && !feed.error && feed.hasAlbum && (
                          <button
                            onClick={() => handleAddSelected(feed.url)}
                            className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                          >
                            <Plus className="w-4 h-4" />
                            Add
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}