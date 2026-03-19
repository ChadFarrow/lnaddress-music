'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useBreez } from '@/hooks/useBreez';
import { useAuth } from '@/contexts/AuthContext';

export type AuthView = 'none' | 'login' | 'register' | 'password' | 'passkey-login' | 'passkey-register' | 'passkey-connect';

interface UseBreezWalletOptions {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export function useBreezWallet({ onSuccess, onError }: UseBreezWalletOptions) {
  const { connect, isConnected, loading, error, disconnect } = useBreez();
  const { user, getMnemonic, storeWallet, authMethod, credentialId, prfSupported } = useAuth();

  const [mnemonic, setMnemonic] = useState('');
  const [forceShowForm, setForceShowForm] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('');
  const [authView, setAuthView] = useState<AuthView>('none');
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

  // --- Utility helpers ---

  const saveWalletToLocalStorage = useCallback((walletMnemonic: string, walletNetwork: string) => {
    try {
      localStorage.setItem('wallet_mnemonic', walletMnemonic);
      localStorage.setItem('wallet_network', walletNetwork);
      console.log('💾 Saved wallet to localStorage for auto-connect');
    } catch (err) {
      console.warn('Failed to save wallet to localStorage:', err);
    }
  }, []);

  const clearWalletFromLocalStorage = useCallback(() => {
    localStorage.removeItem('wallet_mnemonic');
    localStorage.removeItem('wallet_network');
    console.log('🗑️ Cleared wallet from localStorage');
  }, []);

  const connectToBreez = useCallback(async (walletMnemonic: string, walletNetwork: string) => {
    const breezApiKey = process.env.NEXT_PUBLIC_BREEZ_API_KEY;
    if (!breezApiKey) {
      throw new Error('Breez API key not configured');
    }

    await connect({
      apiKey: breezApiKey,
      mnemonic: walletMnemonic,
      network: (walletNetwork as 'mainnet' | 'regtest') || 'mainnet',
      storageDir: './breez-sdk-data'
    });
  }, [connect]);

  // --- Auto-connect wallet from localStorage for returning users ---

  useEffect(() => {
    const autoConnectFromLocalStorage = async () => {
      console.log('📱 Auto-connect check:', {
        hasUser: !!user,
        isConnected,
        loading,
        error: !!error,
        authView
      });

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

            await connectToBreez(savedMnemonic, savedNetwork || 'mainnet');

            console.log('✅ Auto-connect successful');
            setConnectionStatus('');

            if (onSuccess) {
              onSuccess();
            }
          }
        } catch (err) {
          console.log('❌ Auto-connect failed, will prompt for password:', err);
        } finally {
          setConnectionStatus('');
        }
      }
    };

