'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import LoginForm from '@/components/LoginForm';
import RegisterForm from '@/components/RegisterForm';
import WalletSetup from '@/components/WalletSetup';

export default function TestAuthPage() {
  const { user, logout, getMnemonic, storeWallet } = useAuth();
  const [view, setView] = useState<'login' | 'register' | 'wallet'>('register');
  const [testPassword, setTestPassword] = useState('');
  const [retrievedMnemonic, setRetrievedMnemonic] = useState('');
  const [testMnemonic, setTestMnemonic] = useState('');
  const [testNetwork, setTestNetwork] = useState<'mainnet' | 'regtest'>('mainnet');
  const [status, setStatus] = useState('');

  const handleLogout = async () => {
    await logout();
    setRetrievedMnemonic('');
    setStatus('Logged out successfully');
  };

  const handleRetrieveMnemonic = async () => {
    if (!testPassword) {
      setStatus('❌ Please enter your password');
      return;
    }

    setStatus('🔄 Retrieving mnemonic...');
    const result = await getMnemonic(testPassword);

    if (result.success && result.mnemonic) {
      setRetrievedMnemonic(result.mnemonic);
      setStatus(`✅ Mnemonic retrieved successfully! Network: ${result.network || 'mainnet'}`);
    } else {
      setStatus(`❌ ${result.error || 'Failed to retrieve mnemonic'}`);
      setRetrievedMnemonic('');
    }
  };

  const handleStoreTestMnemonic = async () => {
    if (!testPassword || !testMnemonic) {
      setStatus('❌ Please enter password and mnemonic');
      return;
    }

    setStatus('🔄 Storing mnemonic...');
    const result = await storeWallet(testMnemonic, testPassword, testNetwork);

    if (result.success) {
      setStatus(`✅ Mnemonic stored successfully for network: ${testNetwork}!`);
      setTestMnemonic('');
    } else {
      setStatus(`❌ ${result.error || 'Failed to store mnemonic'}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            🧪 Authentication System Test
          </h1>
          <p className="text-gray-300">
            Complete testing suite for user registration, login, and wallet encryption
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Left Column - Auth Forms */}
          <div className="space-y-6">
            <div className="bg-black/30 backdrop-blur-sm rounded-xl p-6 border border-white/10">
              <h2 className="text-2xl font-bold text-white mb-4">
                {user ? `👤 Logged in as: ${user.username}` : '🔐 Authentication'}
              </h2>

              {!user ? (
                <>
                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={() => setView('register')}
                      className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                        view === 'register'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Register
                    </button>
                    <button
                      onClick={() => setView('login')}
                      className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                        view === 'login'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Login
                    </button>
                  </div>

                  {view === 'register' && (
                    <RegisterForm
                      onSuccess={() => {
                        setStatus('✅ Registration successful!');
                        setView('wallet');
                      }}
                      onSwitchToLogin={() => setView('login')}
                    />
                  )}

                  {view === 'login' && (
                    <LoginForm
                      onSuccess={() => {
                        setStatus('✅ Login successful!');
                      }}
                      onSwitchToRegister={() => setView('register')}
                    />
                  )}
                </>
              ) : (
                <div className="space-y-4">
                  <div className="bg-green-900/30 border border-green-500/50 rounded-lg p-4">
                    <p className="text-green-200 text-sm">
                      ✅ You are logged in as <strong>{user.username}</strong>
                    </p>
                    <p className="text-green-300 text-xs mt-2">
                      User ID: {user.id}
                    </p>
                  </div>

                  <button
                    onClick={handleLogout}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>

            {user && view === 'wallet' && (
              <div className="bg-black/30 backdrop-blur-sm rounded-xl p-6 border border-white/10">
                <h2 className="text-2xl font-bold text-white mb-4">💰 Wallet Setup</h2>
                <WalletSetup
                  onSuccess={() => {
                    setStatus('✅ Wallet setup complete!');
                  }}
                  onSkip={() => {
                    setStatus('⏭️ Wallet setup skipped');
                  }}
                />
              </div>
            )}
          </div>

          {/* Right Column - Wallet Testing */}
          <div className="space-y-6">
            {user && (
              <>
                {/* Retrieve Mnemonic */}
                <div className="bg-black/30 backdrop-blur-sm rounded-xl p-6 border border-white/10">
                  <h2 className="text-2xl font-bold text-white mb-4">🔑 Retrieve Mnemonic</h2>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Your Password
                      </label>
                      <input
                        type="password"
                        value={testPassword}
                        onChange={(e) => setTestPassword(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        placeholder="Enter your password"
                      />
                    </div>

                    <button
                      onClick={handleRetrieveMnemonic}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                    >
                      Retrieve Mnemonic
                    </button>

                    {retrievedMnemonic && (
                      <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-lg p-4">
                        <p className="text-yellow-200 text-xs font-medium mb-2">
                          ⚠️ RECOVERED MNEMONIC PHRASE:
                        </p>
                        <p className="text-yellow-100 text-sm font-mono break-all">
                          {retrievedMnemonic}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Manual Wallet Storage Test */}
                <div className="bg-black/30 backdrop-blur-sm rounded-xl p-6 border border-white/10">
                  <h2 className="text-2xl font-bold text-white mb-4">💾 Manual Wallet Storage</h2>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Mnemonic Phrase
                      </label>
                      <textarea
                        value={testMnemonic}
                        onChange={(e) => setTestMnemonic(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        placeholder="Enter 12-word mnemonic phrase"
                        rows={3}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Network
                      </label>
                      <select
                        value={testNetwork}
                        onChange={(e) => setTestNetwork(e.target.value as 'mainnet' | 'regtest')}
                        className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                      >
                        <option value="mainnet">Mainnet</option>
                        <option value="regtest">Regtest</option>
                      </select>
                    </div>

                    <button
                      onClick={handleStoreTestMnemonic}
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                    >
                      Store/Update Wallet
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Status Panel */}
            <div className="bg-black/30 backdrop-blur-sm rounded-xl p-6 border border-white/10">
              <h2 className="text-2xl font-bold text-white mb-4">📊 Test Status</h2>

              {status ? (
                <div className="bg-blue-900/30 border border-blue-500/50 rounded-lg p-4">
                  <p className="text-blue-200 text-sm whitespace-pre-wrap">{status}</p>
                </div>
              ) : (
                <p className="text-gray-400 text-sm">
                  Status messages will appear here...
                </p>
              )}
            </div>

            {/* Instructions */}
            <div className="bg-black/30 backdrop-blur-sm rounded-xl p-6 border border-white/10">
              <h2 className="text-2xl font-bold text-white mb-4">📋 Test Flow</h2>
              <ol className="text-gray-300 text-sm space-y-2 list-decimal list-inside">
                <li>Register a new account with username and password</li>
                <li>Wallet is automatically created during registration</li>
                <li>Use "Retrieve Mnemonic" to decrypt your wallet phrase</li>
                <li>Logout and login again to test session persistence</li>
                <li>Use "Manual Wallet Storage" to update/change your mnemonic</li>
                <li>Test network switching (mainnet/regtest)</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
