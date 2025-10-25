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
  const [testFeed, setTestFeed] = useState<PodcastFeed | null>(null);
  const [pc20Feed, setPC20Feed] = useState<PodcastFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('100');
  const [paymentMessage, setPaymentMessage] = useState('');
  const [senderName, setSenderName] = useState('');
  const [processingPayment, setProcessingPayment] = useState<string | null>(null);
  const [confirmPayment, setConfirmPayment] = useState<{
    episode: Episode;
    amount: number;
    recipients: Array<{ name: string; address: string; split: number; amount: number }>;
    processing?: boolean;
    recipientStatus?: Map<string, { status: 'pending' | 'processing' | 'success' | 'failed'; error?: string }>;
  } | null>(null);
  const [paymentResults, setPaymentResults] = useState<{
    amount: number;
    episodeTitle: string;
    results: Array<{
      name: string;
      success: boolean;
      skipped: boolean;
      amount: number;
      error?: string;
    }>;
  } | null>(null);

  const breez = useBreez();

  // Load sender name from localStorage on mount
  useEffect(() => {
    const savedName = localStorage.getItem('test-payments:sender-name');
    if (savedName) {
      setSenderName(savedName);
    }
  }, []);

  // Save sender name to localStorage when it changes
  useEffect(() => {
    if (senderName) {
      localStorage.setItem('test-payments:sender-name', senderName);
    }
  }, [senderName]);

  useEffect(() => {
    fetchFeed();
  }, []);

  const fetchFeed = async () => {
    try {
      setLoading(true);

      // Fetch both feeds in parallel
      const [testFeedResponse, pc20Response] = await Promise.all([
        fetch('https://raw.githubusercontent.com/ChadFarrow/lnurl-test-feed/main/public/lnurl-test-feed.xml'),
        fetch('https://feeds.podcastindex.org/pc20.xml')
      ]);

      const [testFeedXml, pc20Xml] = await Promise.all([
        testFeedResponse.text(),
        pc20Response.text()
      ]);

      const parser = new DOMParser();

      // Parse test feed
      const testDoc = parser.parseFromString(testFeedXml, 'text/xml');
      const testTitle = testDoc.querySelector('channel > title')?.textContent || 'LNURL Test Podcast';
      const testDescription = testDoc.querySelector('channel > description')?.textContent || '';
      const testImage = testDoc.querySelector('channel > image > url')?.textContent || '';
      const testItems = Array.from(testDoc.querySelectorAll('item'));

      // Parse PC20 feed
      const pc20Doc = parser.parseFromString(pc20Xml, 'text/xml');
      const pc20Title = pc20Doc.querySelector('channel > title')?.textContent || 'Podcasting 2.0';
      const pc20Description = pc20Doc.querySelector('channel > description')?.textContent || '';
      const pc20Image = pc20Doc.querySelector('channel image url')?.textContent ||
                        pc20Doc.querySelector('channel itunes\\:image')?.getAttribute('href') || '';

      // Find episode 239 from PC20 feed
      const pc20Items = Array.from(pc20Doc.querySelectorAll('item'));
      const episode239 = pc20Items.find(item =>
        item.querySelector('title')?.textContent?.includes('Episode 239')
      );

      // Parse test feed episodes
      const testEpisodes: Episode[] = testItems.map(item => {
        const episode: Episode = {
          title: item.querySelector('title')?.textContent || 'Untitled',
          description: item.querySelector('description')?.textContent || '',
          enclosureUrl: item.querySelector('enclosure')?.getAttribute('url') || '',
          duration: item.querySelector('itunes\\:duration, duration')?.textContent || '',
          pubDate: item.querySelector('pubDate')?.textContent || '',
          guid: item.querySelector('guid')?.textContent || Math.random().toString(),
          image: item.querySelector('itunes\\:image')?.getAttribute('href') ||
                 item.querySelector('image')?.getAttribute('href') ||
                 testImage
        };

        // Parse value recipients from episode-specific value block
        const valueRecipients = Array.from(item.querySelectorAll('podcast\\:value > podcast\\:valueRecipient, value > valueRecipient'));
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

      // Parse PC20 episode 239
      const pc20Episodes: Episode[] = [];
      if (episode239) {
        const episode: Episode = {
          title: episode239.querySelector('title')?.textContent || 'Untitled',
          description: episode239.querySelector('description')?.textContent || '',
          enclosureUrl: episode239.querySelector('enclosure')?.getAttribute('url') || '',
          duration: episode239.querySelector('itunes\\:duration, duration')?.textContent || '',
          pubDate: episode239.querySelector('pubDate')?.textContent || '',
          guid: episode239.querySelector('guid')?.textContent || Math.random().toString(),
          image: episode239.querySelector('itunes\\:image')?.getAttribute('href') ||
                 episode239.querySelector('image')?.getAttribute('href') ||
                 pc20Image
        };

        // Parse value recipients from episode-specific value block
        const valueRecipients = Array.from(episode239.querySelectorAll('podcast\\:value > podcast\\:valueRecipient, value > valueRecipient'));
        if (valueRecipients.length > 0) {
          episode.valueRecipients = valueRecipients.map(recipient => ({
            name: recipient.getAttribute('name') || '',
            address: recipient.getAttribute('address') || '',
            type: recipient.getAttribute('type') || '',
            split: parseInt(recipient.getAttribute('split') || '0')
          }));
        }

        pc20Episodes.push(episode);
      }

      setTestFeed({
        title: testTitle,
        description: testDescription,
        image: testImage,
        episodes: testEpisodes
      });

      setPC20Feed({
        title: pc20Title,
        description: pc20Description,
        image: pc20Image,
        episodes: pc20Episodes
      });
    } catch (err) {
      console.error('Failed to fetch feed:', err);
      setError('Failed to load test feed');
    } finally {
      setLoading(false);
    }
  };

  // Show confirmation modal
  const showPaymentConfirmation = (episode: Episode) => {
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

    // Calculate total splits for Lightning addresses only
    const totalLnSplit = lnAddressRecipients.reduce((sum, r) => sum + r.split, 0);

    // Prepare recipient details with calculated amounts
    const recipients = lnAddressRecipients.map(r => ({
      name: r.name,
      address: r.address,
      split: r.split,
      amount: Math.floor((amount * r.split) / totalLnSplit)
    }));

    setConfirmPayment({ episode, amount, recipients });
  };

  // Actually send the payment after confirmation
  const sendPayment = async () => {
    if (!confirmPayment) return;

    const { episode, amount, recipients } = confirmPayment;

    try {
      setProcessingPayment(episode.guid);

      // Initialize status map for all recipients
      const statusMap = new Map<string, { status: 'pending' | 'processing' | 'success' | 'failed'; error?: string }>();
      recipients.forEach(r => {
        statusMap.set(r.address, { status: 'pending' });
      });

      // Set modal to processing state
      setConfirmPayment({
        ...confirmPayment,
        processing: true,
        recipientStatus: statusMap
      });

      console.log(`Sending ${amount} sats split among ${recipients.length} recipients sequentially`);

      // Send payments sequentially to avoid Spark SDK signing conflicts
      const results: Array<{
        success: boolean;
        name: string;
        skipped: boolean;
        amount: number;
        error?: string;
      }> = [];

      for (const recipient of recipients) {
        const recipientAmount = recipient.amount;

        if (recipientAmount > 0) {
          console.log(`Sending ${recipientAmount} sats (${recipient.split}%) to ${recipient.name} (${recipient.address})`);

          // Update status to processing
          setConfirmPayment(prev => {
            if (!prev) return null;
            const newStatusMap = new Map(prev.recipientStatus);
            newStatusMap.set(recipient.address, { status: 'processing' });
            return { ...prev, recipientStatus: newStatusMap };
          });

          try {
            // Build the message with sender name if provided
            let fullMessage = paymentMessage || `Payment from test feed`;
            if (senderName) {
              fullMessage = `From ${senderName}: ${fullMessage}`;
            }

            await breez.sendPayment({
              destination: recipient.address,
              amountSats: recipientAmount,
              label: `Test payment for: ${episode.title} - ${recipient.name}`,
              message: fullMessage
            });
            console.log(`✅ Successfully sent to ${recipient.name}`);

            // Update status to success
            setConfirmPayment(prev => {
              if (!prev) return null;
              const newStatusMap = new Map(prev.recipientStatus);
              newStatusMap.set(recipient.address, { status: 'success' });
              return { ...prev, recipientStatus: newStatusMap };
            });

            results.push({
              success: true,
              name: recipient.name,
              skipped: false,
              amount: recipientAmount
            });
          } catch (err) {
            console.error(`❌ Failed to send to ${recipient.name}:`, err);

            // Update status to failed
            setConfirmPayment(prev => {
              if (!prev) return null;
              const newStatusMap = new Map(prev.recipientStatus);
              newStatusMap.set(recipient.address, {
                status: 'failed',
                error: err instanceof Error ? err.message : 'Unknown error'
              });
              return { ...prev, recipientStatus: newStatusMap };
            });

            results.push({
              success: false,
              name: recipient.name,
              skipped: false,
              amount: recipientAmount,
              error: err instanceof Error ? err.message : 'Unknown error'
            });
          }
        } else {
          results.push({
            success: false,
            name: recipient.name,
            skipped: true,
            amount: recipientAmount
          });
        }
      }

      // Close confirmation modal
      setConfirmPayment(null);

      // Show results modal
      setPaymentResults({
        amount,
        episodeTitle: episode.title,
        results
      });
    } catch (err) {
      console.error('Payment failed:', err);
      setConfirmPayment(null);
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

  if (error || (!testFeed && !pc20Feed)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Error Loading Feeds</h1>
          <p className="text-gray-400">{error || 'Feeds not found'}</p>
        </div>
      </div>
    );
  }

  // Helper function to render a feed table
  const renderFeedTable = (feed: PodcastFeed | null, feedName: string) => {
    if (!feed || feed.episodes.length === 0) return null;

    return (
      <div key={feedName} className="mb-6">
        {/* Feed Header */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-4 mb-2">
          <div className="flex items-center space-x-3">
            {feed.image && (
              <img src={feed.image} alt={feed.title} className="w-12 h-12 rounded object-cover" />
            )}
            <div>
              <h2 className="text-lg font-bold text-white">{feed.title}</h2>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Zap className="w-3 h-3 text-purple-400" />
                <span>{feed.episodes.length} episode{feed.episodes.length !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Episode Table */}
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
                      <button
                        onClick={() => {
                          const audio = new Audio(episode.enclosureUrl);
                          audio.play().catch(err => {
                            console.error('Failed to play audio:', err);
                            // Fallback: open in new tab if autoplay fails
                            window.open(episode.enclosureUrl, '_blank');
                          });
                        }}
                        className="p-2 bg-gray-700 text-gray-200 rounded hover:bg-gray-600 transition-colors"
                        title="Play"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => showPaymentConfirmation(episode)}
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
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 py-4">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Page Header */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white mb-1">Test Lightning Payments</h1>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Zap className="w-3 h-3 text-purple-400" />
                <span>Multiple test feeds with Lightning value splits</span>
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

        {/* Render both feeds */}
        {renderFeedTable(testFeed, 'test-feed')}
        {renderFeedTable(pc20Feed, 'pc20-feed')}
      </div>

      {/* Payment Confirmation Modal */}
      {confirmPayment && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-purple-500/30 rounded-2xl p-6 max-w-lg w-full shadow-2xl relative">
            {/* Close button */}
            <button
              onClick={() => setConfirmPayment(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Header */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Confirm Boost ⚡</h2>
              <p className="text-gray-300 text-sm">
                {confirmPayment.episode.title}
              </p>
            </div>

            {/* Amount */}
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 mb-4">
              <div className="text-center">
                <div className="text-gray-400 text-sm mb-1">Total Amount</div>
                <div className="text-purple-300 text-3xl font-bold">
                  {confirmPayment.amount.toLocaleString()} <span className="text-xl">sats</span>
                </div>
              </div>
            </div>

            {/* Name and Message Inputs */}
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-gray-400 text-xs mb-1">Your Name (optional, saved)</label>
                <input
                  type="text"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="Enter your name..."
                  className="w-full px-3 py-2 bg-gray-800 border border-purple-500/30 text-white rounded-lg text-sm focus:outline-none focus:border-purple-400 placeholder:text-gray-500"
                  maxLength={50}
                />
              </div>
              <div>
                <label className="block text-gray-400 text-xs mb-1">Message (optional)</label>
                <input
                  type="text"
                  value={paymentMessage}
                  onChange={(e) => setPaymentMessage(e.target.value)}
                  placeholder="Add a message..."
                  className="w-full px-3 py-2 bg-gray-800 border border-purple-500/30 text-white rounded-lg text-sm focus:outline-none focus:border-purple-400 placeholder:text-gray-500"
                  maxLength={144}
                />
              </div>
              {/* Message Preview */}
              {(senderName || paymentMessage) && (
                <div className="bg-black/30 rounded-lg p-3">
                  <div className="text-gray-400 text-xs mb-1">Preview</div>
                  <div className="text-white text-sm">
                    {senderName && `From ${senderName}: `}
                    {paymentMessage || 'Payment from test feed'}
                  </div>
                </div>
              )}
            </div>

            {/* Recipients */}
            <div className="mb-6">
              <div className="text-gray-400 text-sm mb-2">Recipients ({confirmPayment.recipients.length})</div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {confirmPayment.recipients.map((recipient, idx) => {
                  const status = confirmPayment.recipientStatus?.get(recipient.address);
                  const isProcessing = status?.status === 'processing';
                  const isSuccess = status?.status === 'success';
                  const isFailed = status?.status === 'failed';

                  return (
                    <div
                      key={idx}
                      className={`border rounded-lg p-3 flex items-center justify-between transition-colors ${
                        isSuccess ? 'bg-green-500/10 border-green-500/30' :
                        isFailed ? 'bg-red-500/10 border-red-500/30' :
                        isProcessing ? 'bg-purple-500/10 border-purple-500/30' :
                        'bg-white/5 border-white/10'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="text-white font-medium text-sm truncate">{recipient.name}</div>
                          {isProcessing && <Loader2 className="w-3 h-3 animate-spin text-purple-400" />}
                          {isSuccess && <span className="text-green-400 text-xs">✓</span>}
                          {isFailed && <span className="text-red-400 text-xs">✗</span>}
                        </div>
                        <div className="text-gray-400 text-xs truncate">{recipient.address}</div>
                        {isFailed && status.error && (
                          <div className="text-red-400 text-xs mt-1">{status.error}</div>
                        )}
                      </div>
                      <div className="text-right ml-3">
                        <div className="text-purple-300 font-semibold">{recipient.amount.toLocaleString()} sats</div>
                        <div className="text-gray-500 text-xs">{recipient.split}%</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmPayment(null)}
                disabled={confirmPayment.processing}
                className="flex-1 px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={sendPayment}
                disabled={confirmPayment.processing}
                className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {confirmPayment.processing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5" />
                    Send Boost
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Results Modal */}
      {paymentResults && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-purple-500/30 rounded-2xl p-6 max-w-2xl w-full shadow-2xl relative max-h-[90vh] overflow-y-auto">
            {/* Close button */}
            <button
              onClick={() => setPaymentResults(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Header */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Payment Results ⚡</h2>
              <p className="text-gray-300 text-sm">
                {paymentResults.episodeTitle}
              </p>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-black/30 rounded-lg p-3">
                <div className="text-gray-400 text-xs mb-1">Total Amount</div>
                <div className="text-white font-semibold text-lg">
                  {paymentResults.amount.toLocaleString()} sats
                </div>
              </div>
              <div className="bg-green-500/10 rounded-lg p-3 border border-green-500/30">
                <div className="text-gray-400 text-xs mb-1">Successful</div>
                <div className="text-green-400 font-semibold text-lg">
                  {paymentResults.results.filter(r => r.success).length}
                </div>
              </div>
              <div className="bg-red-500/10 rounded-lg p-3 border border-red-500/30">
                <div className="text-gray-400 text-xs mb-1">Failed</div>
                <div className="text-red-400 font-semibold text-lg">
                  {paymentResults.results.filter(r => !r.success && !r.skipped).length}
                </div>
              </div>
            </div>

            {/* Recipients List */}
            <div className="space-y-2 mb-6">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Recipients</h3>
              {paymentResults.results.map((result, idx) => (
                <div
                  key={idx}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    result.success
                      ? 'bg-green-500/5 border-green-500/30'
                      : result.skipped
                      ? 'bg-gray-500/5 border-gray-500/30'
                      : 'bg-red-500/5 border-red-500/30'
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1">
                    {result.success ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                    ) : result.skipped ? (
                      <div className="w-5 h-5 rounded-full bg-gray-500/30 flex items-center justify-center flex-shrink-0">
                        <span className="text-gray-400 text-xs">-</span>
                      </div>
                    ) : (
                      <X className="w-5 h-5 text-red-500 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-medium text-sm truncate">
                        {result.name}
                      </div>
                      {result.error && (
                        <div className="text-red-400 text-xs mt-1 truncate">
                          {result.error}
                        </div>
                      )}
                      {result.skipped && (
                        <div className="text-gray-400 text-xs mt-1">
                          Skipped (0 sats)
                        </div>
                      )}
                    </div>
                  </div>
                  {!result.skipped && (
                    <div className="text-right ml-3">
                      <div className={`font-mono text-sm font-semibold ${
                        result.success ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {result.amount} sats
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Close Button */}
            <button
              onClick={() => setPaymentResults(null)}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
