import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration'
import PWAInstallPrompt from '@/components/PWAInstallPrompt'
import ErrorBoundary from '@/components/ErrorBoundary'
import ClientErrorBoundary from '@/components/ClientErrorBoundary'
import { ToastContainer } from '@/components/Toast'
import { AudioProvider } from '@/contexts/AudioContext'
import { BitcoinConnectProvider } from '@/contexts/BitcoinConnectContext'
import { LightningProvider } from '@/contexts/LightningContext'
import GlobalNowPlayingBar from '@/components/GlobalNowPlayingBar'



const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap'
})

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_SITE_TITLE || 'Music Platform',
  description: 'Value4Value music platform powered by Lightning Network',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: process.env.NEXT_PUBLIC_BAND_NAME || 'Music Platform',
    // startupImage removed - add your own when ready
  },
  other: {
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'apple-mobile-web-app-title': process.env.NEXT_PUBLIC_BAND_NAME || 'Music Platform',
    'mobile-web-app-capable': 'yes',
    'format-detection': 'telephone=no',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#1f2937',
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        {/* Resource hints for performance */}
        {/* Preconnect hints will be added based on your actual RSS feed domains */}
        <link rel="prefetch" href="/api/albums-static-cached" as="fetch" crossOrigin="anonymous" />
        
        {/* Global Error Handler Script */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                window.addEventListener("error", function(event) {
                  console.error("Layout error caught:", event.error);
                  if (event.error && event.error.stack) {
                    console.error("Stack trace:", event.error.stack);
                  }
                });
                
                window.addEventListener("unhandledrejection", function(event) {
                  if (event.reason && event.reason.message && 
                      event.reason.message.includes("_balanceSats is null")) {
                    event.preventDefault();
                  } else {
                    console.error("Layout promise rejection caught:", event.reason);
                  }
                });
              })();
            `
          }}
        />
      </head>
      <body className={inter.className}>
        <ClientErrorBoundary>
          <ErrorBoundary>
            <LightningProvider>
              <AudioProvider>
                <BitcoinConnectProvider>
                  <div className="min-h-screen bg-gray-50 relative">
                    {/* Content overlay with iOS safe area padding */}
                    <div className="relative z-10 pt-ios">
                      {children}
                    </div>
                  </div>
                  <GlobalNowPlayingBar />
                  <ToastContainer />
                </BitcoinConnectProvider>
              </AudioProvider>
            </LightningProvider>
          </ErrorBoundary>
          <ServiceWorkerRegistration />
          <PWAInstallPrompt />
        </ClientErrorBoundary>
      </body>
    </html>
  )
} 