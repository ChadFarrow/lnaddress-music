'use client';

import { useState, useEffect } from 'react';
import { Zap, Loader2, CheckCircle, AlertCircle, Copy, X, MessageSquare } from 'lucide-react';
import { useNWC } from '@/hooks/useNWC';
import { LNURLService } from '@/lib/lnurl-service';

interface LightningPaymentProps {
  recipientName?: string;
  recipientPubkey?: string;
  recipientAddress?: string; // Lightning address for LUD-12 comments
  defaultAmount?: number;
  description?: string;
  onSuccess?: (preimage: string) => void;
  onError?: (error: string) => void;
  className?: string;
}

export function LightningPayment({
  recipientName = 'Creator',
  recipientPubkey,
  recipientAddress,
  defaultAmount = 1000,
  description = 'Support the creator',
  onSuccess,
  onError,
  className = ''
}: LightningPaymentProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [amount, setAmount] = useState(defaultAmount);
  const [customAmount, setCustomAmount] = useState('');
  const [invoice, setInvoice] = useState('');
  const [comment, setComment] = useState('');
  const [commentInfo, setCommentInfo] = useState<{ supported: boolean; maxLength: number }>({ supported: false, maxLength: 0 });
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [paymentMessage, setPaymentMessage] = useState('');
  const [copied, setCopied] = useState(false);

  const { isConnected, balance, payInvoice, payKeysend, makeInvoice, loading } = useNWC();

  const presetAmounts = [100, 500, 1000, 5000, 10000];

  // Check for comment support when recipient address is provided
  useEffect(() => {
    if (recipientAddress && isOpen) {
      LNURLService.getCommentInfo(recipientAddress)
        .then(info => {
          setCommentInfo(info);
          console.log('LUD-12 Comment support:', info);
        })
        .catch(error => {
          console.warn('Failed to check comment support:', error);
          setCommentInfo({ supported: false, maxLength: 0 });
        });
    }
  }, [recipientAddress, isOpen]);

  const handlePayment = async () => {
    console.log('🔌 Payment attempt - isConnected:', isConnected, 'balance:', balance);
    if (!isConnected) {
      setPaymentStatus('error');
      setPaymentMessage('Please connect your wallet first');
      return;
    }

    const finalAmount = customAmount ? parseInt(customAmount) : amount;
    if (finalAmount <= 0) {
      setPaymentStatus('error');
      setPaymentMessage('Please enter a valid amount');
      return;
    }

    if (balance !== null && finalAmount > balance) {
      setPaymentStatus('error');
      setPaymentMessage('Insufficient balance');
      return;
    }

    setPaymentStatus('processing');
    setPaymentMessage('Processing payment...');

    try {
      let result;
      
      console.log('💳 Payment decision - invoice:', invoice, 'recipientPubkey:', recipientPubkey);
      
      if (recipientAddress && !invoice) {
        // Pay via LNURL/Lightning Address with potential comment support
        console.log('💳 Attempting LNURL payment to address:', recipientAddress);
        try {
          const commentToSend = comment.trim() || undefined;
          const invoiceFromLNURL = await LNURLService.getPaymentInvoice(
            recipientAddress, 
            finalAmount * 1000, // Convert sats to millisats
            commentToSend
          );
          result = await payInvoice(invoiceFromLNURL);
        } catch (error) {
          console.error('LNURL payment failed:', error);
          result = { success: false, error: error instanceof Error ? error.message : 'LNURL payment failed' };
        }
      } else if (recipientPubkey) {
        // Pay via keysend
        console.log('💳 Attempting keysend payment to pubkey:', recipientPubkey);
        result = await payKeysend(recipientPubkey, finalAmount, description);
        
        // If keysend fails, provide helpful error message or fallback
        if (!result.success) {
          if (result.error?.includes('NO_ROUTE')) {
            console.log('🛣️ No payment route found to recipient');
            result.error = `No payment route found to recipient. This could mean:\n• The pubkey is not a real Lightning node\n• No path exists between your wallet and the recipient\n• The recipient doesn't accept keysend payments`;
          } else if (result.error?.includes('keysend')) {
            console.log('🔄 Keysend failed, trying invoice fallback...');
            const invoiceResult = await makeInvoice(finalAmount, description);
            if (invoiceResult.invoice) {
              result = await payInvoice(invoiceResult.invoice);
            }
          }
        }
      } else if (invoice) {
        // Pay invoice
        console.log('💳 Using invoice payment mode');
        result = await payInvoice(invoice);
      } else {
        // Demo mode: create and pay own invoice for testing
        console.log('🔧 Demo mode: Creating test invoice...');
        const invoiceResult = await makeInvoice(finalAmount, description);
        
        if (invoiceResult.error || !invoiceResult.invoice) {
          setPaymentStatus('error');
          setPaymentMessage('Failed to create demo invoice: ' + (invoiceResult.error || 'Unknown error'));
          return;
        }
        
        console.log('💳 Demo invoice created, now paying it...');
        result = await payInvoice(invoiceResult.invoice);
      }

      if (result.success && result.preimage) {
        setPaymentStatus('success');
        setPaymentMessage(`Payment successful! Sent ${finalAmount} sats`);
        onSuccess?.(result.preimage);
        
        // Reset after success
        setTimeout(() => {
          setIsOpen(false);
          setPaymentStatus('idle');
          setPaymentMessage('');
          setInvoice('');
          setComment('');
        }, 3000);
      } else {
        setPaymentStatus('error');
        setPaymentMessage(result.error || 'Payment failed');
        onError?.(result.error || 'Payment failed');
      }
    } catch (error) {
      setPaymentStatus('error');
      const errorMsg = error instanceof Error ? error.message : 'Payment failed';
      setPaymentMessage(errorMsg);
      onError?.(errorMsg);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatSats = (sats: number) => {
    if (sats >= 100000000) { // 100 million sats = 1 BTC
      return `${(sats / 100000000).toFixed(2)} BTC`;
    } else if (sats >= 1000000) { // 1 million sats
      return `${(sats / 1000000).toFixed(2)}M`;
    } else if (sats >= 1000) {
      return `${(sats / 1000).toFixed(1)}k`;
    }
    return sats.toString();
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold rounded-lg transition-colors ${className}`}
      >
        <Zap className="w-4 h-4" />
        <span>Tip with Lightning</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-gray-900 rounded-2xl shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <h3 className="text-xl font-bold text-white">
                Send Lightning Payment
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Recipient */}
              <div className="text-center">
                <p className="text-sm text-gray-400 mb-1">Sending to</p>
                <p className="text-lg font-semibold text-white">{recipientName}</p>
                {description && (
                  <p className="text-sm text-gray-500 mt-1">{description}</p>
                )}
              </div>

              {/* Amount Selection */}
              {!invoice && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-300">Select amount (sats)</p>
                  
                  {/* Preset amounts */}
                  <div className="grid grid-cols-5 gap-2">
                    {presetAmounts.map((preset) => (
                      <button
                        key={preset}
                        onClick={() => {
                          setAmount(preset);
                          setCustomAmount('');
                        }}
                        className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                          amount === preset && !customAmount
                            ? 'bg-yellow-500 text-black'
                            : 'bg-gray-800 hover:bg-gray-700 text-white'
                        }`}
                      >
                        {formatSats(preset)}
                      </button>
                    ))}
                  </div>

                  {/* Custom amount */}
                  <input
                    type="number"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    placeholder="Custom amount..."
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  />
                </div>
              )}

              {/* Invoice Input */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300">
                  Lightning Invoice (optional)
                </label>
                <textarea
                  value={invoice}
                  onChange={(e) => setInvoice(e.target.value)}
                  placeholder="lnbc..."
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent resize-none"
                  rows={2}
                />
              </div>

              {/* Comment Input (LUD-12) */}
              {recipientAddress && commentInfo.supported && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-gray-400" />
                    <label className="block text-sm font-medium text-gray-300">
                      Message (optional)
                    </label>
                    <span className="text-xs text-gray-500">
                      max {commentInfo.maxLength} chars
                    </span>
                  </div>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Send a message with your payment..."
                    maxLength={commentInfo.maxLength}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent resize-none"
                    rows={2}
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Messages are sent with your Lightning payment</span>
                    <span>{comment.length}/{commentInfo.maxLength}</span>
                  </div>
                </div>
              )}

              {/* Balance Display */}
              {isConnected && balance !== null && (
                <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                  <span className="text-sm text-gray-400">Your balance:</span>
                  <span className="text-sm font-medium text-white">
                    {formatSats(balance)} sats
                  </span>
                </div>
              )}

              {/* Status Messages */}
              {paymentStatus !== 'idle' && (
                <div className={`flex items-start gap-2 p-3 rounded-lg ${
                  paymentStatus === 'success' ? 'bg-green-500/10 border border-green-500/20' :
                  paymentStatus === 'error' ? 'bg-red-500/10 border border-red-500/20' :
                  'bg-yellow-500/10 border border-yellow-500/20'
                }`}>
                  {paymentStatus === 'processing' && <Loader2 className="w-5 h-5 text-yellow-500 animate-spin flex-shrink-0 mt-0.5" />}
                  {paymentStatus === 'success' && <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />}
                  {paymentStatus === 'error' && <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />}
                  <p className={`text-sm ${
                    paymentStatus === 'success' ? 'text-green-400' :
                    paymentStatus === 'error' ? 'text-red-400' :
                    'text-yellow-400'
                  }`}>
                    {paymentMessage}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setIsOpen(false)}
                  className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePayment}
                  disabled={
                    loading || 
                    paymentStatus === 'processing' || 
                    (!invoice && !recipientPubkey && !recipientAddress) ||
                    (commentInfo.supported && comment.length > commentInfo.maxLength)
                  }
                  className="flex-1 py-3 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-700 disabled:text-gray-500 text-black font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {loading || paymentStatus === 'processing' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      <span>Send Payment</span>
                    </>
                  )}
                </button>
              </div>

              {!isConnected && (
                <p className="text-xs text-center text-gray-500">
                  Connect your wallet first to make payments
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}