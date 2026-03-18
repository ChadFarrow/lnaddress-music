'use client';

import { useBreezWallet } from '@/hooks/useBreezWallet';
import {
  PasskeyLoginView,
  PasskeyRegisterView,
  PasskeyConnectView,
  PasswordLoginView,
  PasswordAuthView,
  PasswordRegisterView,
} from '@/components/wallet/WalletAuthViews';
import { WalletChoiceModal, ImportWalletModal } from '@/components/wallet/WalletModals';

interface BreezConnectProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
  className?: string;
}

export default function BreezConnect({ onSuccess, onError, className = '' }: BreezConnectProps) {
  const w = useBreezWallet({ onSuccess, onError });

  // If already connected and no error, show connected wallet UI
  if (w.isConnected && !w.forceShowForm) {
    return (
      <div className={`${className} bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-500/30 rounded-lg p-6`}>
        {/* Account Section */}
        {w.user && (
          <div className="mb-4 p-3 bg-green-900/20 border border-green-500/30 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
                <p className="text-green-300 text-sm">
                  <strong>{w.user.username}</strong>
                </p>
              </div>
              <button
                onClick={w.handleLogout}
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
            onClick={w.handleDisconnect}
            className="text-sm text-orange-400 hover:text-orange-300 underline"
          >
            Disconnect Wallet
          </button>
        </div>
      </div>
    );
  }

  // If there's an error, allow retry
  if (w.error && !w.forceShowForm && !w.loading) {
    return (
      <div className={`${className} bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-500/30 rounded-lg p-6`}>
        <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
          <p className="text-red-400 text-sm font-medium mb-2">Connection Error</p>
          <p className="text-red-400 text-sm">{w.error}</p>
        </div>
        <button
          onClick={w.handleRetry}
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
      {w.user && (
        <div className="mb-4 space-y-2">
          <div className="p-3 bg-green-900/20 border border-green-500/30 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
                <p className="text-green-300 text-sm">
                  <strong>{w.user.username}</strong>
                </p>
              </div>
              <button
                onClick={w.handleLogout}
                className="text-xs text-red-400 hover:text-red-300 underline"
              >
                Logout Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Only show Breez header and Create Wallet button when not in auth views */}
      {w.authView === 'none' && (
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
          {!w.user ? (
            <p className="text-gray-400 text-sm text-center mb-3">
              Sign up or login below to create a wallet
            </p>
          ) : (
            <button
              onClick={() => w.setShowWalletChoiceModal(true)}
              disabled={w.loading}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:from-gray-600 disabled:to-gray-600 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 disabled:cursor-not-allowed flex items-center justify-center gap-2 mb-3"
            >
              {w.loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>{w.connectionStatus || 'Connecting...'}</span>
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

      {/* Auth Forms */}
      {w.authView === 'none' ? (
        <div className="space-y-2 mb-6">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => w.setAuthView('passkey-register')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
              </svg>
              Sign Up
            </button>
            <button
              onClick={() => w.setAuthView('passkey-login')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
              </svg>
              Login
            </button>
          </div>
          <div className="text-center">
            <button
              onClick={() => w.setAuthView('login')}
              className="text-xs text-gray-500 hover:text-gray-400"
            >
              Use password instead
            </button>
          </div>
        </div>
      ) : w.authView === 'passkey-login' ? (
        <PasskeyLoginView
          onBack={() => w.setAuthView('none')}
          onSuccess={async (credId, prf) => {
            console.log('🔑 Passkey login successful, PRF supported:', prf);
            w.setAuthView('none');
            if (prf && credId) {
              await w.handlePasskeyWalletConnect('default');
            }
          }}
          onSwitchToRegister={() => w.setAuthView('passkey-register')}
          onSwitchToPassword={() => w.setAuthView('login')}
        />
      ) : w.authView === 'passkey-register' ? (
        <PasskeyRegisterView
          onBack={() => w.setAuthView('none')}
          onSuccess={async (credId, prf) => {
            console.log('🔑 Passkey registration successful, PRF supported:', prf);
            w.setAuthView('none');
            if (prf && credId) {
              await w.handlePasskeyWalletConnect('default');
            }
          }}
          onSwitchToLogin={() => w.setAuthView('passkey-login')}
          onSwitchToPassword={() => w.setAuthView('register')}
        />
      ) : w.authView === 'passkey-connect' ? (
        <PasskeyConnectView
          onBack={() => w.setAuthView('none')}
          onConnect={() => w.handlePasskeyWalletConnect('default')}
          passwordError={w.passwordError}
          connectionStatus={w.connectionStatus}
        />
      ) : w.authView === 'login' ? (
        <PasswordLoginView
          onBack={() => w.setAuthView('none')}
          onSuccess={w.handleLoginFormSuccess}
          onSwitchToRegister={() => w.setAuthView('register')}
        />
      ) : w.authView === 'password' ? (
        <PasswordAuthView
          onBack={() => {
            w.setAuthView('none');
            w.setLoginPassword('');
            w.setPasswordError('');
          }}
          loginPassword={w.loginPassword}
          setLoginPassword={w.setLoginPassword}
          passwordError={w.passwordError}
          connectionStatus={w.connectionStatus}
          onConnect={() => w.handleLoginAndConnect(false)}
        />
      ) : (
        <PasswordRegisterView
          onBack={() => w.setAuthView('none')}
          onSuccess={w.handleRegisterFormSuccess}
          onSwitchToLogin={() => w.setAuthView('login')}
        />
      )}

      {/* Only show divider and restore wallet section when not in auth views */}
      {w.authView === 'none' && (
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
          {w.error && (
            <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
              <p className="text-red-400 text-sm">{w.error}</p>
            </div>
          )}

          {/* Restore Wallet Section */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Recovery Mnemonic
            </label>
            <textarea
              value={w.mnemonic}
              onChange={(e) => w.setMnemonic(e.target.value)}
              placeholder="Enter your 12 or 24-word recovery phrase"
              rows={3}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm mb-3"
            />
            <button
              onClick={w.handleConnect}
              disabled={w.loading || !w.mnemonic.trim()}
              className="w-full bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white font-medium py-2.5 px-4 rounded-lg transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {w.loading ? (
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

      {/* Wallet Choice Modal */}
      {w.showWalletChoiceModal && (
        <WalletChoiceModal
          onImportWallet={() => {
            w.setShowWalletChoiceModal(false);
            w.setShowImportWalletModal(true);
          }}
          onCreateNewWallet={w.handleCreateNewWallet}
        />
      )}

      {/* Import Wallet Modal */}
      {w.showImportWalletModal && (
        <ImportWalletModal
          importMnemonic={w.importMnemonic}
          setImportMnemonic={w.setImportMnemonic}
          importError={w.importError}
          importLoading={w.importLoading}
          onImport={w.handleImportWallet}
          onBack={() => {
            w.setShowImportWalletModal(false);
            w.setShowWalletChoiceModal(true);
            w.setImportMnemonic('');
            w.setImportError('');
          }}
        />
      )}
    </div>
  );
}