    autoConnectFromLocalStorage();
  }, [user, isConnected, loading, error, authView, connectToBreez, onSuccess]);

  // --- Check if user has a wallet and auto-prompt for connection ---

  useEffect(() => {
    const checkWalletAndPrompt = async () => {
      const savedMnemonic = localStorage.getItem('wallet_mnemonic');
      if (savedMnemonic) {
        console.log('⏭️ Skipping wallet check - localStorage mnemonic exists, auto-connect will handle it');
        return;
      }

      if (user && !isConnected && !loading && !error && !forceShowForm && authView === 'none' && !isCreatingWallet && !loginPassword) {
        console.log('🔄 Checking if user has saved wallet:', user.username);

        if (authMethod === 'passkey' && prfSupported && credentialId) {
          console.log('🔑 Passkey user with PRF, offering passkey wallet connect');
          setAuthView('passkey-connect');
          return;
        }

        if (authMethod === 'passkey') {
          console.log('🔑 Passkey user without PRF, showing wallet creation UI');
          return;
        }

        try {
          const response = await fetch('/api/auth/wallet', {
            credentials: 'include'
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success && data.wallet) {
              console.log('✅ User has saved wallet, showing password prompt');
              setAuthView('password');
            } else {
              console.log('ℹ️ User has no saved wallet, keeping modal open for wallet creation');
            }
          }
        } catch (err) {
          console.error('Failed to check wallet status:', err);
        }
      }
    };

    checkWalletAndPrompt();
  }, [user, isConnected, loading, error, forceShowForm, authView, isCreatingWallet, loginPassword, onSuccess, authMethod, prfSupported, credentialId]);

  // --- Handler functions ---

  const handlePasskeyWalletConnect = useCallback(async (salt: string = 'default') => {
    if (!credentialId) {
      console.error('No credential ID available for PRF derivation');
      return;
    }

    try {
      setConnectionStatus('Deriving wallet from passkey...');

      const { deriveMnemonicFromPasskey } = await import('@/lib/prf-service');
      const derivedMnemonic = await deriveMnemonicFromPasskey(credentialId, salt);

      if (!derivedMnemonic) {
        setConnectionStatus('');
        setPasswordError('PRF derivation failed. Your device may not support this feature.');
        return;
      }

      setConnectionStatus('Connecting to Lightning Network...');
      await connectToBreez(derivedMnemonic, 'mainnet');

      saveWalletToLocalStorage(derivedMnemonic, 'mainnet');

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
  }, [credentialId, connectToBreez, saveWalletToLocalStorage, onSuccess]);

  const handleAutoCreateWallet = useCallback(async (password: string) => {
    setIsCreatingWallet(true);
    console.log('🔒 Set isCreatingWallet = true to prevent modal closing');

    const currentUser = userRef.current;
    console.log('🔍 handleAutoCreateWallet - user check:', { hasUser: !!currentUser, username: currentUser?.username });

    if (!currentUser) {
      console.error('❌ No user logged in - waiting and retrying...');
      setTimeout(() => handleAutoCreateWallet(password), 500);
      return;
    }

    try {
      console.log('🆕 Creating new wallet for user:', currentUser.username);
      setConnectionStatus('Creating wallet...');

      const { generateMnemonic } = await import('bip39');
      const newMnemonic = generateMnemonic();

      console.log('✅ Mnemonic generated');

      const saveResult = await storeWallet(newMnemonic, password, network);
      if (!saveResult.success) {
        throw new Error(saveResult.error || 'Failed to save wallet');
      }

      console.log('✅ Wallet saved to database');

      setConnectionStatus('Connecting to Lightning Network...');
      await connectToBreez(newMnemonic, network);

      console.log('✅ Breez connection successful');

      saveWalletToLocalStorage(newMnemonic, network || 'mainnet');

      setConnectionStatus('Wallet created! Balance syncing...');
      await new Promise(resolve => setTimeout(resolve, 1000));

      setConnectionStatus('');
      setAuthView('none');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create wallet';
      console.error('❌ Auto-create wallet failed:', errorMsg);
      console.error('Full error:', err);
      setPasswordError(errorMsg);
      setConnectionStatus('');
    } finally {
      setIsCreatingWallet(false);
      console.log('🔓 Set isCreatingWallet = false, modal can close now if needed');
    }
  }, [storeWallet, connectToBreez, saveWalletToLocalStorage, network]);

  const handleLoginAndConnect = useCallback(async (isAutoConnect = false) => {
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

      const result = await getMnemonic(loginPassword);

      console.log('🔍 Mnemonic retrieval result:', {
        success: result.success,
        hasMnemonic: !!result.mnemonic,
        network: result.network,
        error: result.error
      });

      if (!result.success || !result.mnemonic) {
        if (isAutoConnect) {
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

      setConnectionStatus('Connecting to Lightning Network...');

      console.log('🚀 Connecting to Breez with retrieved mnemonic...');

      await connectToBreez(result.mnemonic, result.network || 'mainnet');

      console.log('✅ Breez connection successful');

      saveWalletToLocalStorage(result.mnemonic, result.network || 'mainnet');

      setConnectionStatus('Wallet connected! Balance syncing...');
      await new Promise(resolve => setTimeout(resolve, 1000));

      setConnectionStatus('');
      setAuthView('none');
      setLoginPassword('');

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to connect wallet';
      console.error('❌ Login and connect failed:', errorMsg);
      console.error('Full error:', err);
      if (isAutoConnect) {
        console.log('❌ Auto-connect failed, showing password prompt');
        setAuthView('password');
        setLoginPassword('');
        setConnectionStatus('');
      } else {
        setPasswordError(errorMsg);
        setConnectionStatus('');
      }
    }
  }, [loginPassword, user, getMnemonic, connectToBreez, saveWalletToLocalStorage, onSuccess]);

  const handleConnect = useCallback(async () => {
    console.log('🔘 Connect button clicked');
    console.log('📋 Connection params:', {
      hasMnemonic: !!mnemonic,
      network,
      mnemonicWordCount: mnemonic ? mnemonic.trim().split(/\s+/).length : 0
    });

    const breezApiKey = process.env.NEXT_PUBLIC_BREEZ_API_KEY;

    if (!breezApiKey) {
      const errorMsg = 'Breez API key not configured. Please contact the site administrator.';
      console.error('❌ No API key in environment');
      onError?.(errorMsg);
      return;
    }

    try {
      console.log('🚀 Starting connection...');

      setConnectionStatus('Initializing Breez SDK...');

      await new Promise(resolve => setTimeout(resolve, 300));
      setConnectionStatus('Connecting to Lightning Network...');

      await connect({
        apiKey: breezApiKey,
        mnemonic: mnemonic || undefined,
        network,
        storageDir: './breez-sdk-data'
      });

      setConnectionStatus('Wallet connected! Balance syncing...');

      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log('✅ Connection successful');
      setConnectionStatus('');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to connect to Breez SDK';
      console.error('❌ Connection failed:', errorMsg);
      console.error('Full error:', err);
      setConnectionStatus('');
      onError?.(errorMsg);
    }
  }, [mnemonic, network, connect, onError]);

  const handleRetry = useCallback(async () => {
    setForceShowForm(true);
    try {
      await disconnect();
    } catch (err) {
      console.error('Error disconnecting:', err);
    }
  }, [disconnect]);

  const handleLogout = useCallback(async () => {
    if (confirm('Logout from your account? This will also disconnect your wallet.')) {
      clearWalletFromLocalStorage();
      try {
        await disconnect();
      } catch (err) {
        console.error('Error disconnecting during logout:', err);
      }
      window.location.href = '/api/auth/logout';
    }
  }, [clearWalletFromLocalStorage, disconnect]);

  const handleDisconnect = useCallback(async () => {
    if (confirm('Disconnect your wallet? You can reconnect anytime.')) {
      clearWalletFromLocalStorage();
      await disconnect();
      console.log('✅ Wallet disconnected');
      setForceShowForm(false);
    }
  }, [clearWalletFromLocalStorage, disconnect]);

  const handleCreateNewWallet = useCallback(async () => {
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

        await connectToBreez(newMnemonic, network);

        saveWalletToLocalStorage(newMnemonic, network || 'mainnet');
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
  }, [newUserPassword, loginPassword, authMethod, handleAutoCreateWallet, connectToBreez, saveWalletToLocalStorage, network]);

  const handleImportWallet = useCallback(async () => {
    setImportError('');
    setImportLoading(true);

    try {
      const trimmedMnemonic = importMnemonic.trim();

      const bip39 = await import('bip39');
      if (!bip39.validateMnemonic(trimmedMnemonic)) {
        setImportError('Invalid recovery phrase. Please check your words and try again.');
        setImportLoading(false);
        return;
      }

      const result = await storeWallet(trimmedMnemonic, newUserPassword);

      if (result.success) {
        console.log('✅ Wallet imported successfully');
        setShowImportWalletModal(false);
        setImportMnemonic('');

        setConnectionStatus('Connecting to imported wallet...');

        setLoginPassword(newUserPassword);
        setTimeout(async () => {
          await handleLoginAndConnect(false);
          setNewUserPassword('');
        }, 500);
      } else {
        setImportError(result.error || 'Failed to import wallet');
      }
    } catch (importErr) {
      console.error('Import error:', importErr);
      setImportError(importErr instanceof Error ? importErr.message : 'Failed to import wallet');
    } finally {
      setImportLoading(false);
    }
  }, [importMnemonic, newUserPassword, storeWallet, handleLoginAndConnect]);

  const handleLoginFormSuccess = useCallback(async (password?: string) => {
    console.log('🔐 Login successful, attempting auto-wallet connect...');
    setAuthView('none');

    if (password) {
      console.log('🔑 Password received, setting up auto-connect...');
      setLoginPassword(password);
      setTimeout(async () => {
        console.log('⏰ Immediate auto-connect after login');
        setPasswordError('');
        setConnectionStatus('Retrieving wallet...');

        try {
          const currentUser = userRef.current;
          if (!currentUser) {
            console.error('❌ No user found in ref after login');
            setPasswordError('Please try connecting manually');
            setAuthView('password');
            setConnectionStatus('');
            return;
          }

          console.log('🔐 Retrieving mnemonic for user:', currentUser.username, '(auto-connect after login)');

          const result = await getMnemonic(password);

          console.log('🔍 Mnemonic retrieval result:', {
            success: result.success,
            hasMnemonic: !!result.mnemonic,
            network: result.network,
            error: result.error
          });

          if (!result.success || !result.mnemonic) {
            console.log('ℹ️ No wallet found, user can create one');
            setConnectionStatus('');
            setLoginPassword('');
            return;
          }

          setConnectionStatus('Connecting to Lightning Network...');

          await connectToBreez(result.mnemonic, result.network || 'mainnet');

          console.log('✅ Breez connection successful');

          saveWalletToLocalStorage(result.mnemonic, result.network || 'mainnet');

          setConnectionStatus('Wallet connected! Balance syncing...');
          await new Promise(resolve => setTimeout(resolve, 1000));

          setConnectionStatus('');
          setAuthView('none');
          setLoginPassword('');
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Failed to connect wallet';
          console.error('❌ Auto-connect after login failed:', errorMsg);
          console.error('Full error:', err);
          setConnectionStatus('');
          setLoginPassword('');
        }
      }, 100);
    }
  }, [getMnemonic, connectToBreez, saveWalletToLocalStorage]);

  const handleRegisterFormSuccess = useCallback(async (password?: string) => {
    console.log('🎉 Registration successful, showing wallet choice modal...');

    if (password) {
      setNewUserPassword(password);
    }

    setAuthView('none');
    setShowWalletChoiceModal(true);
  }, []);

  return {
    // Breez state (pass-through)
    isConnected,
    loading,
    error,
    // Local state
    user,
    mnemonic,
    setMnemonic,
    forceShowForm,
    setForceShowForm,
    connectionStatus,
    authView,
    setAuthView,
    loginPassword,
    setLoginPassword,
    passwordError,
    setPasswordError,
    isCreatingWallet,
    newUserPassword,
    showWalletChoiceModal,
    setShowWalletChoiceModal,
    showImportWalletModal,
    setShowImportWalletModal,
    importMnemonic,
    setImportMnemonic,
    importError,
    setImportError,
    importLoading,
    network,
    // Handlers
    handlePasskeyWalletConnect,
    handleAutoCreateWallet,
    handleLoginAndConnect,
    handleConnect,
    handleRetry,
    handleLogout,
    handleDisconnect,
    handleCreateNewWallet,
    handleImportWallet,
    handleLoginFormSuccess,
    handleRegisterFormSuccess,
  };
}
