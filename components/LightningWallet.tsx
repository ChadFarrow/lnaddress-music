'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Zap, Wallet, X, Copy, Check, AlertCircle, Loader2 } from 'lucide-react';
import { useNWC } from '@/hooks/useNWC';
import { useBreez } from '@/hooks/useBreez';
import BreezConnect from './BreezConnect';
import AlbyGoConnect from './AlbyGoConnect';

type WalletType = 'none' | 'alby' | 'breez' | 'nwc';

export function LightningWallet() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<WalletType>('none');
  const [showConnectForm, setShowConnectForm] = useState(false);
  const [inputConnection, setInputConnection] = useState('');
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [connectedWalletType, setConnectedWalletType] = useState<'alby' | 'breez' | 'nwc' | null>(null);

  const nwc = useNWC();
  const breez = useBreez();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Determine which wallet is connected
  const isConnected = nwc.isConnected || breez.isConnected;
  const balance = nwc.isConnected ? nwc.balance : breez.isConnected ? breez.balance : null;
  const loading = nwc.loading || breez.loading;
  const error = nwc.error || breez.error;

  // Track wallet type and show success notification
  useEffect(() => {
    if (isConnected) {
      setShowConnectForm(false);
      setInputConnection('');

      // Determine which wallet type connected
      let walletType: 'alby' | 'breez' | 'nwc' | null = null;
      if (breez.isConnected) {
        walletType = 'breez';
      } else if (nwc.isConnected) {
        // Check if it's Alby by examining the connection string or metadata
        // For now, we'll assume generic NWC unless we add Alby detection
        walletType = 'nwc';
      }

      // Only show success toast if wallet type changed (new connection)
      if (walletType && walletType !== connectedWalletType) {
        setConnectedWalletType(walletType);
        setShowSuccessToast(true);
        setTimeout(() => setShowSuccessToast(false), 5000);
      }

      setSelectedWallet('none');
    } else {
      setConnectedWalletType(null);
    }
  }, [isConnected, nwc.isConnected, breez.isConnected, connectedWalletType]);

  const handleNWCConnect = async () => {
    if (inputConnection.trim()) {
      await nwc.connect(inputConnection.trim());
    }
  };

  const handleDisconnect = () => {
    if (confirm('Are you sure you want to disconnect your wallet?')) {
      if (nwc.isConnected) {
        nwc.disconnect();
      }
      if (breez.isConnected) {
        breez.disconnect();
      }
    }
  };

  const refreshBalance = async () => {
    if (nwc.isConnected) {
      await nwc.refreshBalance();
    }
    if (breez.isConnected) {
      await breez.refreshBalance();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatBalance = (sats: number) => {
    console.log('🎯 Formatting balance - input:', sats, 'type:', typeof sats);
    // Fix: Correct thresholds for sat formatting
    if (sats >= 100000000) { // 100 million sats = 1 BTC
      const formatted = `${(sats / 100000000).toFixed(2)} BTC`;
      console.log('🎯 Formatted as BTC:', formatted);
      return formatted;
    } else if (sats >= 1000000) { // 1 million sats
      const formatted = `${(sats / 1000000).toFixed(2)}M sats`;
      console.log('🎯 Formatted as M sats:', formatted);
      return formatted;
    } else if (sats >= 1000) { // 1 thousand sats
      const formatted = `${(sats / 1000).toFixed(1)}k sats`;
      console.log('🎯 Formatted as k sats:', formatted);
      return formatted;
    }
    const formatted = `${sats} sats`;
    console.log('🎯 Formatted as plain sats:', formatted);
    return formatted;
  };

  const getWalletName = () => {
    if (connectedWalletType === 'breez') return 'Breez SDK Spark';
    if (connectedWalletType === 'alby') return 'Alby Hub';
    if (connectedWalletType === 'nwc') return 'Nostr Wallet Connect';
    return 'Lightning Wallet';
  };

  return (
    <>
      {/* Success Toast */}
      {showSuccessToast && (
        <div className="fixed top-4 right-4 z-[999999] animate-in slide-in-from-top-5 duration-300">
          <div className="bg-green-600 text-white px-6 py-3 rounded-lg shadow-2xl flex items-center gap-3">
            <Check className="w-5 h-5" />
            <div>
              <p className="font-semibold">Wallet Connected!</p>
              <p className="text-sm text-green-100">Successfully connected to {getWalletName()}</p>
            </div>
          </div>
        </div>
      )}

      {/* Wallet Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="relative p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
        aria-label="Lightning Wallet"
      >
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-500" />
          {isConnected && balance !== null && (
            <span className="text-sm font-medium text-gray-200">
              {formatBalance(balance)}
            </span>
          )}
        </div>
        {isConnected && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
        )}
      </button>

      {/* Wallet Modal - rendered via portal to document body */}
      {mounted && isOpen && createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" style={{ zIndex: 999999 }}>
          <div className="relative w-full max-w-md bg-gray-900 rounded-2xl shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/10 rounded-lg">
                  <Zap className="w-6 h-6 text-yellow-500" />
                </div>
                <h2 className="text-xl font-bold text-white">Lightning Wallet</h2>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {loading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 text-yellow-500 animate-spin" />
                </div>
              )}

              {!loading && !isConnected && selectedWallet === 'none' && (
                <div className="space-y-4">
                  <div className="text-center mb-6">
                    <Wallet className="w-16 h-16 mx-auto mb-4 text-gray-500" />
                    <p className="text-gray-400">
                      Choose a wallet to connect
                    </p>
                  </div>

                  {/* Alby Hub */}
                  <button
                    onClick={() => setSelectedWallet('alby')}
                    className="w-full p-4 bg-gradient-to-r from-amber-900/20 to-yellow-900/20 hover:from-amber-900/30 hover:to-yellow-900/30 border border-amber-500/30 hover:border-amber-500/50 rounded-lg transition-all flex items-center gap-3"
                  >
                    <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Zap className="w-6 h-6 text-black" />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-white">Alby Hub</div>
                      <div className="text-sm text-gray-400">One-tap connection</div>
                    </div>
                  </button>

                  {/* Breez SDK Spark */}
                  <button
                    onClick={() => setSelectedWallet('breez')}
                    className="w-full p-4 bg-gradient-to-r from-purple-900/20 to-blue-900/20 hover:from-purple-900/30 hover:to-blue-900/30 border border-purple-500/30 hover:border-purple-500/50 rounded-lg transition-all flex items-center gap-3"
                  >
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Zap className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-white">Breez SDK Spark</div>
                      <div className="text-sm text-gray-400">Self-custodial wallet</div>
                    </div>
                  </button>

                  {/* NWC Manual */}
                  <button
                    onClick={() => setSelectedWallet('nwc')}
                    className="w-full p-4 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 hover:border-gray-600 rounded-lg transition-all flex items-center gap-3"
                  >
                    <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Wallet className="w-6 h-6 text-gray-300" />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-white">Nostr Wallet Connect</div>
                      <div className="text-sm text-gray-400">Connect any NWC wallet</div>
                    </div>
                  </button>

                  <div className="pt-4 text-xs text-gray-500 text-center">
                    <p>All wallets support Lightning payments</p>
                  </div>
                </div>
              )}

              {/* Alby Connection */}
              {!loading && !isConnected && selectedWallet === 'alby' && (
                <div className="space-y-4">
                  <button
                    onClick={() => setSelectedWallet('none')}
                    className="text-sm text-gray-400 hover:text-white flex items-center gap-1"
                  >
                    ← Back
                  </button>
                  <AlbyGoConnect
                    onSuccess={() => {
                      setSelectedWallet('none');
                      setIsOpen(false);
                    }}
                    onError={(err) => console.error('Alby connection error:', err)}
                  />
                </div>
              )}

              {/* Breez Connection */}
              {!loading && !isConnected && selectedWallet === 'breez' && (
                <div className="space-y-4">
                  <button
                    onClick={() => setSelectedWallet('none')}
                    className="text-sm text-gray-400 hover:text-white flex items-center gap-1"
                  >
                    ← Back
                  </button>
                  <BreezConnect
                    onSuccess={() => {
                      setSelectedWallet('none');
                      setIsOpen(false);
                    }}
                    onError={(err) => console.error('Breez connection error:', err)}
                  />
                </div>
              )}

              {/* NWC Manual Connection */}
              {!loading && !isConnected && selectedWallet === 'nwc' && (
                <div className="space-y-4">
                  <button
                    onClick={() => setSelectedWallet('none')}
                    className="text-sm text-gray-400 hover:text-white flex items-center gap-1"
                  >
                    ← Back
                  </button>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      NWC Connection String
                    </label>
                    <textarea
                      value={inputConnection}
                      onChange={(e) => setInputConnection(e.target.value)}
                      placeholder="nostr+walletconnect://..."
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent resize-none"
                      rows={3}
                    />
                  </div>

                  {error && (
                    <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-400">{error}</p>
                    </div>
                  )}

                  <button
                    onClick={handleNWCConnect}
                    disabled={!inputConnection.trim()}
                    className="w-full py-2 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-700 disabled:text-gray-500 text-black font-semibold rounded-lg transition-colors"
                  >
                    Connect
                  </button>

                  <div className="text-xs text-gray-500 text-center">
                    <p>Get your NWC connection string from your wallet app</p>
                    <a
                      href="https://nwc.dev"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-yellow-500 hover:underline"
                    >
                      Learn more about NWC
                    </a>
                  </div>
                </div>
              )}

              {!loading && isConnected && (
                <div className="space-y-6">
                  {/* Wallet Type Badge */}
                  <div className="flex items-center justify-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-600/20 border border-green-500/30 rounded-full">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <p className="text-sm font-medium text-green-400">Connected to {getWalletName()}</p>
                    </div>
                  </div>

                  {/* Balance */}
                  <div className="text-center">
                    <p className="text-sm text-gray-400 mb-2">Balance</p>
                    <div className="flex items-center justify-center gap-2">
                      <Zap className="w-8 h-8 text-yellow-500" />
                      <p className="text-3xl font-bold text-white">
                        {balance !== null ? formatBalance(balance) : '---'}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="space-y-3">
                    <button
                      onClick={refreshBalance}
                      className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
                    >
                      Refresh Balance
                    </button>
                    
                    <button
                      onClick={handleDisconnect}
                      className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors"
                    >
                      Disconnect Wallet
                    </button>
                  </div>

                  <div className="pt-4 border-t border-gray-800">
                    <p className="text-xs text-gray-500 text-center">
                      All transactions are secured by Lightning Network
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}