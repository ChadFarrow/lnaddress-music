'use client';

import React, { useState } from 'react';
import { useBreezAuth } from '@/hooks/useBreezAuth';
import { useAuth } from '@/contexts/AuthContext';

interface BreezAuthConnectProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
  className?: string;
}

export default function BreezAuthConnect({ onSuccess, onError, className = '' }: BreezAuthConnectProps) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { user } = useAuth();
  const { 
    isConnected, 
    hasWallet, 
    walletLoading, 
    connectWithUserWallet,
    disconnect,
    balance 
  } = useBreezAuth();

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await connectWithUserWallet(password);
      onSuccess?.();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to connect to wallet';
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await disconnect();
    } catch (err) {
      console.error('Disconnect error:', err);
    } finally {
      setLoading(false);
    }
  };

  // If user is not authenticated
  if (!user) {
    return (
      <div className={`max-w-md w-full bg-black/50 backdrop-blur-sm rounded-xl p-8 border border-white/10 ${className}`}>
        <div className="text-center">
          <h2 className="text-xl font-bold text-white mb-2">Authentication Required</h2>
          <p className="text-gray-400">Please log in to access your Lightning wallet</p>
        </div>
      </div>
    );
  }

  // If user doesn't have a wallet
  if (walletLoading) {
    return (
      <div className={`max-w-md w-full bg-black/50 backdrop-blur-sm rounded-xl p-8 border border-white/10 ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Checking wallet status...</p>
        </div>
      </div>
    );
  }

  if (!hasWallet) {
    return (
      <div className={`max-w-md w-full bg-black/50 backdrop-blur-sm rounded-xl p-8 border border-white/10 ${className}`}>
        <div className="text-center">
          <h2 className="text-xl font-bold text-white mb-2">No Wallet Found</h2>
          <p className="text-gray-400 mb-4">You need to set up a Lightning wallet first</p>
          <button
            onClick={() => window.location.href = '/wallet-setup'}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Setup Wallet
          </button>
        </div>
      </div>
    );
  }

  // If already connected
  if (isConnected) {
    return (
      <div className={`max-w-md w-full bg-black/50 backdrop-blur-sm rounded-xl p-8 border border-white/10 ${className}`}>
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-white mb-2">Wallet Connected</h2>
          <p className="text-gray-400">Your Lightning wallet is ready</p>
        </div>

        {balance !== null && (
          <div className="bg-green-900/30 border border-green-500/50 rounded-lg p-4 mb-6">
            <p className="text-green-200 text-sm font-semibold">Balance</p>
            <p className="text-white text-2xl font-bold">{balance.toLocaleString()} sats</p>
          </div>
        )}

        <button
          onClick={handleDisconnect}
          disabled={loading}
          className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-lg transition-colors"
        >
          {loading ? 'Disconnecting...' : 'Disconnect Wallet'}
        </button>
      </div>
    );
  }

  // Show password form for connection
  return (
    <div className={`max-w-md w-full bg-black/50 backdrop-blur-sm rounded-xl p-8 border border-white/10 ${className}`}>
      <div className="text-center mb-8">
        <h2 className="text-xl font-bold text-white mb-2">Connect Your Wallet</h2>
        <p className="text-gray-400">Enter your wallet password to connect</p>
      </div>

      <form onSubmit={handleConnect} className="space-y-6">
        {error && (
          <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4">
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        )}

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
            Wallet Password
          </label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            placeholder="Enter your wallet password"
            required
            disabled={loading}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-lg transition-colors"
        >
          {loading ? 'Connecting...' : 'Connect Wallet'}
        </button>
      </form>
    </div>
  );
}
