'use client';

import React, { useState } from 'react';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';
import WalletSetup from './WalletSetup';
import { useAuth } from '@/contexts/AuthContext';

interface AuthModalProps {
  onClose?: () => void;
  className?: string;
}

export default function AuthModal({ onClose, className = '' }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'wallet-setup'>('login');
  const [showWalletSetup, setShowWalletSetup] = useState(false);
  const { user } = useAuth();

  const handleLoginSuccess = () => {
    // Check if user has a wallet, if not show wallet setup
    setShowWalletSetup(true);
  };

  const handleRegisterSuccess = () => {
    // After registration, show wallet setup
    setShowWalletSetup(true);
  };

  const handleWalletSetupSuccess = () => {
    onClose?.();
  };

  const handleWalletSetupSkip = () => {
    onClose?.();
  };

  // If user is logged in and we're showing wallet setup
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

        {mode === 'login' && (
          <LoginForm
            onSuccess={handleLoginSuccess}
            onSwitchToRegister={() => setMode('register')}
          />
        )}

        {mode === 'register' && (
          <RegisterForm
            onSuccess={handleRegisterSuccess}
            onSwitchToLogin={() => setMode('login')}
          />
        )}
      </div>
    </div>
  );
}
