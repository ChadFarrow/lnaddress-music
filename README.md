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
- **RSS Feed Parsing**: Dynamic parsing of music album feeds
- **Publisher System**: Dedicated pages for music publishers with real artwork
- **Audio Streaming**: Full-featured audio player with playlist support
- **Content Filtering**: Albums, EPs, Singles, and Publishers views
- **Static Data Generation**: Fast loading with pre-generated content

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
Publishers are defined in `/public/publishers.json` and include:
- The Doerfels
- CityBeach  
- Middle Season
- Ryan Fonda

### Data Flow
1. RSS feeds are parsed dynamically or from static cache
2. Album and track data is extracted and normalized
3. Publisher information is matched and enriched
4. Content is served via API routes with aggressive caching

## Development

The app uses a hybrid approach:
- **Static data** for fast initial loads (`/public/publishers.json`)
- **Dynamic parsing** for real-time RSS feed updates
- **Intelligent caching** to balance performance and freshness

## Contributing

This project showcases music from independent artists in the DoerfelVerse. The platform is designed to be fast, accessible, and provide an excellent listening experience across all devices.
