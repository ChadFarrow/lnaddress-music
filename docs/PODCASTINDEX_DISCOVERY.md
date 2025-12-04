# PodcastIndex Feed Discovery

This guide explains how to use the PodcastIndex API to discover and add music feeds from platforms like [Fountain.fm](https://fountain.fm).

## Overview

The app now supports discovering music feeds using the [PodcastIndex API](https://podcastindex.org/api). This allows you to:
- Search for music feeds from specific platforms
- Automatically discover feeds with `medium=music`
- Import discovered feeds into your `data/feeds.json`

## Setup

### 1. Get PodcastIndex API Credentials

1. Visit [https://podcastindex.org/api](https://podcastindex.org/api)
2. Register for a free account
3. Get your API key and secret

### 2. Add Credentials to Environment

Add these to your `.env.local` file:

```bash
PODCAST_INDEX_API_KEY=your-api-key
PODCAST_INDEX_API_SECRET=your-api-secret
```

### 3. Restart Your Development Server

```bash
npm run dev
```

## Usage

### Method 1: API Endpoint (Recommended)

Call the discovery endpoint to find Fountain.fm music feeds:

```bash
curl http://localhost:3000/api/discover/fountain-music?max=50
```

Response:
```json
{
  "success": true,
  "total": 50,
  "feeds": [
    {
      "id": 123456,
      "title": "Flood Gates",
      "artist": "Justin Lantrip",
      "url": "https://feeds.fountain.fm/Pw6d3L9h2Itp3KxLpF3a",
      "image": "https://...",
      "feedConfig": {
        "id": "Pw6d3L9h2Itp3KxLpF3a",
        "originalUrl": "https://feeds.fountain.fm/Pw6d3L9h2Itp3KxLpF3a",
        "type": "album",
        "title": "Flood Gates",
        "priority": "extended",
        "status": "active",
        "source": "podcastindex"
      }
    }
  ]
}
```

### Method 2: TypeScript Script

Run the discovery script:

```bash
npx ts-node scripts/search-fountain-music.ts
```

Or with custom max results:

```bash
npx ts-node scripts/search-fountain-music.ts --max 100
```

### Method 3: Generic Search API

Search for any term with additional filters:

```bash
# Search by platform
curl "http://localhost:3000/api/podcastindex/search?platform=fountain.fm&medium=music&max=20"

# Search by query
curl "http://localhost:3000/api/podcastindex/search?q=fountain.fm%20music&max=20"
```

## Adding Discovered Feeds

### Option 1: Manual Addition

1. Use the discovery endpoint to get feeds
2. Copy the `feedConfig` objects from the response
3. Add them to `data/feeds.json`:

```json
{
  "feeds": [
    {
      "id": "Pw6d3L9h2Itp3KxLpF3a",
      "originalUrl": "https://feeds.fountain.fm/Pw6d3L9h2Itp3KxLpF3a",
      "type": "album",
      "title": "Flood Gates",
      "priority": "extended",
      "status": "active",
      "source": "podcastindex"
    }
  ]
}
```

4. Rebuild static data:
```bash
npm run update-static-data
```

### Option 2: Via Admin API

Add feeds programmatically:

```bash
curl -X POST http://localhost:3000/api/admin/feeds \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://feeds.fountain.fm/Pw6d3L9h2Itp3KxLpF3a",
    "type": "album",
    "discoverPodroll": true
  }'
```

## API Endpoints

### Discover Fountain.fm Music

```
GET /api/discover/fountain-music?max=20
```

Returns fountain.fm music feeds with feed configuration ready to add.

### Generic PodcastIndex Search

```
GET /api/podcastindex/search
```

Parameters:
- `q` or `query`: Search term
- `platform`: Filter by platform (e.g., "fountain.fm")
- `medium`: Filter by medium (e.g., "music")
- `max`: Maximum results (default: 20)

### Feed via PodcastIndex

```
GET /api/podcastindex?feedUrl=<url>&endpoint=episodes/byfeedurl
```

Fetches feed data from PodcastIndex (with RSS XML conversion).

## Example: Finding Music Feeds

### Example 1: Discover Fountain.fm Music

```typescript
// Using the discovery API
const response = await fetch('/api/discover/fountain-music?max=50');
const data = await response.json();

// Get the feed configs ready to add
const feedConfigs = data.feeds.map(feed => feed.feedConfig);

// Add to feeds.json
console.log(feedConfigs);
```

### Example 2: Search by Artist Name

```typescript
// Search for "Justin Lantrip" on fountain.fm
const response = await fetch(
  '/api/podcastindex/search?q=Justin%20Lantrip&platform=fountain.fm&max=10'
);
const data = await response.json();
```

## Fountain.fm Feed Structure

Fountain.fm feeds follow the Podcasting 2.0 spec with `medium=music`. Example:

```
https://feeds.fountain.fm/<feed-id>
```

Key features:
- RSS 2.0 compatible
- Podcasting 2.0 namespaces
- Lightning value tags
- Track-level metadata
- Podroll support

## Troubleshooting

### API Credentials Not Working

1. Verify credentials in `.env.local`
2. Check that `PODCAST_INDEX_API_KEY` and `PODCAST_INDEX_API_SECRET` are set
3. Restart the development server

### No Results Found

- Try increasing the `max` parameter
- Check search terms are spelled correctly
- Verify the platform exists in PodcastIndex database

### Feeds Not Parsing

- Some feeds may not be in PodcastIndex database
- The app falls back to direct RSS fetching
- Check feed URL is accessible

## PodcastIndex API Reference

Full API documentation: [https://podcastindex.org/api/docs](https://podcastindex.org/api/docs)

Key endpoints used:
- `search/byterm`: Search feeds by term
- `episodes/byfeedurl`: Get episodes by feed URL
- `feeds/byterm`: Get feeds by search term

## See Also

- [Feed Management](docs/PUBLISHER_FEED_MANAGEMENT.md)
- [README](../README.md)

