'use client';

import { useState, useEffect } from 'react';
import { useBreez } from '@/hooks/useBreez';

interface BreezConnectProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
  className?: string;
}

export default function BreezConnect({ onSuccess, onError, className = '' }: BreezConnectProps) {
  const { connect, isConnected, loading, error, disconnect } = useBreez();
  const [mnemonic, setMnemonic] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [generatedMnemonic, setGeneratedMnemonic] = useState('');
  const [forceShowForm, setForceShowForm] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('');
  // Always use mainnet
  const network = 'mainnet';

  // Debug logging
  console.log('🔍 BreezConnect render:', { isConnected, loading, error, forceShowForm });

  const handleConnect = async () => {
    console.log('🔘 Connect button clicked');
    console.log('📋 Connection params:', {
      hasMnemonic: !!mnemonic,
      network,
      mnemonicWordCount: mnemonic ? mnemonic.trim().split(/\s+/).length : 0
    });

    // Use API key from environment variable
    const breezApiKey = process.env.NEXT_PUBLIC_BREEZ_API_KEY;

    if (!breezApiKey) {
      const errorMsg = 'Breez API key not configured. Please contact the site administrator.';
      console.error('❌ No API key in environment');
      onError?.(errorMsg);
      return;
    }

    try {
      console.log('🚀 Starting connection...');

      // Show progressive status updates
      setConnectionStatus('Initializing Breez SDK...');

      // Small delay to show the first status
      await new Promise(resolve => setTimeout(resolve, 300));
      setConnectionStatus('Connecting to Lightning Network...');

      await connect({
        apiKey: breezApiKey,
        mnemonic: mnemonic || undefined, // Optional - will generate if not provided
        network,
        storageDir: './breez-sdk-data'
      });

      setConnectionStatus('Syncing wallet balance...');

      // Give it a moment to sync
      await new Promise(resolve => setTimeout(resolve, 500));

      console.log('✅ Connection successful, calling onSuccess');
      setConnectionStatus('');

      // Only call onSuccess when user explicitly connects, not when already connected
      onSuccess?.();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to connect to Breez SDK';
      console.error('❌ Connection failed:', errorMsg);
      console.error('Full error:', err);
      setConnectionStatus('');
      onError?.(errorMsg);
    }
  };

  const handleRetry = async () => {
    // Clear any existing connection state and retry
    setForceShowForm(true);
    try {
      await disconnect();
    } catch (err) {
      console.error('Error disconnecting:', err);
    }
  };

  // If already connected and no error, show a success message
  if (isConnected && !forceShowForm) {
    return (
      <div className={`${className} bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-500/30 rounded-lg p-6`}>
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <p className="text-green-400 font-medium">Breez wallet already connected</p>
          </div>
          <button
            onClick={() => setForceShowForm(true)}
            className="text-sm text-gray-400 hover:text-white underline"
          >
            Connect a different wallet
          </button>
        </div>
      </div>
    );
  }

  // If there's an error, allow retry
  if (error && !forceShowForm && !loading) {
    return (
      <div className={`${className} bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-500/30 rounded-lg p-6`}>
        <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
          <p className="text-red-400 text-sm font-medium mb-2">Connection Error</p>
          <p className="text-red-400 text-sm">{error}</p>
        </div>
        <button
          onClick={handleRetry}
          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className={`${className} bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-500/30 rounded-lg p-6`}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
          <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M7 2v11h3v9l7-12h-4l4-8z"/>
          </svg>
        </div>
        <div>
          <h3 className="text-white font-semibold">Breez SDK Spark</h3>
          <p className="text-gray-400 text-sm">Self-custodial Lightning wallet</p>
        </div>
      </div>

      {/* Create Wallet Button */}
      <button
        onClick={handleConnect}
        disabled={loading}
        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:from-gray-600 disabled:to-gray-600 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 disabled:cursor-not-allowed flex items-center justify-center gap-2 mb-6"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>{connectionStatus || 'Connecting...'}</span>
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
            </svg>
            Create Wallet
          </>
        )}
      </button>

      {/* Divider */}
      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-700"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-gray-900 text-gray-400">or restore existing wallet</span>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Restore Wallet Section */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Recovery Mnemonic
        </label>
        <textarea
          value={mnemonic}
          onChange={(e) => setMnemonic(e.target.value)}
          placeholder="Enter your 12 or 24-word recovery phrase"
          rows={3}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
        />
        <p className="mt-1 text-xs text-gray-400">
          Only enter this if you're restoring an existing wallet
        </p>
      </div>

      {/* Info Box */}
      <div className="p-3 bg-blue-900/10 border border-blue-500/20 rounded-lg">
        <p className="text-xs text-gray-400">
          <strong className="text-blue-400">Note:</strong> Breez SDK Spark provides self-custodial Lightning payments.
          Your keys stay on your device. Keep your mnemonic safe!
        </p>
      </div>
    </div>
  );
}
