'use client';

import { useState, useEffect } from 'react';
import { useBreez } from '@/hooks/useBreez';

interface BreezConnectProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
  className?: string;
}

export default function BreezConnect({ onSuccess, onError, className = '' }: BreezConnectProps) {
  const { connect, isConnected, loading, error } = useBreez();
  const [apiKey, setApiKey] = useState(process.env.NEXT_PUBLIC_BREEZ_API_KEY || '');
  const [mnemonic, setMnemonic] = useState('');
  const [network, setNetwork] = useState<'mainnet' | 'regtest'>('mainnet');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [generatedMnemonic, setGeneratedMnemonic] = useState('');
  const hasEnvApiKey = !!process.env.NEXT_PUBLIC_BREEZ_API_KEY;

  const handleConnect = async () => {
    if (!apiKey) {
      const errorMsg = 'Please enter your Breez API key';
      onError?.(errorMsg);
      return;
    }

    try {
      await connect({
        apiKey,
        mnemonic: mnemonic || undefined, // Optional - will generate if not provided
        network,
        storageDir: './breez-sdk-data'
      });

      // Only call onSuccess when user explicitly connects, not when already connected
      onSuccess?.();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to connect to Breez SDK';
      onError?.(errorMsg);
    }
  };

  // If already connected, show a message instead of the form
  if (isConnected) {
    return (
      <div className={`${className} bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-500/30 rounded-lg p-6`}>
        <div className="flex items-center justify-center gap-3 py-4">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <p className="text-green-400 font-medium">Breez wallet already connected</p>
        </div>
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

      {/* API Key Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Breez API Key
          {hasEnvApiKey && (
            <span className="ml-2 text-xs text-green-400">(configured)</span>
          )}
        </label>
        <input
          type={hasEnvApiKey ? "password" : "text"}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={hasEnvApiKey ? "••••••••••••••••" : "Enter your Breez API key"}
          disabled={hasEnvApiKey}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {!hasEnvApiKey && (
          <p className="mt-1 text-xs text-gray-400">
            Get a free API key at{' '}
            <a
              href="https://breez.technology/request-api-key/#contact-us-form-sdk"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300"
            >
              breez.technology
            </a>
          </p>
        )}
        {hasEnvApiKey && (
          <p className="mt-1 text-xs text-green-400">
            ✓ API key loaded from environment configuration
          </p>
        )}
      </div>

      {/* Mnemonic Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Recovery Mnemonic (Optional)
        </label>
        <textarea
          value={mnemonic}
          onChange={(e) => setMnemonic(e.target.value)}
          placeholder="Leave empty to create a new wallet automatically"
          rows={3}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
        />
        <p className="mt-1 text-xs text-green-400">
          💡 Leave empty to create a new wallet, or enter your existing 12/24-word mnemonic to restore
        </p>
      </div>

      {/* Advanced Options */}
      <div className="mb-4">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1"
        >
          <svg
            className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
          Advanced Options
        </button>

        {showAdvanced && (
          <div className="mt-3 p-3 bg-gray-800/50 rounded-lg">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Network
            </label>
            <select
              value={network}
              onChange={(e) => setNetwork(e.target.value as 'mainnet' | 'regtest')}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="mainnet">Mainnet</option>
              <option value="regtest">Regtest (Testing)</option>
            </select>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Connect Button */}
      <button
        onClick={handleConnect}
        disabled={loading || !apiKey}
        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:from-gray-600 disabled:to-gray-600 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Connecting...
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Connect to Breez SDK
          </>
        )}
      </button>

      {/* Info Box */}
      <div className="mt-4 p-3 bg-blue-900/10 border border-blue-500/20 rounded-lg">
        <p className="text-xs text-gray-400">
          <strong className="text-blue-400">Note:</strong> Breez SDK Spark provides self-custodial Lightning payments.
          Your keys stay on your device. Keep your mnemonic safe!
        </p>
      </div>
    </div>
  );
}
