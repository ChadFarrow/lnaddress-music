'use client';

import React, { useState, useEffect } from 'react';
import { getKeysendBridge } from '@/lib/nwc-keysend-bridge';
import { toast } from './Toast';

export default function KeysendBridgeConfig() {
  const [isOpen, setIsOpen] = useState(false);
  const [albyHubConnection, setAlbyHubConnection] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [capabilities, setCapabilities] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Load saved Alby Hub connection from localStorage
    const savedConnection = localStorage.getItem('albyHubBridgeConnection');
    if (savedConnection) {
      setAlbyHubConnection(savedConnection);
      checkConnection(savedConnection);
    }
  }, []);

  const checkConnection = async (connection: string) => {
    try {
      const bridge = getKeysendBridge();
      const caps = bridge.getCapabilities();
      setCapabilities(caps);
      setIsConnected(caps.hasBridge);
    } catch (error) {
      console.error('Failed to check bridge connection:', error);
    }
  };

  const handleConnect = async () => {
    if (!albyHubConnection.trim()) {
      toast.error('Please enter an Alby Hub NWC connection string');
      return;
    }

    setIsLoading(true);
    try {
      // Save to localStorage
      localStorage.setItem('albyHubBridgeConnection', albyHubConnection);
      
      // Get current user wallet connection if exists
      const userWalletConnection = localStorage.getItem('nwcConnectionString');
      
      if (!userWalletConnection) {
        toast.error('Please connect your wallet first before setting up the bridge');
        setIsLoading(false);
        return;
      }

      // Initialize bridge
      const bridge = getKeysendBridge();
      await bridge.initialize({
        userWalletConnection,
        albyHubConnection
      });

      const caps = bridge.getCapabilities();
      setCapabilities(caps);
      setIsConnected(caps.hasBridge);

      if (caps.hasBridge) {
        toast.success('✅ Alby Hub bridge connected successfully!');
        setIsOpen(false);
      } else {
        toast.error('Failed to connect Alby Hub bridge');
      }
    } catch (error) {
      console.error('Failed to connect Alby Hub:', error);
      toast.error('Failed to connect Alby Hub bridge');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = () => {
    localStorage.removeItem('albyHubBridgeConnection');
    setAlbyHubConnection('');
    setIsConnected(false);
    setCapabilities(null);
    const bridge = getKeysendBridge();
    bridge.disconnect();
    toast.info('Alby Hub bridge disconnected');
  };

  return (
    <>
      {/* Bridge Status Indicator */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-4 z-50 bg-yellow-500 text-white rounded-full p-3 shadow-lg hover:bg-yellow-600 transition-colors"
        title="Keysend Bridge Configuration"
      >
        <svg 
          className="w-6 h-6" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M13 10V3L4 14h7v7l9-11h-7z" 
          />
        </svg>
        {isConnected && (
          <span className="absolute top-0 right-0 block h-3 w-3 rounded-full bg-green-400 ring-2 ring-white" />
        )}
      </button>

      {/* Configuration Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold mb-4">Keysend Bridge Configuration</h2>
            
            {/* Current Status */}
            {capabilities && (
              <div className="mb-4 p-3 bg-gray-100 rounded">
                <p className="text-sm">
                  <strong>Wallet:</strong> {capabilities.walletName || 'Unknown'}
                </p>
                <p className="text-sm">
                  <strong>Native Keysend:</strong> {capabilities.supportsKeysend ? '✅ Yes' : '❌ No'}
                </p>
                <p className="text-sm">
                  <strong>Bridge Status:</strong> {capabilities.hasBridge ? '✅ Connected' : '❌ Not Connected'}
                </p>
              </div>
            )}

            {/* Info Box */}
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm text-blue-800">
                <strong>What is this?</strong><br />
                The Keysend Bridge allows wallets that don&apos;t support keysend payments (like Coinos) 
                to make them through Alby Hub. Connect your Alby Hub here to enable keysend for any wallet.
              </p>
            </div>

            {/* Connection Input */}
            {!isConnected ? (
              <>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Alby Hub NWC Connection String
                </label>
                <textarea
                  value={albyHubConnection}
                  onChange={(e) => setAlbyHubConnection(e.target.value)}
                  placeholder="nostr+walletconnect://..."
                  className="w-full p-2 border border-gray-300 rounded mb-4 h-24 text-sm font-mono"
                  disabled={isLoading}
                />
                
                <div className="text-xs text-gray-600 mb-4">
                  <p>To get your Alby Hub connection string:</p>
                  <ol className="list-decimal list-inside mt-1">
                    <li>Open your Alby Hub</li>
                    <li>Go to Apps → Connections</li>
                    <li>Create a new connection</li>
                    <li>Copy the NWC connection string</li>
                  </ol>
                </div>
              </>
            ) : (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded">
                <p className="text-sm text-green-800">
                  ✅ Alby Hub bridge is connected and ready to relay keysend payments!
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                disabled={isLoading}
              >
                Cancel
              </button>
              
              {!isConnected ? (
                <button
                  onClick={handleConnect}
                  className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50"
                  disabled={isLoading || !albyHubConnection.trim()}
                >
                  {isLoading ? 'Connecting...' : 'Connect Bridge'}
                </button>
              ) : (
                <button
                  onClick={handleDisconnect}
                  className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                  disabled={isLoading}
                >
                  Disconnect Bridge
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}