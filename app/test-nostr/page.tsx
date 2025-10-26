'use client';

import { useState } from 'react';
import { useBoostToNostr } from '@/hooks/useBoostToNostr';

export default function TestNostrPage() {
  const [result, setResult] = useState<string>('');
  const [isPosting, setIsPosting] = useState(false);

  const { postBoost, publicKey } = useBoostToNostr({
    autoGenerateKeys: typeof window !== 'undefined'
  });

  const handleTestPost = async () => {
    setIsPosting(true);
    setResult('Posting to Nostr...');

    try {
      const testTrack = {
        title: 'Test Track',
        artist: 'Test Artist',
        album: 'Test Album',
        url: 'https://example.com',
        imageUrl: 'https://via.placeholder.com/300',
        timestamp: 60,
        duration: 180,
        senderName: 'Test User'
      };

      const boostResult = await postBoost(
        10, // 10 sats
        testTrack,
        'This is a test boost from the Nostr testing page!'
      );

      if (boostResult.success) {
        setResult(`✅ Success!
Event ID: ${boostResult.eventId}

View on Nostr:
• Primal: https://primal.net/e/${boostResult.eventId}
• Snort: https://snort.social/e/${boostResult.eventId}

Nevent: ${boostResult.nevent}`);
      } else {
        setResult(`❌ Failed: ${boostResult.error}`);
      }
    } catch (error) {
      setResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Nostr Posting Test</h1>

        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Nostr Configuration</h2>
          <p className="mb-2">
            <strong>Public Key:</strong>{' '}
            {publicKey ? (
              <span className="text-green-400">{publicKey.substring(0, 16)}...</span>
            ) : (
              <span className="text-red-400">Not configured</span>
            )}
          </p>
          {publicKey && (
            <p className="text-sm text-gray-400">
              View profile:{' '}
              <a
                href={`https://primal.net/p/${publicKey}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline"
              >
                Primal
              </a>
            </p>
          )}
        </div>

        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Test Boost Post</h2>
          <p className="text-gray-400 mb-4">
            This will create a test boost note and post it to Nostr relays.
            No actual payment is required.
          </p>
          <button
            onClick={handleTestPost}
            disabled={isPosting}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            {isPosting ? 'Posting...' : 'Post Test Boost to Nostr'}
          </button>
        </div>

        {result && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Result</h2>
            <pre className="whitespace-pre-wrap text-sm text-gray-300 bg-gray-900 p-4 rounded">
              {result}
            </pre>
          </div>
        )}

        <div className="mt-8 bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Console Output</h2>
          <p className="text-gray-400 text-sm">
            Open your browser&apos;s developer console (F12) to see detailed logs about:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-400 mt-2 space-y-1">
            <li>Event creation and signing</li>
            <li>Relay connections</li>
            <li>Publishing results</li>
            <li>Error details (if any)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
