'use client';

// --- Wallet Choice Modal ---

interface WalletChoiceModalProps {
  onImportWallet: () => void;
  onCreateNewWallet: () => void;
}

export function WalletChoiceModal({ onImportWallet, onCreateNewWallet }: WalletChoiceModalProps) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[10000] p-4">
      <div className="max-w-md w-full bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 border border-purple-500/30 shadow-2xl">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">Lightning Wallet</h2>
          <p className="text-sm text-gray-400">Do you already have a Lightning wallet?</p>
        </div>

        <div className="space-y-3">
          <button
            onClick={onImportWallet}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            Yes, I have a wallet
          </button>

          <button
            onClick={onCreateNewWallet}
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
  );
}

// --- Import Wallet Modal ---

interface ImportWalletModalProps {
  importMnemonic: string;
  setImportMnemonic: (value: string) => void;
  importError: string;
  importLoading: boolean;
  onImport: () => void;
  onBack: () => void;
}

export function ImportWalletModal({ importMnemonic, setImportMnemonic, importError, importLoading, onImport, onBack }: ImportWalletModalProps) {
  return (
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
            onClick={onImport}
            disabled={importLoading || !importMnemonic.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            {importLoading ? 'Importing...' : 'Import Wallet'}
          </button>

          <button
            onClick={onBack}
            disabled={importLoading}
            className="w-full bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );
}
