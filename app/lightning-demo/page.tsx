'use client';

import { useState } from 'react';
import { ClientOnlyLightningPayment, ClientOnlyLightningWallet } from '@/components/ClientOnlyNWC';
import { BitcoinConnectWallet, BitcoinConnectPayment } from '@/components/BitcoinConnect';
import { Zap, Info, Check, X } from 'lucide-react';

export default function LightningDemoPage() {
  const [paymentHistory, setPaymentHistory] = useState<Array<{
    id: string;
    amount: number;
    timestamp: Date;
    success: boolean;
  }>>([]);

  const handlePaymentSuccess = (response: any) => {
    // Handle both string preimage and object response
    const preimage = typeof response === 'string' ? response : (response?.preimage || 'demo_' + Math.random().toString(36).substring(7));
    const amount = response?.amount_paid ? Math.floor(response.amount_paid / 1000) : 1000; // Convert msats to sats
    
    setPaymentHistory(prev => [...prev, {
      id: preimage.substring(0, 8),
      amount: amount,
      timestamp: new Date(),
      success: true
    }]);
  };

  const handlePaymentError = (error: string) => {
    setPaymentHistory(prev => [...prev, {
      id: Math.random().toString(36).substring(7),
      amount: 0,
      timestamp: new Date(),
      success: false
    }]);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-4 flex items-center gap-3">
            <Zap className="w-10 h-10 text-yellow-500" />
            Lightning Network Integration Demo
          </h1>
          <p className="text-gray-400 text-lg">
            Experience instant Bitcoin payments with NWC (Nostr Wallet Connect)
          </p>
        </div>

        {/* Info Section */}
        <div className="bg-gray-900 rounded-2xl p-6 mb-8 border border-gray-800">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-1" />
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">How it works</h2>
              <ol className="list-decimal list-inside space-y-1 text-gray-400">
                <li>Connect your Lightning wallet using the wallet button in the header</li>
                <li>Use any NWC-compatible wallet (Alby, Mutiny, etc.)</li>
                <li>Make instant payments to content creators</li>
                <li>Support podcasters with Lightning boosts</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Demo Sections */}
        <div className="space-y-8">
          {/* Bitcoin Connect Method */}
          <div className="bg-gradient-to-r from-orange-500/10 to-yellow-500/10 rounded-2xl p-6 border border-orange-500/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-orange-500/20 rounded-lg">
                <Zap className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">Bitcoin Connect</h3>
                <p className="text-orange-200 text-sm">Easy one-click wallet connection</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="font-semibold text-white">1. Connect Wallet</h4>
                <p className="text-gray-300 text-sm">
                  One-click connection to Alby, Mutiny, Phoenix, and more
                </p>
                <div className="flex justify-center">
                  <BitcoinConnectWallet />
                </div>
              </div>
              
              <div className="space-y-4">
                <h4 className="font-semibold text-white">2. Send Payment</h4>
                <p className="text-gray-300 text-sm">
                  Instant Lightning payments with proper balance display
                </p>
                <div className="flex justify-center">
                  <BitcoinConnectPayment
                    amount={1000}
                    description="Support this podcast"
                    onSuccess={handlePaymentSuccess}
                    onError={handlePaymentError}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* NWC Method */}
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-gray-700 rounded-lg">
                <Zap className="w-6 h-6 text-gray-400" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">NWC (Advanced)</h3>
                <p className="text-gray-400 text-sm">Manual connection string method</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="font-semibold text-white">1. Connect with NWC String</h4>
                <p className="text-gray-400 text-sm">
                  Paste your NWC connection string manually
                </p>
                <div className="flex justify-center">
                  <ClientOnlyLightningWallet />
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold text-white">2. Send Payment</h4>
                <p className="text-gray-400 text-sm">
                  Direct NWC protocol payments (to test address)
                </p>
                <div className="flex justify-center">
                  <ClientOnlyLightningPayment
                    recipientName="Demo Podcast"
                    recipientPubkey="03740ea02585ed87b83b2f76317a4562b616bd7b8ec3f925be6596932b2003fc9e"
                    description="Demo payment to test address"
                    defaultAmount={1000}
                    onSuccess={handlePaymentSuccess}
                    onError={handlePaymentError}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Use Cases */}
        <div className="mt-12 bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <h3 className="text-xl font-semibold mb-6">Lightning Payment Use Cases</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-yellow-500">
                <Zap className="w-5 h-5" />
                <h4 className="font-semibold">Podcast Boosts</h4>
              </div>
              <p className="text-gray-400 text-sm">
                Send instant boosts to your favorite podcasters while listening
              </p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-yellow-500">
                <Zap className="w-5 h-5" />
                <h4 className="font-semibold">Premium Content</h4>
              </div>
              <p className="text-gray-400 text-sm">
                Unlock exclusive episodes or early access with Lightning payments
              </p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-yellow-500">
                <Zap className="w-5 h-5" />
                <h4 className="font-semibold">Value4Value</h4>
              </div>
              <p className="text-gray-400 text-sm">
                Support creators directly based on the value you receive
              </p>
            </div>
          </div>
        </div>

        {/* Payment History */}
        {paymentHistory.length > 0 && (
          <div className="mt-12 bg-gray-900 rounded-2xl p-6 border border-gray-800">
            <h3 className="text-xl font-semibold mb-4">Payment History</h3>
            <div className="space-y-2">
              {paymentHistory.map((payment, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-800 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {payment.success ? (
                      <Check className="w-5 h-5 text-green-500" />
                    ) : (
                      <X className="w-5 h-5 text-red-500" />
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        {payment.success ? 'Payment Sent' : 'Payment Failed'}
                      </p>
                      <p className="text-xs text-gray-400">
                        ID: {payment.id}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {payment.success && (
                      <p className="text-sm font-medium text-yellow-500">
                        {payment.amount} sats
                      </p>
                    )}
                    <p className="text-xs text-gray-400">
                      {payment.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Technical Details */}
        <div className="mt-12 bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <h3 className="text-xl font-semibold mb-4">Technical Implementation</h3>
          <div className="space-y-4 text-gray-400">
            <div>
              <h4 className="font-semibold text-white mb-1">NWC Protocol (NIP-47)</h4>
              <p className="text-sm">
                Nostr Wallet Connect enables secure wallet connections through encrypted Nostr events
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-1">Supported Methods</h4>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>pay_invoice - Pay Lightning invoices</li>
                <li>pay_keysend - Direct payments without invoice</li>
                <li>make_invoice - Generate payment requests</li>
                <li>get_balance - Check wallet balance</li>
                <li>list_transactions - View payment history</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-1">Security</h4>
              <p className="text-sm">
                All communication is end-to-end encrypted using NIP-04 encryption
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}