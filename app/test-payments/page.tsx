'use client';

import { useState, useEffect } from 'react';
import { Play, Zap, Loader2, CheckCircle2, X } from 'lucide-react';
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
  const [paymentSuccess, setPaymentSuccess] = useState<{
    amount: number;
    recipientCount: number;
    episodeTitle: string;
  } | null>(null);

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

    // Get all Lightning address recipients
    const lnAddressRecipients = episode.valueRecipients?.filter(r => r.type === 'lnaddress') || [];
    if (lnAddressRecipients.length === 0) {
      alert('No Lightning address found for this episode');
      return;
    }

    try {
      setProcessingPayment(episode.guid);

      // Calculate total splits for Lightning addresses only
      const totalLnSplit = lnAddressRecipients.reduce((sum, r) => sum + r.split, 0);

      console.log(`Sending ${amount} sats split among ${lnAddressRecipients.length} recipients sequentially`);

      // Send payments sequentially to avoid overwhelming Breez
      const results = [];
      for (const recipient of lnAddressRecipients) {
        const recipientAmount = Math.floor((amount * recipient.split) / totalLnSplit);

        if (recipientAmount > 0) {
          console.log(`Sending ${recipientAmount} sats (${recipient.split}%) to ${recipient.name} (${recipient.address})`);
          try {
            await breez.sendPayment({
              destination: recipient.address,
              amountSats: recipientAmount,
              label: `Test payment for: ${episode.title} - ${recipient.name}`,
              message: `Payment from test feed`
            });
            results.push({ success: true, name: recipient.name, skipped: false });
            console.log(`✅ Successfully sent to ${recipient.name}`);
          } catch (err) {
            console.error(`❌ Failed to send to ${recipient.name}:`, err);
            results.push({ success: false, name: recipient.name, skipped: false });
          }
        } else {
          results.push({ success: false, name: recipient.name, skipped: true });
        }
      }

      // Count successes and failures
      const successCount = results.filter(r => r.success).length;
      const failedRecipients = results.filter(r => !r.success && !r.skipped).map(r => r.name);

      if (successCount === lnAddressRecipients.length) {
        // Show success modal
        setPaymentSuccess({
          amount,
          recipientCount: successCount,
          episodeTitle: episode.title
        });
      } else if (successCount > 0) {
        alert(`Partially successful: Sent to ${successCount}/${lnAddressRecipients.length} recipients.\nFailed: ${failedRecipients.join(', ')}`);
      } else {
        alert(`All payments failed. Check console for details.`);
      }
    } catch (err) {
      console.error('Payment failed:', err);
      alert(`Payment failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setProcessingPayment(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  if (error || !feed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Error Loading Feed</h1>
          <p className="text-gray-400">{error || 'Feed not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 py-4">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Compact Header */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {feed.image && (
                <img src={feed.image} alt={feed.title} className="w-12 h-12 rounded object-cover" />
              )}
              <div>
                <h1 className="text-xl font-bold text-white">{feed.title}</h1>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Zap className="w-3 h-3 text-purple-400" />
                  <span>Lightning Enabled</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right text-sm">
                <div className="text-purple-300 font-medium">
                  {breez.isConnected ? `${breez.balance?.toLocaleString() || 0} sats` : 'Not connected'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-20 px-2 py-1 bg-gray-800 border border-purple-500/30 text-white rounded text-sm focus:outline-none focus:border-purple-400"
                  min="1"
                />
                <span className="text-xs text-purple-300">sats</span>
              </div>
            </div>
          </div>
        </div>

        {/* Compact Episode Table */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="text-left px-4 py-2 text-sm font-semibold text-gray-300">Episode</th>
                <th className="text-left px-4 py-2 text-sm font-semibold text-gray-300">Recipients</th>
                <th className="text-center px-4 py-2 text-sm font-semibold text-gray-300">Duration</th>
                <th className="text-right px-4 py-2 text-sm font-semibold text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {feed.episodes.map((episode, idx) => (
                <tr
                  key={episode.guid}
                  className={`border-b border-white/5 hover:bg-white/5 transition-colors ${idx === feed.episodes.length - 1 ? 'border-b-0' : ''}`}
                >
                  <td className="px-4 py-3">
                    <div className="text-white font-medium text-sm mb-1">{episode.title}</div>
                    <div className="text-xs text-gray-400">{new Date(episode.pubDate).toLocaleDateString()}</div>
                  </td>
                  <td className="px-4 py-3">
                    {episode.valueRecipients && episode.valueRecipients.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {episode.valueRecipients.map((recipient, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-2 py-0.5 bg-gray-800/50 border border-gray-700 rounded text-xs text-gray-300"
                          >
                            {recipient.name} <span className="ml-1 text-purple-400 font-mono">{recipient.split}%</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-500">No recipients</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-400">{episode.duration}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <a
                        href={episode.enclosureUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-gray-700 text-gray-200 rounded hover:bg-gray-600 transition-colors"
                        title="Play"
                      >
                        <Play className="w-4 h-4" />
                      </a>
                      <button
                        onClick={() => sendPayment(episode)}
                        disabled={!breez.isConnected || processingPayment === episode.guid}
                        className="flex items-center gap-1 px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                        title={`Send ${paymentAmount} sats`}
                      >
                        {processingPayment === episode.guid ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Zap className="w-4 h-4" />
                            <span>{paymentAmount}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Success Modal */}
      {paymentSuccess && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-green-500/30 rounded-2xl p-8 max-w-md w-full shadow-2xl relative">
            {/* Close button */}
            <button
              onClick={() => setPaymentSuccess(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Success Icon */}
            <div className="flex justify-center mb-6">
              <div className="bg-green-500/20 rounded-full p-4">
                <CheckCircle2 className="w-16 h-16 text-green-500" />
              </div>
            </div>

            {/* Success Message */}
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Payment Successful! ⚡</h2>
              <p className="text-gray-300">
                Your boost has been sent
              </p>
            </div>

            {/* Payment Details */}
            <div className="bg-black/30 rounded-lg p-4 mb-6 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Amount</span>
                <span className="text-white font-semibold text-lg">
                  {paymentSuccess.amount.toLocaleString()} sats
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Recipients</span>
                <span className="text-white font-semibold">
                  {paymentSuccess.recipientCount}
                </span>
              </div>
              <div className="flex flex-col pt-2 border-t border-gray-700">
                <span className="text-gray-400 text-sm mb-1">Episode</span>
                <span className="text-white font-medium">
                  {paymentSuccess.episodeTitle}
                </span>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={() => setPaymentSuccess(null)}
              className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
            >
              Awesome!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
