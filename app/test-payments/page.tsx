'use client';

import { useState, useEffect } from 'react';
import { Zap, Loader2, CheckCircle2, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useBreez } from '@/hooks/useBreez';
import { useNWC } from '@/hooks/useNWC';
import { useBitcoinConnect } from '@/contexts/BitcoinConnectContext';
import { LightningWallet } from '@/components/LightningWallet';
import { triggerSuccessConfetti } from '@/lib/ui-utils';

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
  const [customFeed, setCustomFeed] = useState<PodcastFeed | null>(null);
  const [customFeedUrl, setCustomFeedUrl] = useState('');
  const [loadingCustomFeed, setLoadingCustomFeed] = useState(false);
  const [customFeedError, setCustomFeedError] = useState<string | null>(null);
  const [collapsedFeeds, setCollapsedFeeds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('100');
  const [paymentMessage, setPaymentMessage] = useState('');
  const [senderName, setSenderName] = useState('');
  const [processingPayment, setProcessingPayment] = useState<string | null>(null);
  const [confirmPayment, setConfirmPayment] = useState<{
    episode: Episode;
    amount: number;
    recipients: Array<{
      name: string;
      address: string;
      type: string;
      split: number;
      amount: number;
      supported?: boolean;
      error?: string;
    }>;
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
  const nwc = useNWC();
  const { isConnected: walletConnected, connectedWalletType } = useBitcoinConnect();

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

  const loadCustomFeed = async () => {
    if (!customFeedUrl.trim()) {
      setCustomFeedError('Please enter a feed URL');
      return;
    }

    try {
      setLoadingCustomFeed(true);
      setCustomFeedError(null);

      const response = await fetch(customFeedUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch feed: ${response.statusText}`);
      }

      const xml = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'text/xml');

      // Check for parsing errors
      const parseError = doc.querySelector('parsererror');
      if (parseError) {
        throw new Error('Invalid RSS feed format');
      }

      const title = doc.querySelector('channel > title')?.textContent || 'Custom Feed';
      const description = doc.querySelector('channel > description')?.textContent || '';
      const image = doc.querySelector('channel image url')?.textContent ||
                    doc.querySelector('channel itunes\\:image')?.getAttribute('href') || '';
      const items = Array.from(doc.querySelectorAll('item'));

      const episodes: Episode[] = items.map(item => {
        const episode: Episode = {
          title: item.querySelector('title')?.textContent || 'Untitled',
          description: item.querySelector('description')?.textContent || '',
          enclosureUrl: item.querySelector('enclosure')?.getAttribute('url') || '',
          duration: item.querySelector('itunes\\:duration, duration')?.textContent || '',
          pubDate: item.querySelector('pubDate')?.textContent || '',
          guid: item.querySelector('guid')?.textContent || Math.random().toString(),
          image: item.querySelector('itunes\\:image')?.getAttribute('href') ||
                 item.querySelector('image')?.getAttribute('href') ||
                 image
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

      setCustomFeed({
        title,
        description,
        image,
        episodes
      });
    } catch (err) {
      console.error('Failed to load custom feed:', err);
      setCustomFeedError(err instanceof Error ? err.message : 'Failed to load feed');
      setCustomFeed(null);
    } finally {
      setLoadingCustomFeed(false);
    }
  };

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
    if (!walletConnected) {
      alert('Please connect your Lightning wallet first');
      return;
    }

    // Get all recipients (including unsupported types)
    const allRecipients = episode.valueRecipients || [];
    if (allRecipients.length === 0) {
      alert('This episode has no payment recipients configured.');
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

    const supportedRecipients = allRecipients.filter(r => supportedTypes.includes(r.type));
    const unsupportedRecipients = allRecipients.filter(r => !supportedTypes.includes(r.type));

    if (supportedRecipients.length === 0) {
      // Show styled error modal
      const errorModal = document.createElement('div');
      errorModal.className = 'fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4';
      errorModal.innerHTML = `
        <div class="bg-gradient-to-br from-gray-800 to-gray-900 border border-red-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl">
          <div class="mb-4">
            <h2 class="text-xl font-bold text-white mb-2">⚠️ No Compatible Recipients</h2>
            <p class="text-gray-300 text-sm">
              This episode has no payment recipients compatible with your wallet.
            </p>
          </div>
          <div class="bg-black/30 rounded-lg p-3 mb-4">
            <div class="text-gray-400 text-xs mb-2">Your wallet supports:</div>
            <div class="space-y-1">
              ${supportedTypes.map(type => `
                <div class="flex items-center gap-2">
                  <span class="px-2 py-1 bg-green-900/50 text-green-300 text-xs rounded">${type}</span>
                  <span class="text-green-400 text-xs">✓ Supported</span>
                </div>
              `).join('')}
            </div>
          </div>
          <button
            onclick="this.closest('.fixed').remove()"
            class="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      `;
      document.body.appendChild(errorModal);
      return;
    }

    // Calculate total splits from ALL recipients (not just supported ones)
    // This ensures unsupported recipients' shares aren't redistributed
    const totalSplit = allRecipients.reduce((sum, r) => sum + r.split, 0);

    // Get initial amount from state (will be editable in modal)
    const amount = parseInt(paymentAmount) || 100;

    // Prepare recipient details with calculated amounts based on original splits
    const supportedRecipientsWithAmounts = supportedRecipients.map(r => ({
      name: r.name,
      address: r.address,
      type: r.type,
      split: r.split,
      amount: Math.floor((amount * r.split) / totalSplit),
      supported: true
    }));

    const unsupportedWithInfo = unsupportedRecipients.map(r => ({
      name: r.name,
      address: r.address,
      type: r.type,
      split: r.split,
      amount: Math.floor((amount * r.split) / totalSplit), // Show what they WOULD get
      supported: false,
      error: `Unsupported address type: "${r.type}". Not compatible with your current wallet.`
    }));

    const recipients = [...supportedRecipientsWithAmounts, ...unsupportedWithInfo];

    setConfirmPayment({ episode, amount, recipients });
  };

  // Update recipient amounts when payment amount changes
  useEffect(() => {
    if (confirmPayment) {
      const amount = parseInt(paymentAmount);
      if (!isNaN(amount) && amount > 0) {
        // Calculate splits based on ALL recipients (not just supported)
        // This prevents redistributing unsupported shares to supported recipients
        const totalSplit = confirmPayment.recipients.reduce((sum, r) => sum + r.split, 0);

        const updatedRecipients = confirmPayment.recipients.map(r => {
          // Calculate amount based on original split percentages
          const calculatedAmount = Math.floor((amount * r.split) / totalSplit);

          return {
            ...r,
            amount: calculatedAmount
          };
        });

        setConfirmPayment({
          ...confirmPayment,
          amount,
          recipients: updatedRecipients
        });
      }
    }
  }, [paymentAmount]);

  // Actually send the payment after confirmation
  const sendPayment = async () => {
    if (!confirmPayment) return;

    // Validate amount before sending
    const amount = parseInt(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid payment amount');
      return;
    }

    const { episode, recipients } = confirmPayment;

    try {
      setProcessingPayment(episode.guid);

      // Initialize status map for all recipients
      const statusMap = new Map<string, { status: 'pending' | 'processing' | 'success' | 'failed'; error?: string }>();
      recipients.forEach(r => {
        // Mark unsupported recipients as failed immediately
        if (r.supported === false) {
          statusMap.set(r.address, { status: 'failed', error: r.error });
        } else {
          statusMap.set(r.address, { status: 'pending' });
        }
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
        // Skip unsupported recipients
        if (recipient.supported === false) {
          console.log(`⏭️ Skipping ${recipient.name} - ${recipient.error}`);
          results.push({
            success: false,
            name: recipient.name,
            skipped: true,
            amount: 0,
            error: recipient.error
          });
          continue;
        }

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

            // Use appropriate wallet based on what's connected
            if (nwc.isConnected) {
              // NWC wallet supports both lightning addresses and keysend
              if (recipient.type === 'lnaddress') {
                // Pay to lightning address via LNURL
                const invoice = await fetch(`https://${recipient.address.split('@')[1]}/.well-known/lnurlp/${recipient.address.split('@')[0]}`)
                  .then(r => r.json())
                  .then(async data => {
                    const amountMsats = recipientAmount * 1000;
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
                  recipientAmount,
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
                amountSats: recipientAmount,
                label: `Test payment for: ${episode.title} - ${recipient.name}`,
                message: fullMessage
              });
            } else {
              throw new Error('No wallet connected');
            }

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

      // Wait a moment for wallet to sync, then refresh balance
      console.log('🔄 Waiting for wallet to sync, then refreshing balance...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (nwc.isConnected) {
        await nwc.refreshBalance();
      } else if (breez.isConnected) {
        await breez.refreshBalance();
      }
      console.log('✅ Balance refreshed after payments');

      // Check if any payments were successful
      const successfulPayments = results.filter(r => r.success).length;

      // Trigger confetti if at least one payment succeeded
      if (successfulPayments > 0) {
        triggerSuccessConfetti();
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

    const isCollapsed = collapsedFeeds.has(feedName);
    const toggleCollapse = () => {
      setCollapsedFeeds(prev => {
        const next = new Set(prev);
        if (next.has(feedName)) {
          next.delete(feedName);
        } else {
          next.add(feedName);
        }
        return next;
      });
    };

    return (
      <div key={feedName} className="mb-6">
        {/* Feed Header */}
        <button
          onClick={toggleCollapse}
          className="w-full bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-4 mb-2 hover:bg-white/10 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {feed.image && (
                <img src={feed.image} alt={feed.title} className="w-12 h-12 rounded object-cover" />
              )}
              <div className="text-left">
                <h2 className="text-lg font-bold text-white">{feed.title}</h2>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Zap className="w-3 h-3 text-purple-400" />
                  <span>{feed.episodes.length} episode{feed.episodes.length !== 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>
            {isCollapsed ? (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </button>

        {/* Episode Table */}
        {!isCollapsed && (
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="text-left px-4 py-2 text-sm font-semibold text-gray-300">Episode</th>
                <th className="text-left px-4 py-2 text-sm font-semibold text-gray-300">Recipients</th>
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
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end">
                      <button
                        onClick={() => showPaymentConfirmation(episode)}
                        disabled={!walletConnected || processingPayment === episode.guid}
                        className="flex items-center gap-1 px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                        title="Send Boost"
                      >
                        {processingPayment === episode.guid ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Zap className="w-4 h-4" />
                            <span>Boost</span>
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
        )}
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
            <LightningWallet />
          </div>
        </div>

        {/* Custom RSS Feed Input */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-4 mb-6">
          <h2 className="text-lg font-bold text-white mb-3">Test Any RSS Feed</h2>
          <div className="flex gap-2 mb-2">
            <input
              type="url"
              value={customFeedUrl}
              onChange={(e) => setCustomFeedUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadCustomFeed()}
              placeholder="Enter RSS feed URL (e.g., https://example.com/feed.xml)"
              className="flex-1 px-3 py-2 bg-gray-800 border border-purple-500/30 text-white rounded text-sm focus:outline-none focus:border-purple-400 placeholder:text-gray-500"
              disabled={loadingCustomFeed}
            />
            <button
              onClick={loadCustomFeed}
              disabled={loadingCustomFeed || !customFeedUrl.trim()}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium flex items-center gap-2"
            >
              {loadingCustomFeed ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading...
                </>
              ) : (
                'Load Feed'
              )}
            </button>
            {customFeed && (
              <button
                onClick={() => {
                  setCustomFeed(null);
                  setCustomFeedUrl('');
                  setCustomFeedError(null);
                }}
                className="px-3 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
                title="Clear custom feed"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {customFeedError && (
            <div className="text-red-400 text-sm mt-2">
              {customFeedError}
            </div>
          )}
          {customFeed && !customFeed.episodes.length && (
            <div className="text-yellow-400 text-sm mt-2">
              Feed loaded but no episodes found with Lightning value recipients
            </div>
          )}
        </div>

        {/* Render custom feed first if loaded */}
        {renderFeedTable(customFeed, 'custom-feed')}

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

            {/* Amount, Name and Message Inputs */}
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-gray-400 text-xs mb-1">Amount (sats)</label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="100"
                  className="w-full px-3 py-2 bg-gray-800 border border-purple-500/30 text-white rounded-lg text-sm focus:outline-none focus:border-purple-400 placeholder:text-gray-500"
                  min="1"
                />
              </div>
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
              <div className="relative">
                {/* Gradient fade at top */}
                {confirmPayment.recipients.length > 3 && (
                  <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-gray-900 to-transparent pointer-events-none z-10" />
                )}

                {/* Scrollable recipient list */}
                <div
                  className="space-y-2 max-h-64 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-purple-500/50 scrollbar-track-gray-800/50 hover:scrollbar-thumb-purple-500/70 scroll-smooth"
                  id="recipient-scroll-container"
                >
                  {confirmPayment.recipients.map((recipient, idx) => {
                  const status = confirmPayment.recipientStatus?.get(recipient.address);
                  const isProcessing = status?.status === 'processing';
                  const isSuccess = status?.status === 'success';
                  const isFailed = status?.status === 'failed';
                  const isUnsupported = recipient.supported === false;

                  // Calculate actual payment percentage
                  const totalAmount = confirmPayment.recipients.reduce((sum, r) => sum + r.amount, 0);
                  const actualPercentage = totalAmount > 0 ? Math.round((recipient.amount / totalAmount) * 100) : 0;

                  return (
                    <div
                      id={`recipient-${idx}`}
                      key={idx}
                      ref={(el) => {
                        // Auto-scroll to processing recipient
                        if (el && isProcessing) {
                          el.scrollIntoView({
                            behavior: 'smooth',
                            block: 'nearest',
                            inline: 'nearest'
                          });
                        }
                      }}
                      className={`border rounded-lg p-3 flex items-center justify-between transition-colors ${
                        isUnsupported ? 'bg-gray-900/30 border-gray-700/30 opacity-60' :
                        isSuccess ? 'bg-green-500/10 border-green-500/30' :
                        isFailed ? 'bg-red-500/10 border-red-500/30' :
                        isProcessing ? 'bg-purple-500/10 border-purple-500/30' :
                        'bg-white/5 border-white/10'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className={`font-medium text-sm truncate ${isUnsupported ? 'text-gray-500' : 'text-white'}`}>
                            {recipient.name}
                          </div>
                          {/* Type badge */}
                          <span className={`px-1.5 py-0.5 text-xs rounded ${
                            isUnsupported ? 'bg-red-900/50 text-red-300' : 'bg-green-900/50 text-green-300'
                          }`}>
                            {recipient.type}
                          </span>
                          {isUnsupported && <span className="text-red-400/70 text-xs">(skipped)</span>}
                          {isProcessing && <Loader2 className="w-3 h-3 animate-spin text-purple-400" />}
                          {isSuccess && <span className="text-green-400 text-xs">✓</span>}
                          {isFailed && <span className="text-red-400 text-xs">✗</span>}
                        </div>
                        <div className={`text-xs truncate ${isUnsupported ? 'text-gray-600' : 'text-gray-400'}`}>
                          {recipient.address}
                        </div>
                        {isUnsupported && (
                          <div className="text-red-400/70 text-xs mt-1">
                            Wallet doesn&apos;t support {recipient.type}
                          </div>
                        )}
                        {isFailed && status.error && (
                          <div className="text-red-400 text-xs mt-1 break-words">{status.error}</div>
                        )}
                      </div>
                      <div className="text-right ml-3">
                        <div className={`font-semibold ${isUnsupported ? 'text-gray-600 line-through' : 'text-purple-300'}`}>
                          {recipient.amount.toLocaleString()} sats
                        </div>
                        <div className="text-gray-500 text-xs">
                          {isUnsupported ? (
                            <span className="line-through">{recipient.split}%</span>
                          ) : (
                            `${actualPercentage}%`
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                </div>

                {/* Gradient fade at bottom */}
                {confirmPayment.recipients.length > 3 && (
                  <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-gray-900 to-transparent pointer-events-none z-10" />
                )}
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
                        <div className="text-red-400 text-xs mt-1 break-words">
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
