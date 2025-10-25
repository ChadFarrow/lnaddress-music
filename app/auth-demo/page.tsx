'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useBreezAuth } from '@/hooks/useBreezAuth';
import AuthModal from '@/components/AuthModal';
import BreezAuthConnect from '@/components/BreezAuthConnect';

export default function AuthDemoPage() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { user, logout } = useAuth();
  const { isConnected, balance, hasWallet } = useBreezAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">Authentication Demo</h1>
          <p className="text-gray-400 text-lg">
            Test the user authentication system with Breez SDK integration
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Authentication Status */}
          <div className="bg-black/50 backdrop-blur-sm rounded-xl p-6 border border-white/10">
            <h2 className="text-2xl font-bold mb-4">Authentication Status</h2>
            
            {user ? (
              <div className="space-y-4">
                <div className="bg-green-900/30 border border-green-500/50 rounded-lg p-4">
                  <p className="text-green-200 text-sm font-semibold">Logged In</p>
                  <p className="text-white text-lg">Welcome, {user.username}!</p>
                </div>
                
                <div className="space-y-2">
                  <p className="text-gray-300">User ID: {user.id}</p>
                  <p className="text-gray-300">Username: {user.username}</p>
                </div>

                <button
                  onClick={logout}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-gray-900/30 border border-gray-500/50 rounded-lg p-4">
                  <p className="text-gray-200 text-sm font-semibold">Not Logged In</p>
                  <p className="text-gray-400">Please log in to access your wallet</p>
                </div>
                
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Login / Register
                </button>
              </div>
            )}
          </div>

          {/* Wallet Status */}
          <div className="bg-black/50 backdrop-blur-sm rounded-xl p-6 border border-white/10">
            <h2 className="text-2xl font-bold mb-4">Wallet Status</h2>
            
            {user ? (
              <div className="space-y-4">
                {hasWallet ? (
                  <div className="space-y-4">
                    <div className="bg-blue-900/30 border border-blue-500/50 rounded-lg p-4">
                      <p className="text-blue-200 text-sm font-semibold">Wallet Found</p>
                      <p className="text-white">Your encrypted wallet is stored</p>
                    </div>

                    {isConnected ? (
                      <div className="bg-green-900/30 border border-green-500/50 rounded-lg p-4">
                        <p className="text-green-200 text-sm font-semibold">Connected</p>
                        <p className="text-white text-lg">
                          Balance: {balance !== null ? `${balance.toLocaleString()} sats` : 'Loading...'}
                        </p>
                      </div>
                    ) : (
                      <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-lg p-4">
                        <p className="text-yellow-200 text-sm font-semibold">Not Connected</p>
                        <p className="text-white">Enter password to connect</p>
                      </div>
                    )}

                    <BreezAuthConnect />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-gray-900/30 border border-gray-500/50 rounded-lg p-4">
                      <p className="text-gray-200 text-sm font-semibold">No Wallet</p>
                      <p className="text-gray-400">You need to set up a wallet first</p>
                    </div>
                    
                    <button
                      onClick={() => setShowAuthModal(true)}
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                    >
                      Setup Wallet
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-gray-900/30 border border-gray-500/50 rounded-lg p-4">
                <p className="text-gray-200 text-sm font-semibold">Authentication Required</p>
                <p className="text-gray-400">Please log in to view wallet status</p>
              </div>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-black/50 backdrop-blur-sm rounded-xl p-6 border border-white/10">
          <h2 className="text-2xl font-bold mb-4">How to Test</h2>
          <div className="space-y-3 text-gray-300">
            {/* eslint-disable-next-line react/no-unescaped-entities */}
            <p>1. <strong>Register:</strong> Click "Login / Register" to create a new account</p>
            {/* eslint-disable-next-line react/no-unescaped-entities */}
            <p>2. <strong>Setup Wallet:</strong> After registration, you'll be prompted to set up a Lightning wallet</p>
            <p>3. <strong>Import or Create:</strong> You can import an existing 12-word phrase or create a new one</p>
            <p>4. <strong>Connect:</strong> After setup, enter your wallet password to connect to Breez</p>
            <p>5. <strong>Test:</strong> Your wallet will be encrypted and stored securely</p>
          </div>
        </div>
      </div>

      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} />
      )}
    </div>
  );
}
