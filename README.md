# ITDV-Site (DoerfelVerse)

A modern music streaming platform showcasing independent artists from the DoerfelVerse, built with Next.js and powered by RSS feeds.

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```

3. **Open your browser:**
   Navigate to `http://localhost:3000`

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run dev-setup` - Check environment configuration
- `npm run test-feeds` - Test RSS feed parsing
- `npm run auto-add-publishers` - Auto-generate publisher feeds

## Features

### Core Functionality
- **RSS Feed Parsing**: Dynamic parsing of 42 album feeds + 4 publisher feeds
- **Complete Content Coverage**: All 40 unique albums displaying (100% coverage)
- **Publisher System**: Dedicated pages for music publishers with real artwork  
- **Audio Streaming**: Full-featured audio player with playlist support
- **Content Filtering**: Albums, EPs, Singles, and Publishers views
- **Static Data Generation**: Fast loading with pre-generated content
- **Robust Caching**: Fixed RSS cache key system prevents feed collisions

### User Experience
- **Progressive Web App (PWA)**: Install on mobile devices
- **Responsive Design**: Optimized for all screen sizes
- **Dark Theme**: Elegant dark interface throughout
- **Smooth Animations**: Polished transitions and hover effects
- **Mobile-First**: Touch-friendly controls and navigation

### Technical Features
- **CDN Integration**: Optimized asset delivery via Bunny.net
- **HLS Audio Support**: Adaptive streaming for various audio formats
- **Service Worker**: Background updates and offline functionality
- **Static Site Generation**: Pre-rendered pages for optimal performance

## Architecture

- **Frontend**: Next.js 14+ with TypeScript and App Router
- **Data Source**: RSS feeds + static JSON files (no database required)
- **Styling**: Tailwind CSS with custom components
- **Audio Engine**: Custom AudioContext with HLS.js support
- **Image Processing**: Next.js Image optimization with CDN fallbacks
- **Deployment**: Vercel with automated builds

## Content Structure

### Publishers
Publishers have consolidated RSS feeds for easy subscription and include:
- **The Doerfels** - `https://www.doerfelverse.com/feeds/doerfels-pubfeed.xml`
- **CityBeach** - `https://www.doerfelverse.com/feeds/citybeach-pubfeed.xml`
- **Middle Season** - `https://www.doerfelverse.com/artists/middleseason/mspubfeed.xml`
- **Ryan Fonda** - `https://wavlake.com/feed/artist/d4c49f2e-0b50-4a5e-8101-7543d68e032f`

### Data Flow
1. RSS feeds are parsed dynamically or from static cache
2. Album and track data is extracted and normalized
3. Publisher information is matched and enriched
4. Content is served via API routes with aggressive caching

## Development

The app uses a hybrid approach:
- **Static data** for fast initial loads with 100% content coverage
- **Dynamic parsing** for real-time RSS feed updates (46 total feeds)
- **Intelligent caching** with unique cache keys to prevent feed collisions
- **Comprehensive coverage** of all albums, EPs, and singles from DoerfelVerse artists

## Recent Improvements

### RSS Cache System Fix
- **Fixed cache key collisions** that were causing multiple feeds to share the same cached data
- **Removed truncation bug** in RSS cache key generation (`lib/rss-cache.ts`)
- **Achievement: 100% album coverage** - All 40 required albums now display correctly
- **Added publisher feeds** for consolidated RSS subscriptions

### Content Coverage
- **42 individual album feeds** for main site display
- **4 publisher feeds** for RSS subscription consolidation  
- **Zero parsing errors** across all feeds
- **Complete artist representation** from The Doerfels, CityBeach, Middle Season, Ryan Fonda, and more

## Contributing

This project showcases music from independent artists in the DoerfelVerse. The platform is designed to be fast, accessible, and provide an excellent listening experience across all devices.
