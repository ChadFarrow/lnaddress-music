'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';

export interface User {
  id: number;
  username: string;
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  authMethod: 'passkey' | 'password' | null;
  credentialId: string | null;
  prfSupported: boolean;
  // Password auth (legacy/fallback)
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (username: string, password: string, confirmPassword: string) => Promise<{ success: boolean; error?: string }>;
  // Passkey auth (default)
  registerWithPasskey: (username: string) => Promise<{ success: boolean; error?: string; credentialId?: string; prfSupported?: boolean }>;
  loginWithPasskey: (username?: string) => Promise<{ success: boolean; error?: string; credentialId?: string; prfSupported?: boolean }>;
  logout: () => Promise<void>;
  getMnemonic: (password: string) => Promise<{ success: boolean; mnemonic?: string; network?: string; error?: string }>;
  storeWallet: (mnemonic: string, password: string, network?: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authMethod, setAuthMethod] = useState<'passkey' | 'password' | null>(null);
  const [credentialId, setCredentialId] = useState<string | null>(null);
  const [prfSupported, setPrfSupported] = useState(false);

  // Debug logging for user state changes
  useEffect(() => {
    console.log('👤 AuthContext user state changed:', user, 'method:', authMethod);
  }, [user, authMethod]);

  // Check if user is logged in on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Restore passkey state from localStorage
  useEffect(() => {
    if (user && !authMethod) {
      const savedMethod = localStorage.getItem('auth_method');
      const savedCredentialId = localStorage.getItem('passkey_credential_id');
      const savedPrfSupported = localStorage.getItem('passkey_prf_supported');
      if (savedMethod === 'passkey' && savedCredentialId) {
        setAuthMethod('passkey');
        setCredentialId(savedCredentialId);
        setPrfSupported(savedPrfSupported === 'true');
      } else if (savedMethod === 'password') {
        setAuthMethod('password');
      }
    }
  }, [user, authMethod]);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log('🔐 AuthContext.login called for:', username);
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();
      console.log('🔐 Login response:', { ok: response.ok, data });

      if (response.ok) {
        console.log('✅ Login successful, setting user:', data.user);
        setUser(data.user);
        setAuthMethod('password');
        localStorage.setItem('auth_method', 'password');
        return { success: true };
      } else {
        console.log('❌ Login failed:', data.error);
        return { success: false, error: data.error || 'Login failed' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Network error' };
    }
  };

  const register = async (username: string, password: string, confirmPassword: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ username, password, confirmPassword }),
      });

      const data = await response.json();

      if (response.ok) {
        setUser(data.user);
        setAuthMethod('password');
        localStorage.setItem('auth_method', 'password');
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Registration failed' };
      }
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: 'Network error' };
    }
  };

  const registerWithPasskey = async (username: string): Promise<{ success: boolean; error?: string; credentialId?: string; prfSupported?: boolean }> => {
    try {
      // Step 1: Get registration options from server
      const startRes = await fetch('/api/auth/passkey/register/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username }),
      });

      const startData = await startRes.json();
      if (!startRes.ok) {
        return { success: false, error: startData.error || 'Failed to start registration' };
      }

      // Step 2: Create passkey via browser WebAuthn API
      let attResp;
      try {
        attResp = await startRegistration({
          optionsJSON: startData.options,
        });
      } catch (error: any) {
        if (error.name === 'NotAllowedError') {
          return { success: false, error: 'Passkey creation was cancelled' };
        }
        return { success: false, error: `Passkey creation failed: ${error.message}` };
      }

      // Step 3: Verify with server and create account
      const completeRes = await fetch('/api/auth/passkey/register/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username,
          tempUserId: startData.tempUserId,
          credential: attResp,
        }),
      });

      const completeData = await completeRes.json();
      if (!completeRes.ok) {
        return { success: false, error: completeData.error || 'Failed to complete registration' };
      }

      // Set auth state
      setUser(completeData.user);
      setAuthMethod('passkey');
      setCredentialId(completeData.credentialId);
      setPrfSupported(completeData.prfSupported || false);

      // Persist passkey state
      localStorage.setItem('auth_method', 'passkey');
      localStorage.setItem('passkey_credential_id', completeData.credentialId);
      localStorage.setItem('passkey_prf_supported', String(completeData.prfSupported || false));

      return {
        success: true,
        credentialId: completeData.credentialId,
        prfSupported: completeData.prfSupported,
      };
    } catch (error) {
      console.error('Passkey registration error:', error);
      return { success: false, error: 'Passkey registration failed' };
    }
  };

  const loginWithPasskey = async (username?: string): Promise<{ success: boolean; error?: string; credentialId?: string; prfSupported?: boolean }> => {
    try {
      // Step 1: Get authentication options from server
      const startRes = await fetch('/api/auth/passkey/login/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username }),
      });

      const startData = await startRes.json();
      if (!startRes.ok) {
        return { success: false, error: startData.error || 'Failed to start login' };
      }

      // Step 2: Authenticate via browser WebAuthn API
      let assertionResp;
      try {
        assertionResp = await startAuthentication({
          optionsJSON: startData.options,
        });
      } catch (error: any) {
        if (error.name === 'NotAllowedError') {
          return { success: false, error: 'Passkey authentication was cancelled' };
        }
        return { success: false, error: `Passkey authentication failed: ${error.message}` };
      }

      // Step 3: Verify with server
      const completeRes = await fetch('/api/auth/passkey/login/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          challengeKey: startData.challengeKey,
          credential: assertionResp,
        }),
      });

      const completeData = await completeRes.json();
      if (!completeRes.ok) {
        return { success: false, error: completeData.error || 'Failed to complete login' };
      }

      // Set auth state
      setUser(completeData.user);
      setAuthMethod('passkey');
      setCredentialId(completeData.credentialId);
      setPrfSupported(completeData.prfSupported || false);

      // Persist passkey state
      localStorage.setItem('auth_method', 'passkey');
      localStorage.setItem('passkey_credential_id', completeData.credentialId);
      localStorage.setItem('passkey_prf_supported', String(completeData.prfSupported || false));

      return {
        success: true,
        credentialId: completeData.credentialId,
        prfSupported: completeData.prfSupported,
      };
    } catch (error) {
      console.error('Passkey login error:', error);
      return { success: false, error: 'Passkey login failed' };
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setAuthMethod(null);
      setCredentialId(null);
      setPrfSupported(false);
      localStorage.removeItem('auth_method');
      localStorage.removeItem('passkey_credential_id');
      localStorage.removeItem('passkey_prf_supported');
    }
  };

  const getMnemonic = async (password: string): Promise<{ success: boolean; mnemonic?: string; network?: string; error?: string }> => {
    try {
      const response = await fetch('/api/auth/wallet/mnemonic', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (response.ok) {
        return {
          success: true,
          mnemonic: data.mnemonic,
          network: data.network
        };
      } else {
        return { success: false, error: data.error || 'Failed to get mnemonic' };
      }
    } catch (error) {
      console.error('Get mnemonic error:', error);
      return { success: false, error: 'Network error' };
    }
  };

  const storeWallet = async (mnemonic: string, password: string, network: string = 'mainnet'): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch('/api/auth/wallet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ mnemonic, password, network }),
      });

      const data = await response.json();

      if (response.ok) {
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Failed to store wallet' };
      }
    } catch (error) {
      console.error('Store wallet error:', error);
      return { success: false, error: 'Network error' };
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    authMethod,
    credentialId,
    prfSupported,
    login,
    register,
    registerWithPasskey,
    loginWithPasskey,
    logout,
    getMnemonic,
    storeWallet,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
