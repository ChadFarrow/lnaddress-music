'use client';

import { useState, useEffect, useRef } from 'react';
import { useBreez } from '@/hooks/useBreez';
import { useAuth } from '@/contexts/AuthContext';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';
import PasskeyLoginForm from './PasskeyLoginForm';
import PasskeyRegisterForm from './PasskeyRegisterForm';

interface BreezConnectProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
  className?: string;
}

export default function BreezConnect({ onSuccess, onError, className = '' }: BreezConnectProps) {
  const { connect, isConnected, loading, error, disconnect } = useBreez();
  const { user, getMnemonic, storeWallet, authMethod, credentialId, prfSupported } = useAuth();
  const [mnemonic, setMnemonic] = useState('');
  const [forceShowForm, setForceShowForm] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('');
  const [authView, setAuthView] = useState<'none' | 'login' | 'register' | 'password' | 'passkey-login' | 'passkey-register' | 'passkey-connect'>('none');
  const [loginPassword, setLoginPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isCreatingWallet, setIsCreatingWallet] = useState(false);
  const [newUserPassword, setNewUserPassword] = useState('');
  const [showWalletChoiceModal, setShowWalletChoiceModal] = useState(false);
  const [showImportWalletModal, setShowImportWalletModal] = useState(false);
  const [importMnemonic, setImportMnemonic] = useState('');
  const [importError, setImportError] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const network = 'mainnet';

  // Use ref to always have access to current user value (prevents stale closure issues)
  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

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
            // Don't show success screen - wallet is already connected

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

  // Auto-connect from passkey PRF for passkey-authenticated users
  const handlePasskeyWalletConnect = async (salt: string = 'default') => {
    if (!credentialId) {
      console.error('No credential ID available for PRF derivation');
      return;
    }

    try {
      setConnectionStatus('Deriving wallet from passkey...');

      // Dynamic import of PRF service (client-side only)
      const { deriveMnemonicFromPasskey } = await import('@/lib/prf-service');
      const mnemonic = await deriveMnemonicFromPasskey(credentialId, salt);

      if (!mnemonic) {
        setConnectionStatus('');
        setPasswordError('PRF derivation failed. Your device may not support this feature.');
        return;
      }

      // Connect to Breez with the derived mnemonic
      const breezApiKey = process.env.NEXT_PUBLIC_BREEZ_API_KEY;
      if (!breezApiKey) {
        setPasswordError('Breez API key not configured');
        setConnectionStatus('');
        return;
      }

      setConnectionStatus('Connecting to Lightning Network...');

      await connect({
        apiKey: breezApiKey,
        mnemonic,
        network: 'mainnet',
        storageDir: './breez-sdk-data'
      });

      // Save to localStorage for future auto-connect (avoids PRF prompt every time)
      try {
        localStorage.setItem('wallet_mnemonic', mnemonic);
        localStorage.setItem('wallet_network', 'mainnet');
      } catch (err) {
        console.warn('Failed to save wallet to localStorage:', err);
      }

      setConnectionStatus('');
      setAuthView('none');

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to connect with passkey';
      console.error('Passkey wallet connect failed:', errorMsg);
      setPasswordError(errorMsg);
      setConnectionStatus('');
    }
  };

  // Check if user has a wallet and auto-prompt for connection
  useEffect(() => {
    const checkWalletAndPrompt = async () => {
      // Skip if localStorage has a mnemonic (auto-connect will handle it)
      const savedMnemonic = localStorage.getItem('wallet_mnemonic');
      if (savedMnemonic) {
        console.log('⏭️ Skipping wallet check - localStorage mnemonic exists, auto-connect will handle it');
        return;
      }

      // Only check if:
      // 1. User is logged in
      // 2. Wallet is not already connected
      // 3. Not currently loading
      // 4. No existing error
      // 5. Not in an auth view already
      // 6. Not currently creating a wallet (IMPORTANT: prevents premature modal closing)
      // 7. No login password waiting (if we have loginPassword, auto-connect will handle it)
      if (user && !isConnected && !loading && !error && !forceShowForm && authView === 'none' && !isCreatingWallet && !loginPassword) {
        console.log('🔄 Checking if user has saved wallet:', user.username);

        // If user authenticated via passkey with PRF support, offer passkey-based wallet connection
        if (authMethod === 'passkey' && prfSupported && credentialId) {
          console.log('🔑 Passkey user with PRF, offering passkey wallet connect');
          setAuthView('passkey-connect');
          return;
        }

        // Passkey users without PRF: skip DB wallet check, just show create/import UI
        // They have no password to decrypt a DB-stored wallet
        if (authMethod === 'passkey') {
          console.log('🔑 Passkey user without PRF, showing wallet creation UI');
          return;
        }

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
              console.log('ℹ️ User has no saved wallet, keeping modal open for wallet creation');
              // User has no saved wallet, keep modal open (don't call onSuccess)
              // The default UI already shows the "Create Wallet" button
            }
          }
        } catch (err) {
          console.error('Failed to check wallet status:', err);
        }
      }
    };

    checkWalletAndPrompt();
  }, [user, isConnected, loading, error, forceShowForm, authView, isCreatingWallet, loginPassword, onSuccess, authMethod, prfSupported, credentialId]);

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
      // Don't show success screen - go directly to connected wallet UI
      setAuthView('none');

      // Wallet is now connected and ready to use
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
      // Don't show success screen - go directly to connected wallet UI
      setAuthView('none');
      setLoginPassword('');

      // Wallet is now connected and ready to use
      // Close the modal if this was triggered from import
      if (onSuccess) {
        onSuccess();
      }
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

      console.log('✅ Connection successful');
      setConnectionStatus('');

      // Don't show success screen - wallet is now connected and ready to use
      // The connected wallet UI will be shown automatically
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

  // If already connected and no error, show connected wallet UI
  if (isConnected && !forceShowForm) {
    return (
      <div className={`${className} bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-500/30 rounded-lg p-6`}>
        {/* Account Section */}
        {user && (
          <div className="mb-4 p-3 bg-green-900/20 border border-green-500/30 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
                <p className="text-green-300 text-sm">
                  <strong>{user.username}</strong>
                </p>
              </div>
              <button
                onClick={async () => {
                  if (confirm('Logout from your account? This will also disconnect your wallet.')) {
                    // Clear wallet data from localStorage FIRST
                    localStorage.removeItem('wallet_mnemonic');
                    localStorage.removeItem('wallet_network');
                    console.log('🗑️ Cleared wallet from localStorage');

                    // Then disconnect wallet
                    await disconnect();

                    // Finally logout
                    window.location.href = '/api/auth/logout';
                  }
                }}
                className="text-xs text-red-400 hover:text-red-300 underline"
              >
                Logout Account
              </button>
            </div>
          </div>
        )}

        {/* Wallet Status */}
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <p className="text-green-400 font-medium">Wallet connected</p>
          </div>
          <button
            onClick={async () => {
              if (confirm('Disconnect your wallet? You can reconnect anytime.')) {
                // Clear wallet data from localStorage FIRST to prevent auto-reconnect
                localStorage.removeItem('wallet_mnemonic');
                localStorage.removeItem('wallet_network');
                console.log('🗑️ Cleared localStorage');

                // Then disconnect wallet
                await disconnect();
                console.log('✅ Wallet disconnected');
                setForceShowForm(false);
              }
            }}
            className="text-sm text-orange-400 hover:text-orange-300 underline"
          >
            Disconnect Wallet
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
      {/* Account Section */}
      {user && (
        <div className="mb-4 space-y-2">
          {/* User Info */}
          <div className="p-3 bg-green-900/20 border border-green-500/30 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
                <p className="text-green-300 text-sm">
                  <strong>{user.username}</strong>
                </p>
              </div>
              <button
                onClick={async () => {
                  if (confirm('Logout from your account? This will also disconnect your wallet.')) {
                    // Clear wallet data from localStorage FIRST
                    localStorage.removeItem('wallet_mnemonic');
                    localStorage.removeItem('wallet_network');
                    console.log('🗑️ Cleared wallet from localStorage');

                    // Then disconnect wallet
                    await disconnect();

                    // Finally logout
                    window.location.href = '/api/auth/logout';
                  }
                }}
                className="text-xs text-red-400 hover:text-red-300 underline"
              >
                Logout Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Only show Breez header and Create Wallet button when not in auth views */}
      {authView === 'none' && (
        <>
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

          {/* Create Wallet Button - requires auth first */}
          {!user ? (
            <p className="text-gray-400 text-sm text-center mb-3">
              Sign up or login below to create a wallet
            </p>
          ) : (
            <button
              onClick={() => setShowWalletChoiceModal(true)}
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
          )}
        </>
      )}

      {/* Auth Forms or Account Buttons */}
      {authView === 'none' ? (
        <div className="space-y-2 mb-6">
          {/* Passkey as default (prominent) */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setAuthView('passkey-register')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
              </svg>
              Sign Up
            </button>
            <button
              onClick={() => setAuthView('passkey-login')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
              </svg>
              Login
            </button>
          </div>
          {/* Password fallback (subtle) */}
          <div className="text-center">
            <button
              onClick={() => setAuthView('login')}
              className="text-xs text-gray-500 hover:text-gray-400"
            >
              Use password instead
            </button>
          </div>
        </div>
      ) : authView === 'passkey-login' ? (
        <div className="mb-6">
          <button
            onClick={() => setAuthView('none')}
            className="text-sm text-gray-400 hover:text-white flex items-center gap-1 mb-4"
          >
            ← Back
          </button>
          <PasskeyLoginForm
            onSuccess={async (credId, prf) => {
              console.log('🔑 Passkey login successful, PRF supported:', prf);
              setAuthView('none');
              if (prf && credId) {
                // Auto-connect wallet using PRF-derived mnemonic
                await handlePasskeyWalletConnect('default');
              }
            }}
            onSwitchToRegister={() => setAuthView('passkey-register')}
            onSwitchToPassword={() => setAuthView('login')}
            className="!bg-transparent !border-0 !p-0"
          />
        </div>
      ) : authView === 'passkey-register' ? (
        <div className="mb-6">
          <button
            onClick={() => setAuthView('none')}
            className="text-sm text-gray-400 hover:text-white flex items-center gap-1 mb-4"
          >
            ← Back
          </button>
          <PasskeyRegisterForm
            onSuccess={async (credId, prf) => {
              console.log('🔑 Passkey registration successful, PRF supported:', prf);
              setAuthView('none');
              if (prf && credId) {
                // Auto-create wallet using PRF-derived mnemonic
                await handlePasskeyWalletConnect('default');
              }
            }}
            onSwitchToLogin={() => setAuthView('passkey-login')}
            onSwitchToPassword={() => setAuthView('register')}
            className="!bg-transparent !border-0 !p-0"
          />
        </div>
      ) : authView === 'passkey-connect' ? (
        <div className="mb-6">
          <button
            onClick={() => setAuthView('none')}
            className="text-sm text-gray-400 hover:text-white flex items-center gap-1 mb-4"
          >
            ← Back
          </button>
          <div className="space-y-4">
            <h3 className="text-white font-semibold">Connect Wallet with Passkey</h3>
            <p className="text-sm text-gray-400">
              Your wallet key will be derived from your passkey. No password needed.
            </p>
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
            <button
              onClick={() => handlePasskeyWalletConnect('default')}
              disabled={!!connectionStatus}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:from-gray-600 disabled:to-gray-600 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
              </svg>
              Connect with Passkey
            </button>
          </div>
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
                // Immediately call handleLoginAndConnect - don't wait
                // The user state should be available by now since login already succeeded
                setTimeout(async () => {
                  console.log('⏰ Immediate auto-connect after login');
                  // Set the password first, then call the handler
                  setPasswordError('');
                  setConnectionStatus('Retrieving wallet...');

                  try {
                    // Use the current user from the ref to avoid stale closure
                    const currentUser = userRef.current;
                    if (!currentUser) {
                      console.error('❌ No user found in ref after login');
                      setPasswordError('Please try connecting manually');
                      setAuthView('password');
                      setConnectionStatus('');
                      return;
                    }

                    console.log('🔐 Retrieving mnemonic for user:', currentUser.username, '(auto-connect after login)');

                    // Get mnemonic from database
                    const result = await getMnemonic(password);

                    console.log('🔍 Mnemonic retrieval result:', {
                      success: result.success,
                      hasMnemonic: !!result.mnemonic,
                      network: result.network,
                      error: result.error
                    });

                    if (!result.success || !result.mnemonic) {
                      // If no wallet found, that's fine - user can create one
                      console.log('ℹ️ No wallet found, user can create one');
                      setConnectionStatus('');
                      setLoginPassword('');
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
                    // Don't show success screen - go directly to connected wallet UI
                    setAuthView('none');
                    setLoginPassword('');
                  } catch (err) {
                    const errorMsg = err instanceof Error ? err.message : 'Failed to connect wallet';
                    console.error('❌ Auto-connect after login failed:', errorMsg);
                    console.error('Full error:', err);
                    setConnectionStatus('');
                    setLoginPassword('');
                  }
                }, 100); // Shorter delay since login is already complete
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
              console.log('🎉 Registration successful, showing wallet choice modal...');

              // Store password for later use
              if (password) {
                setNewUserPassword(password);
              }

              // Reset auth view and show separate wallet choice modal
              setAuthView('none');
              setShowWalletChoiceModal(true);
            }}
            onSwitchToLogin={() => setAuthView('login')}
            className="!bg-transparent !border-0 !p-0"
          />
        </div>
      )}


      {/* Only show divider and restore wallet section when not in auth views */}
      {authView === 'none' && (
        <>
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
        </>
      )}

      {/* Info Box */}
      <div className="p-3 bg-blue-900/10 border border-blue-500/20 rounded-lg">
        <p className="text-xs text-gray-400">
          <strong className="text-blue-400">Note:</strong> Breez SDK Spark provides self-custodial Lightning payments.
          Your keys stay on your device. Keep your mnemonic safe!
        </p>
      </div>

      {/* Separate Wallet Choice Modal */}
      {showWalletChoiceModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[10000] p-4">
          <div className="max-w-md w-full bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 border border-purple-500/30 shadow-2xl">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Lightning Wallet</h2>
              <p className="text-sm text-gray-400">Do you already have a Lightning wallet?</p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => {
                  setShowWalletChoiceModal(false);
                  setShowImportWalletModal(true);
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
              >
                Yes, I have a wallet
              </button>

              <button
                onClick={async () => {
                  console.log('Creating new wallet for user...');
                  setShowWalletChoiceModal(false);
                  setIsCreatingWallet(true);
                  setAuthView('none');

                  const password = newUserPassword || loginPassword;
                  if (password) {
                    setLoginPassword(password);
                    setTimeout(async () => {
                      await handleAutoCreateWallet(password);
                    }, 500);
                  } else if (authMethod === 'passkey') {
                    // Passkey user without PRF — no password available.
                    // Generate mnemonic, connect directly, save to localStorage only.
                    try {
                      const { generateMnemonic } = await import('bip39');
                      const newMnemonic = generateMnemonic();
                      setConnectionStatus('Connecting to Lightning Network...');

                      const breezApiKey = process.env.NEXT_PUBLIC_BREEZ_API_KEY;
                      if (!breezApiKey) throw new Error('Breez API key not configured');

                      await connect({
                        apiKey: breezApiKey,
                        mnemonic: newMnemonic,
                        network: (network as 'mainnet' | 'regtest') || 'mainnet',
                        storageDir: './breez-sdk-data'
                      });

                      localStorage.setItem('wallet_mnemonic', newMnemonic);
                      localStorage.setItem('wallet_network', network || 'mainnet');
                      console.log('✅ Passkey wallet created (localStorage only, no DB backup)');

                      setConnectionStatus('');
                      setAuthView('none');
                    } catch (err) {
                      const errorMsg = err instanceof Error ? err.message : 'Failed to create wallet';
                      console.error('❌ Passkey wallet creation failed:', errorMsg);
                      setPasswordError(errorMsg);
                      setConnectionStatus('');
                    } finally {
                      setIsCreatingWallet(false);
                    }
                  } else {
                    // Password user but we don't have their password cached,
                    // prompt for it via the password auth view
                    setIsCreatingWallet(false);
                    setAuthView('password');
                  }
                }}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
              >
                No, create a new wallet
              </button>
            </div>

            <div className="mt-6 p-3 bg-blue-900/10 border border-blue-500/20 rounded-lg">
              <p className="text-xs text-gray-400">
                <strong className="text-blue-400">Note:</strong> Breez SDK Spark provides self-custodial Lightning payments.
                Your keys stay on your device. Keep your mnemonic safe!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Import Wallet Modal */}
      {showImportWalletModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[10001] p-4">
          <div className="max-w-md w-full bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 border border-purple-500/30 shadow-2xl">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Import Wallet</h2>
              <p className="text-sm text-gray-400">Enter your 12-word recovery phrase</p>
            </div>

            {importError && (
              <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
                <p className="text-red-400 text-sm">{importError}</p>
              </div>
            )}

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Recovery Phrase
              </label>
              <textarea
                value={importMnemonic}
                onChange={(e) => setImportMnemonic(e.target.value)}
                placeholder="Enter your 12-word recovery phrase"
                rows={3}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
                disabled={importLoading}
              />
            </div>

            <div className="space-y-3">
              <button
                onClick={async () => {
                  setImportError('');
                  setImportLoading(true);

                  try {
                    const trimmedMnemonic = importMnemonic.trim();

                    // Validate mnemonic using bip39
                    const bip39 = await import('bip39');
                    if (!bip39.validateMnemonic(trimmedMnemonic)) {
                      setImportError('Invalid recovery phrase. Please check your words and try again.');
                      setImportLoading(false);
                      return;
                    }

                    // Store wallet to database using the password from registration
                    const result = await storeWallet(trimmedMnemonic, newUserPassword);

                    if (result.success) {
                      console.log('✅ Wallet imported successfully');
                      setShowImportWalletModal(false);
                      setImportMnemonic('');

                      // Set connection status to show connecting state
                      setConnectionStatus('Connecting to imported wallet...');

                      // Try to auto-connect with the imported wallet
                      setLoginPassword(newUserPassword);
                      setTimeout(async () => {
                        await handleLoginAndConnect(false);
                        setNewUserPassword('');
                      }, 500);
                    } else {
                      setImportError(result.error || 'Failed to import wallet');
                    }
                  } catch (error) {
                    console.error('Import error:', error);
                    setImportError(error instanceof Error ? error.message : 'Failed to import wallet');
                  } finally {
                    setImportLoading(false);
                  }
                }}
                disabled={importLoading || !importMnemonic.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors"
              >
                {importLoading ? 'Importing...' : 'Import Wallet'}
              </button>

              <button
                onClick={() => {
                  setShowImportWalletModal(false);
                  setShowWalletChoiceModal(true);
                  setImportMnemonic('');
                  setImportError('');
                }}
                disabled={importLoading}
                className="w-full bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-lg transition-colors"
              >
                Back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
