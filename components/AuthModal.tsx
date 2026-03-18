'use client';

import React, { useState } from 'react';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';
import PasskeyLoginForm from './PasskeyLoginForm';
import PasskeyRegisterForm from './PasskeyRegisterForm';
import WalletSetup from './WalletSetup';
import { useAuth } from '@/contexts/AuthContext';

interface AuthModalProps {
  onClose?: () => void;
  className?: string;
}

type AuthMode = 'passkey-login' | 'passkey-register' | 'password-login' | 'password-register' | 'wallet-setup';

export default function AuthModal({ onClose, className = '' }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>('passkey-login');
  const [showWalletSetup, setShowWalletSetup] = useState(false);
  const { user } = useAuth();

  const handleLoginSuccess = () => {
    setShowWalletSetup(true);
  };

  const handlePasskeySuccess = (_credentialId: string, _prfSupported: boolean) => {
    // For passkey users with PRF, wallet mnemonic is derived on-demand — no setup needed
    // Just close the modal
    onClose?.();
  };

  const handleWalletSetupSuccess = () => {
    onClose?.();
  };

  const handleWalletSetupSkip = () => {
    onClose?.();
  };

  // If user is logged in and we're showing wallet setup (password flow)
  if (user && showWalletSetup) {
    return (
      <div className={`fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 ${className}`}>
        <WalletSetup
          onSuccess={handleWalletSetupSuccess}
          onSkip={handleWalletSetupSkip}
        />
      </div>
    );
  }

  return (
    <div className={`fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 ${className}`}>
      <div className="relative">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute -top-4 -right-4 w-8 h-8 bg-gray-800 hover:bg-gray-700 rounded-full flex items-center justify-center text-white z-10"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {/* Passkey Login (default) */}
        {mode === 'passkey-login' && (
          <PasskeyLoginForm
            onSuccess={handlePasskeySuccess}
            onSwitchToRegister={() => setMode('passkey-register')}
            onSwitchToPassword={() => setMode('password-login')}
          />
        )}

        {/* Passkey Register */}
        {mode === 'passkey-register' && (
          <PasskeyRegisterForm
            onSuccess={handlePasskeySuccess}
            onSwitchToLogin={() => setMode('passkey-login')}
            onSwitchToPassword={() => setMode('password-register')}
          />
        )}

        {/* Password Login (fallback) */}
        {mode === 'password-login' && (
          <div>
            <LoginForm
              onSuccess={handleLoginSuccess}
              onSwitchToRegister={() => setMode('password-register')}
            />
            <div className="text-center mt-3">
              <button
                onClick={() => setMode('passkey-login')}
                className="text-blue-400 hover:text-blue-300 text-sm font-medium"
              >
                Use passkey instead
              </button>
            </div>
          </div>
        )}

        {/* Password Register (fallback) */}
        {mode === 'password-register' && (
          <div>
            <RegisterForm
              onSuccess={handleLoginSuccess}
              onSwitchToLogin={() => setMode('password-login')}
            />
            <div className="text-center mt-3">
              <button
                onClick={() => setMode('passkey-register')}
                className="text-blue-400 hover:text-blue-300 text-sm font-medium"
              >
                Use passkey instead
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
