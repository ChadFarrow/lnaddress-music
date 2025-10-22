'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Zap, Wallet, X, Copy, Check, AlertCircle, Loader2 } from 'lucide-react';
import { useNWC } from '@/hooks/useNWC';
import { useBreez } from '@/hooks/useBreez';
import BreezConnect from './BreezConnect';
import AlbyGoConnect from './AlbyGoConnect';
import QRCode from 'qrcode';

type WalletType = 'none' | 'alby' | 'breez' | 'nwc';

export function LightningWallet() {
  console.log('🏗️ LightningWallet component rendering/mounting');

  const [isOpen, setIsOpen] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<WalletType>('none');
  const [showConnectForm, setShowConnectForm] = useState(false);
  const [inputConnection, setInputConnection] = useState('');
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [connectedWalletType, setConnectedWalletType] = useState<'alby' | 'breez' | 'nwc' | null>(null);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [invoiceAmount, setInvoiceAmount] = useState('1000');
  const [invoiceDescription, setInvoiceDescription] = useState('');
  const [generatedInvoice, setGeneratedInvoice] = useState('');
  const [invoiceCopied, setInvoiceCopied] = useState(false);
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [mnemonicCopied, setMnemonicCopied] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const [showPaymentReceived, setShowPaymentReceived] = useState(false);
  const [receivedAmount, setReceivedAmount] = useState(0);

  const nwc = useNWC();
  const breez = useBreez();

  // Use a ref to track if event listener is registered (prevents duplicate registrations)
  const eventListenerRegistered = useRef(false);

  useEffect(() => {
    setMounted(true);

    // Only register the event listener ONCE across all re-renders
    if (!eventListenerRegistered.current && typeof window !== 'undefined') {
      console.log('👂👂👂 [PERSISTENT] LightningWallet: Setting up breez:payment-received listener (one-time setup)');

      const handlePaymentReceived = (event: Event) => {
        const customEvent = event as CustomEvent;
        const amount = customEvent.detail?.amount || 0;

        console.log('💸💸💸 [PERSISTENT] Payment received in LightningWallet:', amount, 'sats');
        console.log('💸 [PERSISTENT] Full event detail:', customEvent.detail);

        // Show payment received notification
        setReceivedAmount(amount);
        setShowPaymentReceived(true);

        console.log('✅ [PERSISTENT] Payment notification state updated, showPaymentReceived:', true);

        // Auto-close the invoice display after 3 seconds
        setTimeout(() => {
          console.log('⏰ [PERSISTENT] Auto-closing payment notification and invoice...');
          setShowPaymentReceived(false);
          setShowInvoiceForm(false);
          setGeneratedInvoice('');
          setQrCodeDataUrl('');
          setInvoiceAmount('1000');
          setInvoiceDescription('');
          console.log('✅ [PERSISTENT] Invoice popup closed');
        }, 3000);
      };

      window.addEventListener('breez:payment-received', handlePaymentReceived);
      eventListenerRegistered.current = true;
      console.log('✅✅✅ [PERSISTENT] Event listener registered and marked as active');
    } else if (eventListenerRegistered.current) {
      console.log('⏭️ [PERSISTENT] Event listener already registered, skipping...');
    }

    // NO cleanup function - we want this listener to persist for the lifetime of the app
  }, []);

  // Determine which wallet is connected
  const isConnected = nwc.isConnected || breez.isConnected;
  const balance = nwc.isConnected ? nwc.balance : breez.isConnected ? breez.balance : null;
  const loading = nwc.loading || breez.loading;
  const error = nwc.error || breez.error;

  // Debug logging
  console.log('💡 LightningWallet state:', {
    isConnected,
    breezIsConnected: breez.isConnected,
    nwcIsConnected: nwc.isConnected,
    selectedWallet,
    loading,
    balance
  });

  // Track wallet type and show success notification
  useEffect(() => {
    if (isConnected) {
      setShowConnectForm(false);
      setInputConnection('');

      // Determine which wallet type connected
      let walletType: 'alby' | 'breez' | 'nwc' | null = null;
      if (breez.isConnected) {
        walletType = 'breez';
      } else if (nwc.isConnected) {
        // Check if it's Alby by examining the connection string or metadata
        // For now, we'll assume generic NWC unless we add Alby detection
        walletType = 'nwc';
      }

      // Only show success toast if wallet type changed (new connection)
      if (walletType && walletType !== connectedWalletType) {
        setConnectedWalletType(walletType);
        setShowSuccessToast(true);
        setTimeout(() => setShowSuccessToast(false), 5000);
      }

      setSelectedWallet('none');
    } else {
      // Reset state when disconnected
      setConnectedWalletType(null);
      setSelectedWallet('none');
      setShowConnectForm(false);
    }
  }, [isConnected, nwc.isConnected, breez.isConnected, connectedWalletType]);

  const handleNWCConnect = async () => {
    if (inputConnection.trim()) {
      await nwc.connect(inputConnection.trim());
    }
  };

  const handleDisconnect = () => {
    if (confirm('Are you sure you want to disconnect your wallet?')) {
      if (nwc.isConnected) {
        nwc.disconnect();
      }
      if (breez.isConnected) {
        breez.disconnect();
      }
    }
  };

  const refreshBalance = async () => {
    if (nwc.isConnected) {
      await nwc.refreshBalance();
    }
    if (breez.isConnected) {
      await breez.refreshBalance();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateInvoice = async () => {
    if (!breez.isConnected) {
      return;
    }

    try {
      const invoice = await breez.receivePayment({
        amountSats: parseInt(invoiceAmount),
        description: invoiceDescription || 'Fund Breez wallet'
      });
      setGeneratedInvoice(invoice);
      console.log('✅ Invoice created:', invoice);

      // Generate QR code
      try {
        const qrDataUrl = await QRCode.toDataURL(invoice.toUpperCase(), {
          width: 256,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
        setQrCodeDataUrl(qrDataUrl);
      } catch (qrErr) {
        console.error('❌ Failed to generate QR code:', qrErr);
      }

      // Start polling for payment after invoice is created
      console.log('🔄 Starting to poll for invoice payment...');
      startPaymentPolling(invoice);
    } catch (err) {
      console.error('❌ Failed to create invoice:', err);
    }
  };

  // DISABLED: Polling is no longer needed since we have persistent event listener
  // The event listener at line 62 will catch payment events automatically
  const startPaymentPolling = (invoice: string) => {
    console.log('ℹ️ Payment polling disabled - using event listener instead');
    // No-op function - event listener will handle payment detection
    return () => {};
  };

  const copyInvoice = () => {
    navigator.clipboard.writeText(generatedInvoice);
    setInvoiceCopied(true);
    setTimeout(() => setInvoiceCopied(false), 2000);
  };

  const getMnemonic = () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('breez:mnemonic') || localStorage.getItem('breez:generated-mnemonic');
  };

  const copyMnemonic = () => {
    const mnemonic = getMnemonic();
    if (mnemonic) {
      navigator.clipboard.writeText(mnemonic);
      setMnemonicCopied(true);
      setTimeout(() => setMnemonicCopied(false), 2000);
    }
  };

  const formatBalance = (sats: number) => {
    console.log('🎯 Formatting balance - input:', sats, 'type:', typeof sats);
    // Format balance with appropriate units
    if (sats >= 100000000) { // 100 million sats = 1 BTC
      const formatted = `${(sats / 100000000).toFixed(2)} BTC`;
      console.log('🎯 Formatted as BTC:', formatted);
      return formatted;
    } else if (sats >= 1000000) { // 1 million sats
      const formatted = `${(sats / 1000000).toFixed(2)}M sats`;
      console.log('🎯 Formatted as M sats:', formatted);
      return formatted;
    } else if (sats >= 100000) { // 100k+ sats - show as whole k
      const formatted = `${Math.floor(sats / 1000)}k sats`;
      console.log('🎯 Formatted as whole k sats:', formatted);
      return formatted;
    }
    // Under 100k sats - show exact amount
    const formatted = `${sats.toLocaleString()} sats`;
    console.log('🎯 Formatted as plain sats:', formatted);
    return formatted;
  };

  const getWalletName = () => {
    if (connectedWalletType === 'breez') return 'Breez SDK Spark';
    if (connectedWalletType === 'alby') return 'Alby Hub';
    if (connectedWalletType === 'nwc') return 'Nostr Wallet Connect';
    return 'Lightning Wallet';
  };

  return (
    <>
      {/* Success Toast */}
      {showSuccessToast && (
        <div className="fixed top-4 right-4 z-[999999] animate-in slide-in-from-top-5 duration-300">
          <div className="bg-green-600 text-white px-6 py-3 rounded-lg shadow-2xl flex items-center gap-3">
            <Check className="w-5 h-5" />
            <div>
              <p className="font-semibold">Wallet Connected!</p>
              <p className="text-sm text-green-100">Successfully connected to {getWalletName()}</p>
            </div>
          </div>
        </div>
      )}

      {/* Wallet Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="relative p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
        aria-label="Lightning Wallet"
      >
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-500" />
          {isConnected && balance !== null && (
            <span className="text-sm font-medium text-gray-200">
              {formatBalance(balance)}
            </span>
          )}
        </div>
        {isConnected && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
        )}
      </button>

      {/* Wallet Modal - rendered via portal to document body */}
      {mounted && isOpen && createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" style={{ zIndex: 999999 }}>
          <div className="relative w-full max-w-md bg-gray-900 rounded-2xl shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/10 rounded-lg">
                  <Zap className="w-6 h-6 text-yellow-500" />
                </div>
                <h2 className="text-xl font-bold text-white">Lightning Wallet</h2>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {loading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 text-yellow-500 animate-spin" />
                </div>
              )}

              {!loading && !isConnected && selectedWallet === 'none' && (
                <div className="space-y-4">
                  <div className="text-center mb-6">
                    <Wallet className="w-16 h-16 mx-auto mb-4 text-gray-500" />
                    <p className="text-gray-400">
                      Choose a wallet to connect
                    </p>
                  </div>

                  {/* Alby Hub */}
                  <button
                    onClick={() => setSelectedWallet('alby')}
                    className="w-full p-4 bg-gradient-to-r from-amber-900/20 to-yellow-900/20 hover:from-amber-900/30 hover:to-yellow-900/30 border border-amber-500/30 hover:border-amber-500/50 rounded-lg transition-all flex items-center gap-3"
                  >
                    <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Zap className="w-6 h-6 text-black" />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-white">Alby Hub</div>
                      <div className="text-sm text-gray-400">One-tap connection</div>
                    </div>
                  </button>

                  {/* Breez SDK Spark */}
                  <button
                    onClick={() => setSelectedWallet('breez')}
                    className="w-full p-4 bg-gradient-to-r from-purple-900/20 to-blue-900/20 hover:from-purple-900/30 hover:to-blue-900/30 border border-purple-500/30 hover:border-purple-500/50 rounded-lg transition-all flex items-center gap-3"
                  >
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Zap className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-white">Breez SDK Spark</div>
                      <div className="text-sm text-gray-400">Self-custodial wallet</div>
                    </div>
                  </button>

                  {/* NWC Manual */}
                  <button
                    onClick={() => setSelectedWallet('nwc')}
                    className="w-full p-4 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 hover:border-gray-600 rounded-lg transition-all flex items-center gap-3"
                  >
                    <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Wallet className="w-6 h-6 text-gray-300" />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-white">Nostr Wallet Connect</div>
                      <div className="text-sm text-gray-400">Connect any NWC wallet</div>
                    </div>
                  </button>

                  <div className="pt-4 text-xs text-gray-500 text-center">
                    <p>All wallets support Lightning payments</p>
                  </div>
                </div>
              )}

              {/* Alby Connection */}
              {!loading && !isConnected && selectedWallet === 'alby' && (
                <div className="space-y-4">
                  <button
                    onClick={() => setSelectedWallet('none')}
                    className="text-sm text-gray-400 hover:text-white flex items-center gap-1"
                  >
                    ← Back
                  </button>
                  <AlbyGoConnect
                    onSuccess={() => {
                      setSelectedWallet('none');
                      setIsOpen(false);
                    }}
                    onError={(err) => console.error('Alby connection error:', err)}
                  />
                </div>
              )}

              {/* Breez Connection */}
              {!loading && !isConnected && selectedWallet === 'breez' && (
                <div className="space-y-4">
                  <button
                    onClick={() => setSelectedWallet('none')}
                    className="text-sm text-gray-400 hover:text-white flex items-center gap-1"
                  >
                    ← Back
                  </button>
                  <BreezConnect
                    onSuccess={() => {
                      setSelectedWallet('none');
                      setIsOpen(false);
                    }}
                    onError={(err) => console.error('Breez connection error:', err)}
                  />
                </div>
              )}

              {/* NWC Manual Connection */}
              {!loading && !isConnected && selectedWallet === 'nwc' && (
                <div className="space-y-4">
                  <button
                    onClick={() => setSelectedWallet('none')}
                    className="text-sm text-gray-400 hover:text-white flex items-center gap-1"
                  >
                    ← Back
                  </button>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      NWC Connection String
                    </label>
                    <textarea
                      value={inputConnection}
                      onChange={(e) => setInputConnection(e.target.value)}
                      placeholder="nostr+walletconnect://..."
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent resize-none"
                      rows={3}
                    />
                  </div>

                  {error && (
                    <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-400">{error}</p>
                    </div>
                  )}

                  <button
                    onClick={handleNWCConnect}
                    disabled={!inputConnection.trim()}
                    className="w-full py-2 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-700 disabled:text-gray-500 text-black font-semibold rounded-lg transition-colors"
                  >
                    Connect
                  </button>

                  <div className="text-xs text-gray-500 text-center">
                    <p>Get your NWC connection string from your wallet app</p>
                    <a
                      href="https://nwc.dev"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-yellow-500 hover:underline"
                    >
                      Learn more about NWC
                    </a>
                  </div>
                </div>
              )}

              {!loading && isConnected && (
                <div className="space-y-6">
                  {/* Wallet Type Badge */}
                  <div className="flex items-center justify-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-600/20 border border-green-500/30 rounded-full">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <p className="text-sm font-medium text-green-400">Connected to {getWalletName()}</p>
                    </div>
                  </div>

                  {/* Balance */}
                  <div className="text-center">
                    <p className="text-sm text-gray-400 mb-2">Balance</p>
                    <div className="flex items-center justify-center gap-2">
                      <Zap className="w-8 h-8 text-yellow-500" />
                      {loading && balance === null ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                          <p className="text-xl text-gray-400">Syncing...</p>
                        </div>
                      ) : (
                        <p className="text-3xl font-bold text-white">
                          {balance !== null ? formatBalance(balance) : '---'}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="space-y-3">
                    {breez.isConnected && !showInvoiceForm && (
                      <button
                        onClick={() => setShowInvoiceForm(true)}
                        className="w-full py-2 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold rounded-lg transition-colors"
                      >
                        Create Invoice
                      </button>
                    )}

                    {showInvoiceForm && !generatedInvoice && (
                      <div className="space-y-3 p-4 bg-gray-800/50 rounded-lg">
                        <h3 className="font-semibold text-white">Create Lightning Invoice</h3>
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Amount (sats)</label>
                          <input
                            type="number"
                            value={invoiceAmount}
                            onChange={(e) => setInvoiceAmount(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                            placeholder="1000"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Description (optional)</label>
                          <input
                            type="text"
                            value={invoiceDescription}
                            onChange={(e) => setInvoiceDescription(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                            placeholder="Fund Breez wallet"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={handleCreateInvoice}
                            className="flex-1 py-2 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold rounded-lg transition-colors"
                          >
                            Generate
                          </button>
                          <button
                            onClick={() => {
                              setShowInvoiceForm(false);
                              setGeneratedInvoice('');
                            }}
                            className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {generatedInvoice && !showPaymentReceived && (
                      <div className="space-y-3 p-4 bg-green-900/20 border border-green-500/30 rounded-lg">
                        <h3 className="font-semibold text-green-400">Invoice Created!</h3>
                        <p className="text-xs text-gray-400">Scan with any Lightning wallet</p>

                        {/* QR Code */}
                        {qrCodeDataUrl && (
                          <div className="flex justify-center p-4 bg-white rounded-lg">
                            <img src={qrCodeDataUrl} alt="Invoice QR Code" className="w-48 h-48" />
                          </div>
                        )}

                        {/* Invoice String */}
                        <div className="p-2 bg-gray-900 rounded break-all text-xs text-gray-300 max-h-24 overflow-y-auto">
                          {generatedInvoice}
                        </div>

                        <button
                          onClick={copyInvoice}
                          className="w-full py-2 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                          {invoiceCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          {invoiceCopied ? 'Copied!' : 'Copy Invoice'}
                        </button>
                        <button
                          onClick={() => {
                            setShowInvoiceForm(false);
                            setGeneratedInvoice('');
                            setQrCodeDataUrl('');
                            setInvoiceAmount('1000');
                            setInvoiceDescription('');
                          }}
                          className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                        >
                          Close
                        </button>
                      </div>
                    )}

                    {showPaymentReceived && (
                      <div className="space-y-3 p-6 bg-gradient-to-br from-green-900/30 to-emerald-900/30 border-2 border-green-500/50 rounded-lg animate-in zoom-in duration-300">
                        <div className="flex items-center justify-center">
                          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center animate-bounce">
                            <Check className="w-10 h-10 text-white" />
                          </div>
                        </div>
                        <div className="text-center">
                          <h3 className="text-2xl font-bold text-green-400 mb-2">Payment Received!</h3>
                          <div className="flex items-center justify-center gap-2 text-white">
                            <Zap className="w-6 h-6 text-yellow-500" />
                            <p className="text-3xl font-bold">{receivedAmount.toLocaleString()}</p>
                            <p className="text-xl text-gray-300">sats</p>
                          </div>
                          <p className="text-sm text-green-300 mt-3">Closing automatically in 3 seconds...</p>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={refreshBalance}
                      className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
                    >
                      Refresh Balance
                    </button>

                    {breez.isConnected && !showMnemonic && (
                      <button
                        onClick={() => setShowMnemonic(true)}
                        className="w-full py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-lg transition-colors"
                      >
                        Show Recovery Phrase
                      </button>
                    )}

                    {showMnemonic && (
                      <div className="space-y-3 p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <h3 className="font-semibold text-yellow-400">Recovery Phrase</h3>
                            <p className="text-xs text-yellow-300 mt-1">
                              These 12 words can recover your wallet. Never share them with anyone!
                            </p>
                          </div>
                        </div>
                        <div className="p-3 bg-gray-900 rounded text-sm text-gray-300 font-mono break-words">
                          {getMnemonic()}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={copyMnemonic}
                            className="flex-1 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                          >
                            {mnemonicCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            {mnemonicCopied ? 'Copied!' : 'Copy to Clipboard'}
                          </button>
                          <button
                            onClick={() => setShowMnemonic(false)}
                            className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                          >
                            Hide
                          </button>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={handleDisconnect}
                      className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors"
                    >
                      Disconnect Wallet
                    </button>
                  </div>

                  <div className="pt-4 border-t border-gray-800">
                    <p className="text-xs text-gray-500 text-center">
                      All transactions are secured by Lightning Network
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}