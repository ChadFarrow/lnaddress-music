'use client';

import { useState, useEffect, useRef } from 'react';
import { useBreez } from '@/hooks/useBreez';
import { useAuth } from '@/contexts/AuthContext';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';

interface BreezConnectProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
  className?: string;
}

export default function BreezConnect({ onSuccess, onError, className = '' }: BreezConnectProps) {
  const { connect, isConnected, loading, error, disconnect } = useBreez();
  const { user, getMnemonic, storeWallet } = useAuth();
  const [mnemonic, setMnemonic] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [generatedMnemonic, setGeneratedMnemonic] = useState('');
  const [forceShowForm, setForceShowForm] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [authView, setAuthView] = useState<'none' | 'login' | 'register' | 'password'>('none');
  const [loginPassword, setLoginPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isCreatingWallet, setIsCreatingWallet] = useState(false);
  // Always use mainnet
  const network = 'mainnet';

  // Use ref to always have access to current user value (prevents stale closure issues)
  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Debug logging
  console.log('🔍 BreezConnect render:', { isConnected, loading, error, forceShowForm, user: user?.username });

  // Auto-connect wallet from localStorage for returning users
  useEffect(() => {
    const autoConnectFromLocalStorage = async () => {
      console.log('📱 Auto-connect check:', {
        hasUser: !!user,
        isConnected,
        loading,
        error: !!error,
        authView
      });

      // Only auto-connect if:
      // 1. User is logged in
      // 2. Wallet is not already connected
      // 3. Not currently loading or showing error
      // 4. Not in any auth view
      if (user && !isConnected && !loading && !error && authView === 'none') {
        try {
          const savedMnemonic = localStorage.getItem('wallet_mnemonic');
          const savedNetwork = localStorage.getItem('wallet_network');

          console.log('💾 LocalStorage check:', {
            hasMnemonic: !!savedMnemonic,
            hasNetwork: !!savedNetwork
          });

          if (savedMnemonic) {
            console.log('🔄 Auto-connecting wallet from localStorage...');
            setConnectionStatus('Auto-connecting wallet...');

            const breezApiKey = process.env.NEXT_PUBLIC_BREEZ_API_KEY;
            if (!breezApiKey) {
              console.error('Breez API key not configured');
              return;
            }

            await connect({
              apiKey: breezApiKey,
              mnemonic: savedMnemonic,
              network: (savedNetwork as 'mainnet' | 'regtest') || 'mainnet',
              storageDir: './breez-sdk-data'
            });

            console.log('✅ Auto-connect successful');
            setConnectionStatus('');
            setShowSuccess(true);

            // Close modal if open
            if (onSuccess) {
              onSuccess();
            }
          }
        } catch (err) {
          console.log('❌ Auto-connect failed, will prompt for password:', err);
          // If auto-connect fails, fall through to the normal wallet check below
        } finally {
          setConnectionStatus('');
        }
      }
    };

    autoConnectFromLocalStorage();
  }, [user, isConnected, loading, error, authView, connect, onSuccess]);

  // Check if user has a wallet and auto-prompt for connection
  useEffect(() => {
    const checkWalletAndPrompt = async () => {
      // Only check if:
      // 1. User is logged in
      // 2. Wallet is not already connected
      // 3. Not currently loading
      // 4. No existing error
      // 5. Not in an auth view already
      // 6. Not currently creating a wallet (IMPORTANT: prevents premature modal closing)
      if (user && !isConnected && !loading && !error && !forceShowForm && authView === 'none' && !isCreatingWallet) {
        console.log('🔄 Checking if user has saved wallet:', user.username);

        try {
          // Check if user has a wallet by calling the wallet API
          const response = await fetch('/api/auth/wallet', {
            credentials: 'include'
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success && data.wallet) {
              console.log('✅ User has saved wallet, showing password prompt');
              // User has a wallet, show password prompt
              setAuthView('password');
            } else {
              console.log('ℹ️ User has no saved wallet, closing modal');
              // User has no saved wallet, close the modal
              onSuccess?.();
            }
          }
        } catch (err) {
          console.error('Failed to check wallet status:', err);
        }
      }
    };

    checkWalletAndPrompt();
  }, [user, isConnected, loading, error, forceShowForm, authView, isCreatingWallet, onSuccess]);

  const handleAutoCreateWallet = async (password: string) => {
    // Set flag to prevent modal from closing prematurely
    setIsCreatingWallet(true);
    console.log('🔒 Set isCreatingWallet = true to prevent modal closing');

    // Use ref to get current user value (prevents stale closure)
    const currentUser = userRef.current;
    console.log('🔍 handleAutoCreateWallet - user check:', { hasUser: !!currentUser, username: currentUser?.username });

    if (!currentUser) {
      console.error('❌ No user logged in - waiting and retrying...');
      // Try again after a short delay (keep flag set during retry)
      setTimeout(() => handleAutoCreateWallet(password), 500);
      return;
    }

    try {
      console.log('🆕 Creating new wallet for user:', currentUser.username);
      setConnectionStatus('Creating wallet...');

      // Generate new mnemonic
      const { generateMnemonic } = await import('bip39');
      const mnemonic = generateMnemonic();

      console.log('✅ Mnemonic generated');

      // Save wallet to database
      const saveResult = await storeWallet(mnemonic, password, network);
      if (!saveResult.success) {
        throw new Error(saveResult.error || 'Failed to save wallet');
      }

      console.log('✅ Wallet saved to database');

      // Connect to Breez
      const breezApiKey = process.env.NEXT_PUBLIC_BREEZ_API_KEY;
      if (!breezApiKey) {
        throw new Error('Breez API key not configured');
      }

      setConnectionStatus('Connecting to Lightning Network...');

      await connect({
        apiKey: breezApiKey,
        mnemonic,
        network: (network as 'mainnet' | 'regtest') || 'mainnet',
        storageDir: './breez-sdk-data'
      });

      console.log('✅ Breez connection successful');

      // Save to localStorage for future auto-connect
      try {
        localStorage.setItem('wallet_mnemonic', mnemonic);
        localStorage.setItem('wallet_network', network || 'mainnet');
        console.log('💾 Saved wallet to localStorage for auto-connect');
      } catch (err) {
        console.warn('Failed to save wallet to localStorage:', err);
      }

      setConnectionStatus('Wallet created! Balance syncing...');
      await new Promise(resolve => setTimeout(resolve, 1000));

      setConnectionStatus('');
      setShowSuccess(true);
      setAuthView('none');

      // Don't auto-close modal - let user explore their new wallet
      // User can manually close the modal when ready
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create wallet';
      console.error('❌ Auto-create wallet failed:', errorMsg);
      console.error('Full error:', err);
      setPasswordError(errorMsg);
      setConnectionStatus('');
    } finally {
      // Always clear the flag when done (success or failure)
      setIsCreatingWallet(false);
      console.log('🔓 Set isCreatingWallet = false, modal can close now if needed');
    }
  };

  const handleLoginAndConnect = async (isAutoConnect = false) => {
    if (!loginPassword) {
      if (!isAutoConnect) {
        setPasswordError('Password is required');
      }
      return;
    }

    if (!user) {
      if (!isAutoConnect) {
        setPasswordError('You must be logged in first');
      }
      return;
    }

    setPasswordError('');
    setConnectionStatus('Retrieving wallet...');

    try {
      console.log('🔐 Retrieving mnemonic for user:', user.username, isAutoConnect ? '(auto-connect)' : '(manual)');

      // Get mnemonic from database
      const result = await getMnemonic(loginPassword);

      console.log('🔍 Mnemonic retrieval result:', {
        success: result.success,
        hasMnemonic: !!result.mnemonic,
        network: result.network,
        error: result.error
      });

      if (!result.success || !result.mnemonic) {
        if (isAutoConnect) {
          // Auto-connect failed (wrong password), show password prompt
          console.log('❌ Auto-connect failed, showing password prompt');
          setAuthView('password');
          setLoginPassword('');
          setConnectionStatus('');
          return;
        }
        setPasswordError(result.error || 'Failed to retrieve wallet');
        setConnectionStatus('');
        return;
      }

      // Connect with retrieved mnemonic
      setConnectionStatus('Connecting to Lightning Network...');

      const breezApiKey = process.env.NEXT_PUBLIC_BREEZ_API_KEY;

      if (!breezApiKey) {
        setPasswordError('Breez API key not configured');
        setConnectionStatus('');
        return;
      }

      console.log('🚀 Connecting to Breez with retrieved mnemonic...');

      await connect({
        apiKey: breezApiKey,
        mnemonic: result.mnemonic,
        network: (result.network as 'mainnet' | 'regtest') || 'mainnet',
        storageDir: './breez-sdk-data'
      });

      console.log('✅ Breez connection successful');

      // Save encrypted wallet data to localStorage for auto-connect on return visits
      try {
        localStorage.setItem('wallet_mnemonic', result.mnemonic);
        localStorage.setItem('wallet_network', result.network || 'mainnet');
        console.log('💾 Saved wallet to localStorage for auto-connect');
      } catch (err) {
        console.warn('Failed to save wallet to localStorage:', err);
      }

      setConnectionStatus('Wallet connected! Balance syncing...');
      await new Promise(resolve => setTimeout(resolve, 1000));

      setConnectionStatus('');
      setShowSuccess(true);
      setAuthView('none');
      setLoginPassword('');

      // Don't auto-close modal - let user see their wallet
      // User can manually close the modal when ready
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to connect wallet';
      console.error('❌ Login and connect failed:', errorMsg);
      console.error('Full error:', err);

      if (isAutoConnect) {
        // Auto-connect failed, show password prompt
        console.log('❌ Auto-connect failed, showing password prompt');
        setAuthView('password');
        setLoginPassword('');
        setConnectionStatus('');
      } else {
        setPasswordError(errorMsg);
        setConnectionStatus('');
      }
    }
  };

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

      setConnectionStatus('Wallet connected! Balance syncing...');

      // Give it a moment to sync
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log('✅ Connection successful, showing success message');
      setConnectionStatus('');

      // Show success message instead of immediately closing
      setShowSuccess(true);

      // Don't call onSuccess automatically - let user close the modal manually
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

  // If showing success message after new connection
  if (showSuccess) {
    return (
      <div className={`${className} bg-gradient-to-r from-green-900/20 to-emerald-900/20 border border-green-500/30 rounded-lg p-6`}>
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="text-center">
            <h3 className="text-xl font-bold text-green-400 mb-2">Wallet Created Successfully!</h3>
            <p className="text-gray-300 text-sm">Your Breez SDK Spark wallet is ready to use.</p>
          </div>
          <div className="w-full pt-2">
            <div className="p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg mb-4">
              <p className="text-yellow-400 text-xs">
                <strong>Important:</strong> Make sure to save your recovery phrase! You can view it in the wallet settings.
              </p>
            </div>
            <button
              onClick={() => {
                setShowSuccess(false);
                onSuccess?.();
              }}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

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
      {/* User Info Section */}
      {user && (
        <div className="mb-4 p-3 bg-green-900/20 border border-green-500/30 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
              <p className="text-green-300 text-sm">
                Logged in as <strong>{user.username}</strong>
              </p>
            </div>
            <button
              onClick={() => {
                if (confirm('Are you sure you want to logout?')) {
                  // Clear wallet data from localStorage
                  localStorage.removeItem('wallet_mnemonic');
                  localStorage.removeItem('wallet_network');
                  console.log('🗑️ Cleared wallet from localStorage');
                  window.location.href = '/api/auth/logout';
                }
              }}
              className="text-xs text-red-400 hover:text-red-300 underline"
            >
              Logout
            </button>
          </div>
        </div>
      )}

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
        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:from-gray-600 disabled:to-gray-600 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 disabled:cursor-not-allowed flex items-center justify-center gap-2 mb-3"
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

      {/* Auth Forms or Account Buttons */}
      {authView === 'none' ? (
        <div className="grid grid-cols-2 gap-2 mb-6">
          <button
            onClick={() => setAuthView('register')}
            className="bg-gray-700 hover:bg-gray-600 text-white font-medium py-2.5 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 text-sm"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"/>
            </svg>
            Sign Up
          </button>
          <button
            onClick={() => setAuthView('login')}
            className="bg-gray-700 hover:bg-gray-600 text-white font-medium py-2.5 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 text-sm"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1zm7.707 3.293a1 1 0 010 1.414L9.414 9H17a1 1 0 110 2H9.414l1.293 1.293a1 1 0 01-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Login
          </button>
        </div>
      ) : authView === 'login' ? (
        <div className="mb-6">
          <button
            onClick={() => setAuthView('none')}
            className="text-sm text-gray-400 hover:text-white flex items-center gap-1 mb-4"
          >
            ← Back
          </button>
          <LoginForm
            onSuccess={async (password) => {
              console.log('🔐 Login successful, attempting auto-wallet connect...');
              setAuthView('none');

              // Try to automatically connect wallet using login password
              if (password) {
                console.log('🔑 Password received, setting up auto-connect...');
                setLoginPassword(password);
                // Wait for user state to propagate, then trigger auto-connect
                setTimeout(async () => {
                  console.log('⏰ Timeout fired, calling handleLoginAndConnect');
                  await handleLoginAndConnect(true); // true = auto-connect mode
                }, 500);
              }
            }}
            onSwitchToRegister={() => setAuthView('register')}
            className="!bg-transparent !border-0 !p-0"
          />
        </div>
      ) : authView === 'password' ? (
        <div className="mb-6">
          <button
            onClick={() => {
              setAuthView('none');
              setLoginPassword('');
              setPasswordError('');
            }}
            className="text-sm text-gray-400 hover:text-white flex items-center gap-1 mb-4"
          >
            ← Back
          </button>
          <div className="space-y-4">
            <div>
              <h3 className="text-white font-semibold mb-2">Connect Your Wallet</h3>
              <p className="text-sm text-gray-400 mb-4">
                Enter your password to decrypt and connect your saved wallet
              </p>
            </div>

            {passwordError && (
              <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4">
                <p className="text-red-200 text-sm">{passwordError}</p>
              </div>
            )}

            {connectionStatus && (
              <div className="bg-blue-900/30 border border-blue-500/50 rounded-lg p-4">
                <p className="text-blue-200 text-sm flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {connectionStatus}
                </p>
              </div>
            )}

            <div>
              <label htmlFor="wallet-password" className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <input
                type="password"
                id="wallet-password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleLoginAndConnect()}
                className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                placeholder="Enter your password"
                disabled={!!connectionStatus}
              />
            </div>

            <button
              onClick={() => handleLoginAndConnect(false)}
              disabled={!!connectionStatus || !loginPassword}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:from-gray-600 disabled:to-gray-600 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {connectionStatus ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Connecting...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M7 2v11h3v9l7-12h-4l4-8z"/>
                  </svg>
                  Connect Wallet
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-6">
          <button
            onClick={() => setAuthView('none')}
            className="text-sm text-gray-400 hover:text-white flex items-center gap-1 mb-4"
          >
            ← Back
          </button>
          <RegisterForm
            onSuccess={async (password) => {
              console.log('🎉 Registration successful, auto-creating wallet...');

              // Set the flag IMMEDIATELY to prevent modal from closing
              setIsCreatingWallet(true);
              console.log('🔒 Set isCreatingWallet = true in RegisterForm onSuccess');

              setAuthView('none');

              // Auto-create wallet for new user
              if (password) {
                console.log('🔑 Password received, creating wallet...');
                setLoginPassword(password);
                // Wait longer for user state to fully propagate
                setTimeout(async () => {
                  console.log('⏰ Timeout fired, auto-creating wallet for new user');
                  await handleAutoCreateWallet(password);
                }, 1000); // Increased from 500ms to 1000ms
              }
            }}
            onSwitchToLogin={() => setAuthView('login')}
            className="!bg-transparent !border-0 !p-0"
          />
        </div>
      )}

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
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm mb-3"
        />
        <button
          onClick={handleConnect}
          disabled={loading || !mnemonic.trim()}
          className="w-full bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white font-medium py-2.5 px-4 rounded-lg transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Restoring...</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
              </svg>
              Restore Wallet
            </>
          )}
        </button>
        <p className="mt-2 text-xs text-gray-400">
          Only enter this if you&apos;re restoring an existing wallet
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
