'use client';

import { X, Loader2, Zap } from 'lucide-react';

export interface PaymentRecipient {
  name: string;
  address: string;
  type: string;
  split: number;
  amount: number;
  supported?: boolean;
  error?: string;
}

export interface PaymentConfirmation {
  title: string;
  amount: number;
  recipients: PaymentRecipient[];
  processing?: boolean;
  recipientStatus?: Map<string, { status: 'pending' | 'processing' | 'success' | 'failed'; error?: string }>;
}

interface PaymentConfirmationModalProps {
  confirmation: PaymentConfirmation | null;
  paymentAmount: string;
  senderName: string;
  paymentMessage: string;
  onAmountChange: (amount: string) => void;
  onSenderNameChange: (name: string) => void;
  onMessageChange: (message: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export function PaymentConfirmationModal({
  confirmation,
  paymentAmount,
  senderName,
  paymentMessage,
  onAmountChange,
  onSenderNameChange,
  onMessageChange,
  onCancel,
  onConfirm
}: PaymentConfirmationModalProps) {
  if (!confirmation) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-purple-500/30 rounded-2xl p-6 max-w-lg w-full shadow-2xl relative">
        {/* Close button */}
        <button
          onClick={onCancel}
          disabled={confirmation.processing}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">Confirm Boost ⚡</h2>
          <p className="text-gray-300 text-sm">
            {confirmation.title}
          </p>
        </div>

        {/* Amount, Name and Message Inputs */}
        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-gray-400 text-xs mb-1">Amount (sats)</label>
            <input
              type="number"
              value={paymentAmount}
              onChange={(e) => onAmountChange(e.target.value)}
              disabled={confirmation.processing}
              placeholder="100"
              className="w-full px-3 py-2 bg-gray-800 border border-purple-500/30 text-white rounded-lg text-sm focus:outline-none focus:border-purple-400 placeholder:text-gray-500 disabled:opacity-50"
              min="1"
            />
          </div>
          <div>
            <label className="block text-gray-400 text-xs mb-1">Your Name (optional, saved)</label>
            <input
              type="text"
              value={senderName}
              onChange={(e) => onSenderNameChange(e.target.value)}
              disabled={confirmation.processing}
              placeholder="Enter your name..."
              className="w-full px-3 py-2 bg-gray-800 border border-purple-500/30 text-white rounded-lg text-sm focus:outline-none focus:border-purple-400 placeholder:text-gray-500 disabled:opacity-50"
              maxLength={50}
            />
          </div>
          <div>
            <label className="block text-gray-400 text-xs mb-1">Message (optional)</label>
            <input
              type="text"
              value={paymentMessage}
              onChange={(e) => onMessageChange(e.target.value)}
              disabled={confirmation.processing}
              placeholder="Add a message..."
              className="w-full px-3 py-2 bg-gray-800 border border-purple-500/30 text-white rounded-lg text-sm focus:outline-none focus:border-purple-400 placeholder:text-gray-500 disabled:opacity-50"
              maxLength={144}
            />
          </div>
          {/* Message Preview */}
          {(senderName || paymentMessage) && (
            <div className="bg-black/30 rounded-lg p-3">
              <div className="text-gray-400 text-xs mb-1">Preview</div>
              <div className="text-white text-sm">
                {senderName && `From ${senderName}: `}
                {paymentMessage || 'Boost payment'}
              </div>
            </div>
          )}
        </div>

        {/* Recipients */}
        <div className="mb-6">
          <div className="text-gray-400 text-sm mb-2">Recipients ({confirmation.recipients.length})</div>
          <div className="relative">
            {/* Gradient fade at top */}
            {confirmation.recipients.length > 3 && (
              <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-gray-900 to-transparent pointer-events-none z-10" />
            )}

            {/* Scrollable recipient list */}
            <div
              className="space-y-2 max-h-64 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-purple-500/50 scrollbar-track-gray-800/50 hover:scrollbar-thumb-purple-500/70 scroll-smooth"
              id="recipient-scroll-container"
            >
              {confirmation.recipients.map((recipient, idx) => {
                const status = confirmation.recipientStatus?.get(recipient.address);
                const isProcessing = status?.status === 'processing';
                const isSuccess = status?.status === 'success';
                const isFailed = status?.status === 'failed';
                const isUnsupported = recipient.supported === false;

                // Calculate actual payment percentage based on total boost amount
                const totalBoostAmount = confirmation.amount;
                const actualPercentage = totalBoostAmount > 0 ? Math.round((recipient.amount / totalBoostAmount) * 100) : 0;

                return (
                  <div
                    id={`recipient-${idx}`}
                    key={idx}
                    ref={(el) => {
                      // Auto-scroll to processing recipient
                      if (el && isProcessing) {
                        el.scrollIntoView({
                          behavior: 'smooth',
                          block: 'nearest',
                          inline: 'nearest'
                        });
                      }
                    }}
                    className={`border rounded-lg p-3 flex items-center justify-between transition-colors ${
                      isUnsupported ? 'bg-gray-900/30 border-gray-700/30 opacity-60' :
                      isSuccess ? 'bg-green-500/10 border-green-500/30' :
                      isFailed ? 'bg-red-500/10 border-red-500/30' :
                      isProcessing ? 'bg-purple-500/10 border-purple-500/30' :
                      'bg-white/5 border-white/10'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className={`font-medium text-sm truncate ${isUnsupported ? 'text-gray-500' : 'text-white'}`}>
                          {recipient.name}
                        </div>
                        {/* Type badge */}
                        <span className={`px-1.5 py-0.5 text-xs rounded ${
                          isUnsupported ? 'bg-red-900/50 text-red-300' : 'bg-green-900/50 text-green-300'
                        }`}>
                          {recipient.type}
                        </span>
                        {isUnsupported && <span className="text-red-400/70 text-xs">(skipped)</span>}
                        {isProcessing && <Loader2 className="w-3 h-3 animate-spin text-purple-400" />}
                        {isSuccess && <span className="text-green-400 text-xs">✓</span>}
                        {isFailed && <span className="text-red-400 text-xs">✗</span>}
                      </div>
                      <div className={`text-xs truncate ${isUnsupported ? 'text-gray-600' : 'text-gray-400'}`}>
                        {recipient.address}
                      </div>
                      {isUnsupported && (
                        <div className="text-red-400/70 text-xs mt-1">
                          Wallet doesn&apos;t support {recipient.type}
                        </div>
                      )}
                      {isFailed && status.error && (
                        <div className="text-red-400 text-xs mt-1 break-words">{status.error}</div>
                      )}
                    </div>
                    <div className="text-right ml-3">
                      <div className={`font-semibold ${isUnsupported ? 'text-gray-600 line-through' : 'text-purple-300'}`}>
                        {recipient.amount.toLocaleString()} sats
                      </div>
                      <div className="text-gray-500 text-xs">
                        {isUnsupported ? (
                          <span className="line-through">{actualPercentage}%</span>
                        ) : (
                          `${actualPercentage}%`
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Gradient fade at bottom */}
            {confirmation.recipients.length > 3 && (
              <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-gray-900 to-transparent pointer-events-none z-10" />
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={confirmation.processing}
            className="flex-1 px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={confirmation.processing}
            className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {confirmation.processing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Zap className="w-5 h-5" />
                Send Boost
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
