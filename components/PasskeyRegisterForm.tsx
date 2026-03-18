'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface PasskeyRegisterFormProps {
  onSuccess?: (credentialId: string, prfSupported: boolean) => void;
  onSwitchToLogin?: () => void;
  onSwitchToPassword?: () => void;
  className?: string;
}

export default function PasskeyRegisterForm({
  onSuccess,
  onSwitchToLogin,
  onSwitchToPassword,
  className = '',
}: PasskeyRegisterFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { registerWithPasskey } = useAuth();

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      const result = await registerWithPasskey();

      if (result.success) {
        onSuccess?.(result.credentialId!, result.prfSupported || false);
      } else {
        setError(result.error || 'Registration failed');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`max-w-md w-full bg-black/50 backdrop-blur-sm rounded-xl p-8 border border-white/10 ${className}`}
    >
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">Create Account</h1>
        <p className="text-gray-400">Set up your account with a passkey</p>
      </div>

      <div className="space-y-6">
        {error && (
          <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4">
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        )}

        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <div>
              <p className="text-blue-200 text-sm font-medium">Passkey authentication</p>
              <p className="text-blue-300/70 text-xs mt-1">
                Use your device&apos;s biometrics (fingerprint, face) or security key. No password needed.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            'Creating Passkey...'
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
              </svg>
              Create Account with Passkey
            </>
          )}
        </button>
      </div>

      <div className="mt-6 space-y-3 text-center">
        {onSwitchToPassword && (
          <p className="text-gray-500 text-sm">
            Prefer a password?{' '}
            <button
              onClick={onSwitchToPassword}
              className="text-gray-400 hover:text-gray-300 font-medium"
            >
              Use password instead
            </button>
          </p>
        )}
        {onSwitchToLogin && (
          <p className="text-gray-400 text-sm">
            Already have an account?{' '}
            <button
              onClick={onSwitchToLogin}
              className="text-blue-400 hover:text-blue-300 font-medium"
            >
              Sign in
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
