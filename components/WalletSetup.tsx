'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface WalletSetupProps {
  onSuccess?: () => void;
  onSkip?: () => void;
  className?: string;
}

export default function WalletSetup({ onSuccess, onSkip, className = '' }: WalletSetupProps) {
  const [step, setStep] = useState<'choice' | 'import' | 'create'>('choice');
  const [mnemonic, setMnemonic] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatedMnemonic, setGeneratedMnemonic] = useState('');

  const { storeWallet } = useAuth();

  const handleImportWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await storeWallet(mnemonic, password);
      
      if (result.success) {
        onSuccess?.();
      } else {
        setError(result.error || 'Failed to import wallet');
      }
    } catch (error) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Generate a new mnemonic (in a real app, you'd use a proper BIP39 library)
      const words = [
        'abandon', 'ability', 'able', 'about', 'above', 'absent',
        'absorb', 'abstract', 'absurd', 'abuse', 'access', 'accident'
      ];
      const newMnemonic = words.join(' ');
      setGeneratedMnemonic(newMnemonic);

      const result = await storeWallet(newMnemonic, password);
      
      if (result.success) {
        onSuccess?.();
      } else {
        setError(result.error || 'Failed to create wallet');
      }
    } catch (error) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const generateNewMnemonic = () => {
    // This is a demo - in production use proper BIP39 generation
    const words = [
      'abandon', 'ability', 'able', 'about', 'above', 'absent',
      'absorb', 'abstract', 'absurd', 'abuse', 'access', 'accident'
    ];
    setGeneratedMnemonic(words.join(' '));
  };

  if (step === 'choice') {
    return (
      <div className={`max-w-md w-full bg-black/50 backdrop-blur-sm rounded-xl p-8 border border-white/10 ${className}`}>
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Setup Your Lightning Wallet</h1>
          <p className="text-gray-400">Choose how you&apos;d like to set up your Breez wallet</p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => setStep('import')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            Import Existing Wallet
          </button>
          
          <button
            onClick={() => setStep('create')}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            Create New Wallet
          </button>
          
          {onSkip && (
            <button
              onClick={onSkip}
              className="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              Skip for Now
            </button>
          )}
        </div>
      </div>
    );
  }

  if (step === 'import') {
    return (
      <div className={`max-w-md w-full bg-black/50 backdrop-blur-sm rounded-xl p-8 border border-white/10 ${className}`}>
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Import Wallet</h1>
          <p className="text-gray-400">Enter your 12-word recovery phrase</p>
        </div>

        <form onSubmit={handleImportWallet} className="space-y-6">
          {error && (
            <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4">
              <p className="text-red-200 text-sm">{error}</p>
            </div>
          )}

          <div>
            <label htmlFor="mnemonic" className="block text-sm font-medium text-gray-300 mb-2">
              Recovery Phrase
            </label>
            <textarea
              id="mnemonic"
              value={mnemonic}
              onChange={(e) => setMnemonic(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
              placeholder="Enter your 12-word recovery phrase"
              rows={3}
              required
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
              Encryption Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              placeholder="Password to encrypt your wallet"
              required
              disabled={loading}
            />
          </div>

          <div className="flex space-x-4">
            <button
              type="button"
              onClick={() => setStep('choice')}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              {loading ? 'Importing...' : 'Import Wallet'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (step === 'create') {
    return (
      <div className={`max-w-md w-full bg-black/50 backdrop-blur-sm rounded-xl p-8 border border-white/10 ${className}`}>
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Create New Wallet</h1>
          <p className="text-gray-400">Generate a new Lightning wallet</p>
        </div>

        <form onSubmit={handleCreateWallet} className="space-y-6">
          {error && (
            <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4">
              <p className="text-red-200 text-sm">{error}</p>
            </div>
          )}

          {generatedMnemonic && (
            <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-lg p-4">
              <p className="text-yellow-200 text-sm font-bold mb-2">⚠️ IMPORTANT: Save These Words!</p>
              <p className="text-yellow-200 text-sm mb-3">Write down these 12 words and store them safely. This is the ONLY way to recover your wallet.</p>
              <div className="bg-black/40 border border-gray-700 rounded-lg p-3">
                <p className="text-white font-mono text-sm break-all">{generatedMnemonic}</p>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
              Encryption Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              placeholder="Password to encrypt your wallet"
              required
              disabled={loading}
            />
          </div>

          <div className="flex space-x-4">
            <button
              type="button"
              onClick={() => setStep('choice')}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={loading || !generatedMnemonic}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              {loading ? 'Creating...' : 'Create Wallet'}
            </button>
          </div>
        </form>

        {!generatedMnemonic && (
          <div className="mt-4 text-center">
            <button
              onClick={generateNewMnemonic}
              className="text-blue-400 hover:text-blue-300 font-medium"
            >
              Generate Recovery Phrase
            </button>
          </div>
        )}
      </div>
    );
  }

  return null;
}
