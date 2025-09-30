'use client';

import Link from 'next/link';
import Image from 'next/image';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b backdrop-blur-sm bg-black/30 pt-safe-plus pt-12" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4 mb-8">
            <Link href="/" className="flex items-center gap-4 hover:opacity-80 transition-opacity">
              <div className="w-10 h-10 relative border border-gray-700 rounded-lg overflow-hidden">
                <Image 
                  src="/HPM-lightning-logo.jpg" 
                  alt="HPM Lightning Logo" 
                  width={40} 
                  height={40}
                  className="object-cover"
                  priority
                />
              </div>
              <h1 className="text-4xl font-bold">Into the Doerfel-Verse</h1>
            </Link>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-12">
            <h1 className="text-4xl font-bold mb-8 text-center">
              About Into the Doerfel-Verse
            </h1>
            
            {/* Main Description - moved from banner */}
            <div className="bg-gray-900/50 rounded-lg p-8 mb-8">
              <p className="text-lg leading-relaxed mb-4">
                This is a music platform for Into the Doerfel-Verse, showcasing what we can do with RSS feeds and music. All data here comes from RSS feeds on{' '}
                <a href="https://podcastindex.org/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">
                  podcastindex.org
                </a>. This is also a demo site that other V4V artists might be about to use as a templet later.
              </p>
              <p className="text-gray-400 text-right">-ChadF</p>
            </div>

            {/* Add to Home Screen Instructions - Moved to top */}
            <div className="bg-gray-900/50 rounded-lg p-8 mb-8">
              <h2 className="text-2xl font-semibold mb-6">
                📱 Add to Your Home Screen
              </h2>
              <p className="text-gray-300 mb-6">
                Get quick access to Into the Doerfel-Verse by adding it to your phone&apos;s home screen. 
                It will work like a native app with offline support!
              </p>
              
              <div className="grid md:grid-cols-2 gap-8">
                {/* iOS Instructions */}
                <div className="bg-black/40 rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <span className="text-2xl">🍎</span> iPhone/iPad (Safari)
                  </h3>
                  <ol className="space-y-3 text-gray-300 text-sm">
                    <li className="flex gap-2">
                      <span className="text-blue-400 font-bold">1.</span>
                      <span>Open this site in Safari browser</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-blue-400 font-bold">2.</span>
                      <span>Tap the Share button <span className="inline-block bg-gray-700 px-2 py-0.5 rounded text-xs">⎙</span> (square with arrow)</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-blue-400 font-bold">3.</span>
                      <span>Scroll down and tap &quot;Add to Home Screen&quot;</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-blue-400 font-bold">4.</span>
                      <span>Name it &quot;Doerfel-Verse&quot; (or keep the default)</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-blue-400 font-bold">5.</span>
                      <span>Tap &quot;Add&quot; in the top right corner</span>
                    </li>
                  </ol>
                  <div className="mt-4 p-3 bg-blue-900/30 rounded-lg border border-blue-500/20">
                    <p className="text-xs text-blue-300">
                      💡 The app icon will appear on your home screen and open in full-screen mode!
                    </p>
                  </div>
                </div>

                {/* Android Instructions */}
                <div className="bg-black/40 rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <span className="text-2xl">🤖</span> Android (Chrome)
                  </h3>
                  <ol className="space-y-3 text-gray-300 text-sm">
                    <li className="flex gap-2">
                      <span className="text-green-400 font-bold">1.</span>
                      <span>Open this site in Chrome browser</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-green-400 font-bold">2.</span>
                      <span>Tap the menu button <span className="inline-block bg-gray-700 px-2 py-0.5 rounded text-xs">⋮</span> (three dots)</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-green-400 font-bold">3.</span>
                      <span>Select &quot;Add to Home screen&quot; or &quot;Install app&quot;</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-green-400 font-bold">4.</span>
                      <span>Name it &quot;Doerfel-Verse&quot; (or keep the default)</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-green-400 font-bold">5.</span>
                      <span>Tap &quot;Add&quot; or &quot;Install&quot;</span>
                    </li>
                  </ol>
                  <div className="mt-4 p-3 bg-green-900/30 rounded-lg border border-green-500/20">
                    <p className="text-xs text-green-300">
                      💡 You might see an &quot;Install&quot; banner at the bottom of the screen - just tap it!
                    </p>
                  </div>
                </div>
              </div>

              {/* Other Browsers */}
              <div className="mt-6 p-4 bg-yellow-900/20 rounded-lg border border-yellow-500/20">
                <p className="text-sm text-yellow-300">
                  <span className="font-semibold">Other browsers:</span> Firefox, Edge, Brave, and Samsung Internet also support this feature. 
                  Look for &quot;Add to Home Screen&quot; or &quot;Install&quot; in the browser menu (usually in the ⋮ or ≡ menu).
                </p>
              </div>
            </div>

            {/* Support Section */}
            <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 rounded-lg p-8 mb-8 border border-purple-500/20">
              <h2 className="text-2xl font-bold mb-6 text-center">Support the Creators</h2>
              <p className="text-gray-300 text-center mb-8">
                If you enjoy the music and content here, please consider supporting the artists and the services that make this possible.
              </p>
              
              <div className="grid md:grid-cols-2 gap-6">
                {/* Doerfels Donation */}
                <div className="bg-black/40 rounded-lg p-6 text-center">
                  <h3 className="text-xl font-semibold mb-3">Support The Doerfels</h3>
                  <p className="text-gray-400 mb-4 text-sm">
                    Help support the musicians and creators behind the amazing content on this platform.
                  </p>
                  <a
                    href="https://www.paypal.com/donate/?hosted_button_id=ATL9BD9EQRSNN"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors font-medium"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8.32 21.97a.546.546 0 0 1-.26-.32c-.03-.15-.06.11.6-8.89.66-9.28.66-9.29.81-9.45a.75.75 0 0 1 .7-.36c.73.05 2.38.43 3.3.78a6.64 6.64 0 0 1 2.84 2.18c.45.57.78 1.16.94 1.69.18.58.2 1.56.05 2.2a5.4 5.4 0 0 1-.85 1.84c-.4.52-1.15 1.24-1.69 1.6a6.13 6.13 0 0 1-2.4 1.03c-.88.19-1.12.2-2.3.2H8.89l-.37 5.18c-.27 3.85-.39 5.2-.44 5.25-.08.08-.4.1-.75.04a.81.81 0 0 1-.33-.11zm4.48-11.42c1.42-.1 2.05-.33 2.62-.9.58-.59.86-1.25.9-2.1.02-.42 0-.6-.1-.95-.33-1.17-1.15-1.84-2.54-2.07-.43-.07-1.53-.11-1.74-.06-.15.04-.17.27-.33 2.33-.18 2.44-.18 2.3 0 2.5.1.1.14.12.54.31.53.26 1.33.45 2.06.48.33.01.73 0 .87-.03h-.28z"/>
                    </svg>
                    Donate via PayPal
                  </a>
                </div>

                {/* Amazon Wishlist */}
                <div className="bg-black/40 rounded-lg p-6 text-center">
                  <h3 className="text-xl font-semibold mb-3">Studio Gear Wishlist</h3>
                  <p className="text-gray-400 mb-4 text-sm">
                    Help The Doerfels get studio gear and equipment from their Amazon wishlist.
                  </p>
                  <a
                    href="https://www.amazon.com/registries/gl/guest-view/2X2SOTRO8TQJL"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg transition-colors font-medium"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                    View Wishlist
                  </a>
                </div>

                {/* Site Donation */}
                <div className="bg-black/40 rounded-lg p-6 text-center">
                  <h3 className="text-xl font-semibold mb-3">Support ChadF</h3>
                  <p className="text-gray-400 mb-4 text-sm">
                    This site is a passion project for me but if you want to help me cover the cost any help is appreciated
                  </p>
                  <a
                    href="https://www.paypal.com/donate/?business=NYCRNVFP4X3DY&no_recurring=0&currency_code=USD"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors font-medium"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8.32 21.97a.546.546 0 0 1-.26-.32c-.03-.15-.06.11.6-8.89.66-9.28.66-9.29.81-9.45a.75.75 0 0 1 .7-.36c.73.05 2.38.43 3.3.78a6.64 6.64 0 0 1 2.84 2.18c.45.57.78 1.16.94 1.69.18.58.2 1.56.05 2.2a5.4 5.4 0 0 1-.85 1.84c-.4.52-1.15 1.24-1.69 1.6a6.13 6.13 0 0 1-2.4 1.03c-.88.19-1.12.2-2.3.2H8.89l-.37 5.18c-.27 3.85-.39 5.2-.44 5.25-.08.08-.4.1-.75.04a.81.81 0 0 1-.33-.11zm4.48-11.42c1.42-.1 2.05-.33 2.62-.9.58-.59.86-1.25.9-2.1.02-.42 0-.6-.1-.95-.33-1.17-1.15-1.84-2.54-2.07-.43-.07-1.53-.11-1.74-.06-.15.04-.17.27-.33 2.33-.18 2.44-.18 2.3 0 2.5.1.1.14.12.54.31.53.26 1.33.45 2.06.48.33.01.73 0 .87-.03h-.28z"/>
                    </svg>
                    Donate via PayPal
                  </a>
                </div>

                {/* PodcastIndex Donation */}
                <div className="bg-black/40 rounded-lg p-6 text-center">
                  <h3 className="text-xl font-semibold mb-3">Support PodcastIndex</h3>
                  <p className="text-gray-400 mb-4 text-sm">
                    Support the open podcast ecosystem that powers this platform.
                  </p>
                  <a
                    href="https://podcastindex.org/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition-colors font-medium"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Visit PodcastIndex
                  </a>
                </div>
              </div>
            </div>

          <div className="bg-gray-900/50 rounded-lg p-8 mb-12">
            <h2 className="text-2xl font-semibold mb-6">
              Links & Resources
            </h2>
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <ul className="space-y-2">
                  <li>
                    <a href="https://www.doerfelverse.com/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">
                      Doerfelverse Official Site
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <ul className="space-y-2">
                  <li>
                    <a href="https://podcastindex.org/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">
                      Podcast Index Website
                    </a>
                  </li>
                  <li>
                    <a href="https://fountain.fm/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">
                      Fountain
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-gray-900/50 rounded-lg p-8 mb-12">
            <h2 className="text-2xl font-semibold mb-6">
              Features
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold mb-3">Music Discovery</h3>
                <p className="text-gray-400">
                  Explore albums and tracks from The Doerfels and other independent artists.
                  Stream music directly from RSS feeds with seamless playback.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-3">RSS Integration</h3>
                <p className="text-gray-400">
                  Built on open standards using RSS feeds and the Podcast Index API.
                  Add your own RSS feeds to discover new content.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">Open Ecosystem</h3>
                <p className="text-gray-400">
                  Supporting Podcasting 2.0 features and value-for-value content.
                  Built for creators and listeners alike.
                </p>
              </div>
            </div>
          </div>






          <div className="text-center">
            <Link 
              href="/" 
              className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-8 py-4 rounded-lg transition-colors font-medium text-lg"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Music
            </Link>
          </div>
        </div>
      </div>
    </main>
  </div>
  );
} 