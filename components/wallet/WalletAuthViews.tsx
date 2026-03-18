'use client';

import type { AuthView } from '@/hooks/useBreezWallet';
import LoginForm from '@/components/LoginForm';
import RegisterForm from '@/components/RegisterForm';
import PasskeyLoginForm from '@/components/PasskeyLoginForm';
import PasskeyRegisterForm from '@/components/PasskeyRegisterForm';

// --- Shared BackButton ---

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-sm text-gray-400 hover:text-white flex items-center gap-1 mb-4"
    >
      ← Back
    </button>
  );
}

// --- Shared spinner SVG for status/loading ---

function SpinnerIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

// --- Shared error/status alerts ---

function ErrorAlert({ message }: { message: string }) {
  return (
    <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4">
      <p className="text-red-200 text-sm">{message}</p>
    </div>
  );
}

function StatusAlert({ message }: { message: string }) {
  return (
    <div className="bg-blue-900/30 border border-blue-500/50 rounded-lg p-4">
      <p className="text-blue-200 text-sm flex items-center gap-2">
        <SpinnerIcon />
        {message}
      </p>
    </div>
  );
}

// --- Passkey fingerprint SVG icon ---

function PasskeyIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
    </svg>
  );
}

// --- Auth View Components ---

interface PasskeyLoginViewProps {
  onBack: () => void;
  onSuccess: (credentialId: string, prfSupported: boolean) => void;
  onSwitchToRegister: () => void;
  onSwitchToPassword: () => void;
}

export function PasskeyLoginView({ onBack, onSuccess, onSwitchToRegister, onSwitchToPassword }: PasskeyLoginViewProps) {
  return (
    <div className="mb-6">
      <BackButton onClick={onBack} />
      <PasskeyLoginForm
        onSuccess={onSuccess}
        onSwitchToRegister={onSwitchToRegister}
        onSwitchToPassword={onSwitchToPassword}
        className="!bg-transparent !border-0 !p-0"
      />
    </div>
  );
}

interface PasskeyRegisterViewProps {
  onBack: () => void;
  onSuccess: (credentialId: string, prfSupported: boolean) => void;
  onSwitchToLogin: () => void;
  onSwitchToPassword: () => void;
}

export function PasskeyRegisterView({ onBack, onSuccess, onSwitchToLogin, onSwitchToPassword }: PasskeyRegisterViewProps) {
  return (
    <div className="mb-6">
      <BackButton onClick={onBack} />
      <PasskeyRegisterForm
        onSuccess={onSuccess}
        onSwitchToLogin={onSwitchToLogin}
        onSwitchToPassword={onSwitchToPassword}
        className="!bg-transparent !border-0 !p-0"
      />
    </div>
  );
}

interface PasskeyConnectViewProps {
  onBack: () => void;
  onConnect: () => void;
  passwordError: string;
  connectionStatus: string;
}

export function PasskeyConnectView({ onBack, onConnect, passwordError, connectionStatus }: PasskeyConnectViewProps) {
  return (
    <div className="mb-6">
      <BackButton onClick={onBack} />
      <div className="space-y-4">
        <h3 className="text-white font-semibold">Connect Wallet with Passkey</h3>
        <p className="text-sm text-gray-400">
          Your wallet key will be derived from your passkey. No password needed.
        </p>
        {passwordError && <ErrorAlert message={passwordError} />}
        {connectionStatus && <StatusAlert message={connectionStatus} />}
        <button
          onClick={onConnect}
          disabled={!!connectionStatus}
          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:from-gray-600 disabled:to-gray-600 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <PasskeyIcon />
          Connect with Passkey
        </button>
      </div>
    </div>
  );
}

interface PasswordLoginViewProps {
  onBack: () => void;
  onSuccess: (password?: string) => void;
  onSwitchToRegister: () => void;
}

export function PasswordLoginView({ onBack, onSuccess, onSwitchToRegister }: PasswordLoginViewProps) {
  return (
    <div className="mb-6">
      <BackButton onClick={onBack} />
      <LoginForm
        onSuccess={onSuccess}
        onSwitchToRegister={onSwitchToRegister}
        className="!bg-transparent !border-0 !p-0"
      />
    </div>
  );
}

interface PasswordAuthViewProps {
  onBack: () => void;
  loginPassword: string;
  setLoginPassword: (pw: string) => void;
  passwordError: string;
  connectionStatus: string;
  onConnect: () => void;
}

export function PasswordAuthView({ onBack, loginPassword, setLoginPassword, passwordError, connectionStatus, onConnect }: PasswordAuthViewProps) {
  return (
    <div className="mb-6">
      <BackButton onClick={onBack} />
      <div className="space-y-4">
        <div>
          <h3 className="text-white font-semibold mb-2">Connect Your Wallet</h3>
          <p className="text-sm text-gray-400 mb-4">
            Enter your password to decrypt and connect your saved wallet
          </p>
        </div>

        {passwordError && <ErrorAlert message={passwordError} />}
        {connectionStatus && <StatusAlert message={connectionStatus} />}

        <div>
          <label htmlFor="wallet-password" className="block text-sm font-medium text-gray-300 mb-2">
            Password
          </label>
          <input
            type="password"
            id="wallet-password"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && onConnect()}
            className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            placeholder="Enter your password"
            disabled={!!connectionStatus}
          />
        </div>

        <button
          onClick={onConnect}
          disabled={!!connectionStatus || !loginPassword}
          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:from-gray-600 disabled:to-gray-600 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {connectionStatus ? (
            <>
              <SpinnerIcon className="h-5 w-5" />
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
  );
}

interface PasswordRegisterViewProps {
  onBack: () => void;
  onSuccess: (password?: string) => void;
  onSwitchToLogin: () => void;
}

export function PasswordRegisterView({ onBack, onSuccess, onSwitchToLogin }: PasswordRegisterViewProps) {
  return (
    <div className="mb-6">
      <BackButton onClick={onBack} />
      <RegisterForm
        onSuccess={onSuccess}
        onSwitchToLogin={onSwitchToLogin}
        className="!bg-transparent !border-0 !p-0"
      />
    </div>
  );
}
