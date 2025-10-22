import { Music, Mic, Home, TestTube, Zap } from 'lucide-react';
import Link from 'next/link';
import { ClientOnlyLightningWallet } from './ClientOnlyNWC';
import { isLightningEnabled } from '@/lib/feature-flags';

export default function Header() {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-4">
            <Link href="/" className="flex items-center space-x-2 text-primary-600 hover:text-primary-700">
              <div className="flex items-center space-x-1">
                <Music className="h-6 w-6" />
                <Mic className="h-6 w-6" />
              </div>
              <span className="text-xl font-bold">PodcastHub</span>
            </Link>
          </div>
          
          <nav className="flex items-center space-x-6">
            <Link 
              href="/" 
              className="flex items-center space-x-1 text-gray-600 hover:text-primary-600 transition-colors"
            >
              <Home className="h-4 w-4" />
              <span>Home</span>
            </Link>
            <Link 
              href="/trending" 
              className="text-gray-600 hover:text-primary-600 transition-colors"
            >
              Trending
            </Link>
            <Link 
              href="/about" 
              className="text-gray-600 hover:text-primary-600 transition-colors"
            >
              About
            </Link>
            <Link
              href="/feed-tester"
              className="flex items-center space-x-1 text-gray-600 hover:text-primary-600 transition-colors"
            >
              <TestTube className="h-4 w-4" />
              <span>Feed Tester</span>
            </Link>
            {isLightningEnabled() && (
              <>
                <Link
                  href="/test-payments"
                  className="flex items-center space-x-1 text-purple-600 hover:text-purple-700 transition-colors font-medium"
                >
                  <Zap className="h-4 w-4" />
                  <span>Test Payments</span>
                </Link>
                <ClientOnlyLightningWallet />
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
} 