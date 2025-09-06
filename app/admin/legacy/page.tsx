'use client';

import { useState, useEffect } from 'react';
import { toast } from '@/components/Toast';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

// Dynamic import for the heavy admin panel component
const AdminPanel = dynamic(() => import('@/components/AdminPanel'), {
  loading: () => (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-lg">Loading legacy admin panel...</p>
      </div>
    </div>
  ),
  ssr: false // Admin panels typically don't need SSR
});

export default function LegacyAdminPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Header */}
      <header className="bg-black/20 backdrop-blur-sm border-b border-white/10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="p-2 hover:bg-white/10 rounded-lg transition-colors group"
              title="Back to admin dashboard"
            >
              <ArrowLeft className="w-5 h-5 group-hover:scale-110 transition-transform" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Legacy Admin Panel</h1>
              <p className="text-gray-400 text-sm">CDN and hardcoded feed management</p>
            </div>
          </div>
        </div>
      </header>

      {/* Legacy Admin Panel */}
      <AdminPanel />
    </div>
  );
}