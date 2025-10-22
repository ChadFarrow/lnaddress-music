'use client';

import { useState, useEffect } from 'react';
import { Play, Zap, Loader2 } from 'lucide-react';
import { useBreez } from '@/hooks/useBreez';

interface Episode {
  title: string;
  description: string;
  enclosureUrl: string;
  duration: string;
  pubDate: string;
  guid: string;
  image?: string;
  valueRecipients?: Array<{
    name: string;
    address: string;
    type: string;
    split: number;
  }>;
}

interface PodcastFeed {
  title: string;
  description: string;
  image: string;
  episodes: Episode[];
}

export default function TestPaymentsPage() {
  const [feed, setFeed] = useState<PodcastFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('100');
  const [processingPayment, setProcessingPayment] = useState<string | null>(null);

  const breez = useBreez();

  useEffect(() => {
    fetchFeed();
  }, []);

  const fetchFeed = async () => {
    try {
      setLoading(true);
      const response = await fetch('https://raw.githubusercontent.com/ChadFarrow/lnurl-test-feed/main/public/lnurl-test-feed.xml');
      const xmlText = await response.text();

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

      // Parse feed info
      const title = xmlDoc.querySelector('channel > title')?.textContent || 'LNURL Test Podcast';
      const description = xmlDoc.querySelector('channel > description')?.textContent || '';
      const image = xmlDoc.querySelector('channel > image > url')?.textContent || '';

      // Parse episodes
      const items = Array.from(xmlDoc.querySelectorAll('item'));
      const episodes: Episode[] = items.map(item => {
        const episode: Episode = {
          title: item.querySelector('title')?.textContent || 'Untitled',
          description: item.querySelector('description')?.textContent || '',
          enclosureUrl: item.querySelector('enclosure')?.getAttribute('url') || '',
          duration: item.querySelector('duration')?.textContent || '',
          pubDate: item.querySelector('pubDate')?.textContent || '',
          guid: item.querySelector('guid')?.textContent || Math.random().toString(),
          image: item.querySelector('image')?.getAttribute('href') || image
        };

        // Parse value recipients from episode-specific value block
        const valueRecipients = Array.from(item.querySelectorAll('value > valueRecipient'));
        if (valueRecipients.length > 0) {
          episode.valueRecipients = valueRecipients.map(recipient => ({
            name: recipient.getAttribute('name') || '',
            address: recipient.getAttribute('address') || '',
            type: recipient.getAttribute('type') || '',
            split: parseInt(recipient.getAttribute('split') || '0')
          }));
        }

        return episode;
      });

      setFeed({ title, description, image, episodes });
    } catch (err) {
      console.error('Failed to fetch feed:', err);
      setError('Failed to load test feed');
    } finally {
      setLoading(false);
    }
  };

  const sendPayment = async (episode: Episode) => {
    if (!breez.isConnected) {
      alert('Please connect your Lightning wallet first');
      return;
    }

    const amount = parseInt(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid payment amount');
      return;
    }

    // Get the first Lightning address recipient
    const lnAddressRecipient = episode.valueRecipients?.find(r => r.type === 'lnaddress');
    if (!lnAddressRecipient) {
      alert('No Lightning address found for this episode');
      return;
    }

    try {
      setProcessingPayment(episode.guid);

      console.log(`Sending ${amount} sats to ${lnAddressRecipient.address}`);
      await breez.sendPayment({
        destination: lnAddressRecipient.address,
        amountSats: amount,
        label: `Test payment for: ${episode.title}`,
        message: `Payment from test feed`
      });

      alert(`Successfully sent ${amount} sats!`);
    } catch (err) {
      console.error('Payment failed:', err);
      alert(`Payment failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setProcessingPayment(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error || !feed) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Error Loading Feed</h1>
          <p className="text-gray-600">{error || 'Feed not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Feed Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-start space-x-4">
            {feed.image && (
              <img
                src={feed.image}
                alt={feed.title}
                className="w-24 h-24 rounded-lg object-cover"
              />
            )}
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">{feed.title}</h1>
              <p className="text-gray-600">{feed.description}</p>
              <div className="mt-4 flex items-center space-x-2">
                <Zap className="w-4 h-4 text-purple-600" />
                <span className="text-sm text-purple-600 font-medium">Lightning Payments Enabled</span>
              </div>
            </div>
          </div>
        </div>

        {/* Wallet Status */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-purple-900">Wallet Status</h3>
              <p className="text-sm text-purple-700">
                {breez.isConnected ? (
                  <>Connected • Balance: {breez.balance?.toLocaleString() || 0} sats</>
                ) : (
                  'Not connected - Click the wallet icon in the header to connect'
                )}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="w-24 px-3 py-2 border border-purple-300 rounded-lg text-sm"
                placeholder="Amount"
                min="1"
              />
              <span className="text-sm text-purple-700">sats</span>
            </div>
          </div>
        </div>

        {/* Episodes */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Episodes</h2>
          {feed.episodes.map((episode) => (
            <div key={episode.guid} className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">{episode.title}</h3>
                  <p className="text-sm text-gray-600 mb-3">{episode.description}</p>
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span>{episode.duration}</span>
                    <span>{new Date(episode.pubDate).toLocaleDateString()}</span>
                  </div>

                  {/* Value Recipients */}
                  {episode.valueRecipients && episode.valueRecipients.length > 0 && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs font-semibold text-gray-700 mb-2">Payment Split:</p>
                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                        {episode.valueRecipients.map((recipient, idx) => (
                          <div key={idx} className="flex items-center justify-between">
                            <span className="truncate">{recipient.name}</span>
                            <span className="font-mono">{recipient.split}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="ml-4 flex flex-col space-y-2">
                  <button
                    onClick={() => sendPayment(episode)}
                    disabled={!breez.isConnected || processingPayment === episode.guid}
                    className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {processingPayment === episode.guid ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Sending...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        <span className="text-sm">Send {paymentAmount}</span>
                      </>
                    )}
                  </button>

                  <a
                    href={episode.enclosureUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <Play className="w-4 h-4" />
                    <span className="text-sm">Play</span>
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
