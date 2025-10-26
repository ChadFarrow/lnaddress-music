'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface User {
  id: number;
  username: string;
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (username: string, password: string, confirmPassword: string) => Promise<{ success: boolean; error?: string }>;
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

  // Debug logging for user state changes
  useEffect(() => {
    console.log('👤 AuthContext user state changed:', user);
  }, [user]);

  // Check if user is logged in on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

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
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Registration failed' };
      }
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: 'Network error' };
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
    login,
    register,
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
