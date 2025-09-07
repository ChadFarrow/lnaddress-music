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
- `./scripts/update-static-data.sh` - Update static album cache

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

- **Frontend**: Next.js 15.4.3 with TypeScript and App Router
- **Data Source**: 46 RSS feeds + static JSON files (no database required)
- **Styling**: Tailwind CSS with custom components and dark theme
- **Audio Engine**: Custom AudioContext with HLS.js support and playlist management
- **Image Processing**: Next.js Image optimization with CDN fallbacks
- **Caching System**: Robust RSS cache with unique base64 keys per feed
- **PWA Support**: Service worker with offline functionality
- **Payment Integration**: Bitcoin Lightning payments via Bitcoin Connect
- **Deployment**: Vercel with automated builds and edge deployment

## Content Structure

### Publishers
Publishers have consolidated RSS feeds for easy subscription and include:
- **The Doerfels** - `https://www.doerfelverse.com/feeds/doerfels-pubfeed.xml`
- **CityBeach** - `https://www.doerfelverse.com/feeds/citybeach-pubfeed.xml`
- **Middle Season** - `https://www.doerfelverse.com/artists/middleseason/mspubfeed.xml`
- **Ryan Fonda** - `https://wavlake.com/feed/artist/d4c49f2e-0b50-4a5e-8101-7543d68e032f`

### Content Statistics  
- **40 unique albums/EPs/singles** from independent DoerfelVerse artists
- **42 individual album feeds** for granular content access
- **4 consolidated publisher feeds** for easy RSS subscription  
- **Artists featured**: The Doerfels, CityBeach, Middle Season, Ryan Fonda, Kurtisdrums, Sir TJ The Wrathful, Generation Gap, Jdog, Ben Doerfel
- **Genres**: Rock, Bluegrass, Indie, Experimental, Electronic
- **Content model**: Value for Value (free music with optional Lightning payments)

### Data Flow
1. **RSS Feed Parsing**: 46 feeds parsed with individual caching per URL
2. **Content Normalization**: Album and track data extracted and standardized
3. **Static Generation**: Pre-built JSON files for optimal loading performance
4. **API Distribution**: Content served via optimized API routes
5. **Real-time Updates**: Dynamic parsing ensures content freshness
6. **Error Handling**: Comprehensive retry logic and graceful fallbacks

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

## API Endpoints

### Album Data
- `GET /api/albums-static-cached` - Cached album data (fast)
- `GET /api/albums-no-db` - Fresh album data (dynamic parsing)
- `GET /api/albums-static` - Static pre-generated album data

### Feed Management
- **RSS Cache Location**: `/data/rss-cache/`
- **Feed Configuration**: `/data/feeds.json` (46 feeds total)
- **Static Data**: `/data/static/albums.json`

## Troubleshooting

### Missing Albums
If albums are not displaying:
1. Check RSS cache: `ls -la data/rss-cache/`
2. Clear cache: `rm -rf data/rss-cache/*`
3. Test feeds: `npm run test-feeds`
4. Update static data: `./scripts/update-static-data.sh`

### RSS Feed Issues
- **Cache collisions**: Fixed in `lib/rss-cache.ts` - cache keys use full base64 encoding
- **Rate limiting**: Built-in retry logic with exponential backoff
- **Invalid feeds**: Comprehensive error handling and logging

### Performance
- **Slow loading**: Check CDN configuration and static generation
- **Audio issues**: Verify HLS.js and AudioContext browser support
- **Cache problems**: Clear browser cache and RSS cache directory

## Contributing

This project showcases music from independent artists in the DoerfelVerse. The platform is designed to be fast, accessible, and provide an excellent listening experience across all devices.

### Adding New Content
1. Add RSS feed URL to `/data/feeds.json`
2. Test feed parsing with `npm run test-feeds`
3. Update static data with `./scripts/update-static-data.sh`
4. Verify content appears at `http://localhost:3000`
