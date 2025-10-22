'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// Module-level log to verify file is loaded - will execute immediately when module loads
console.log('🚀🚀🚀 [MODULE LOAD v3.0] ClientOnlyNWC.tsx file loaded at:', new Date().toISOString());

// Dynamically import components with no SSR
const LightningWallet = dynamic(
  () => import('./LightningWallet').then(mod => ({ default: mod.LightningWallet })),
  { 
    ssr: false,
    loading: () => <div className="p-2 rounded-lg bg-gray-800 animate-pulse w-16 h-10" />
  }
);

const LightningPayment = dynamic(
  () => import('./LightningPayment').then(mod => ({ default: mod.LightningPayment })),
  { 
    ssr: false,
    loading: () => (
      <button className="flex items-center gap-2 px-4 py-2 bg-yellow-500/50 text-black font-semibold rounded-lg animate-pulse">
        Loading...
      </button>
    )
  }
);

export function ClientOnlyLightningWallet() {
  console.log('🏗️🏗️🏗️ [WRAPPER v2.0 - UPDATED CODE LOADED] ClientOnlyLightningWallet rendering');

  const [mounted, setMounted] = useState(false);
  const [showPaymentReceived, setShowPaymentReceived] = useState(false);
  const [receivedAmount, setReceivedAmount] = useState(0);

  useEffect(() => {
    console.log('⚡⚡⚡ [WRAPPER v2.0 - UPDATED CODE] useEffect running - setting mounted = true');
    setMounted(true);

    // Set up payment received listener at wrapper level (persistent)
    const handlePaymentReceived = (event: Event) => {
      const customEvent = event as CustomEvent;
      const amount = customEvent.detail?.amount || 0;

      console.log('💸💸💸 [WRAPPER v2.0] Payment received:', amount, 'sats');

      // Show notification
      setReceivedAmount(amount);
      setShowPaymentReceived(true);

      // Auto-hide after 2 seconds
      setTimeout(() => {
        setShowPaymentReceived(false);
      }, 2500);
    };

    console.log('👂👂👂 [WRAPPER v2.0] Setting up breez:payment-received listener');
    window.addEventListener('breez:payment-received', handlePaymentReceived);

    return () => {
      console.log('🧹 [WRAPPER v2.0] Removing breez:payment-received listener');
      window.removeEventListener('breez:payment-received', handlePaymentReceived);
    };
  }, []);

  if (!mounted) {
    return <div className="p-2 rounded-lg bg-gray-800 animate-pulse w-16 h-10" />;
  }

  return (
    <>
      {showPaymentReceived && (
        <div className="fixed top-4 right-4 z-[999999] animate-in slide-in-from-top-5 duration-300">
          <div className="bg-gradient-to-br from-green-600 to-emerald-600 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-4 min-w-[300px]">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center animate-bounce">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="font-bold text-lg">Payment Received!</p>
              <p className="text-2xl font-extrabold">{receivedAmount.toLocaleString()} sats</p>
            </div>
          </div>
        </div>
      )}
      <LightningWallet />
    </>
  );
}

interface ClientOnlyLightningPaymentProps {
  recipientName?: string;
  recipientPubkey?: string;
  defaultAmount?: number;
  description?: string;
  onSuccess?: (preimage: string) => void;
  onError?: (error: string) => void;
  className?: string;
}

export function ClientOnlyLightningPayment(props: ClientOnlyLightningPaymentProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button className="flex items-center gap-2 px-4 py-2 bg-yellow-500/50 text-black font-semibold rounded-lg animate-pulse">
        Loading...
      </button>
    );
  }

  return <LightningPayment {...props} />;
}