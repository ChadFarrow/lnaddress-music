# HPM-Lightning Setup Template

This template helps you configure the platform for your band/artist. Replace all `[PLACEHOLDER]` values with your actual information.

## Quick Setup Checklist

### 1. Environment Configuration (.env.local)
✅ Created with placeholders - Edit the file and replace:
- `[YOUR_BAND_NAME]` - Your band/artist name
- `[your-band-slug]` - URL-friendly version (lowercase, hyphens)
- `[YOUR_LIGHTNING_ADDRESS]` - Your Lightning wallet address

### 2. RSS Feeds (data/feeds.json)
✅ Created with template structure - Replace:
- `[YOUR_RSS_FEED_URL_X]` - Your actual RSS feed URLs
- `[ALBUM_TITLE_X]` - Your album/EP titles
- `[feed-id-X]` - Unique identifiers for each feed

### 3. Required Information

**Essential (must have):**
- [ ] Band/Artist Name
- [ ] Lightning Address (e.g., yourname@getalby.com)
- [ ] At least one RSS feed URL

**RSS Feed Options:**
- **Wavlake:** `https://wavlake.com/feed/artist/YOUR_ARTIST_ID`
- **Self-hosted:** Upload XML files to your server
- **Podcast hosts:** Most provide RSS feeds automatically
- **GitHub:** Host XML files in a public repo

### 4. Commands to Run

After filling in your information:

```bash
# Clear any cached RSS data
rm -rf data/rss-cache/*

# Install dependencies (if not done)
npm install

# Start the development server
npm run dev
```

Visit http://localhost:3000 to see your platform!

### 5. Testing Checklist

- [ ] Platform loads without errors
- [ ] Your band name appears correctly
- [ ] Albums/tracks display from RSS feeds
- [ ] Audio player works
- [ ] Boost modal opens when clicking boost button
- [ ] Lightning address is correct in boost modal

### 6. Restore Original Doerfel Configuration

If you need to restore the original setup:

```bash
# Restore original feeds
cp data/feeds.json.doerfel-backup data/feeds.json

# Remove your custom config
rm .env.local

# Clear cache
rm -rf data/rss-cache/*
```

## Example Values

If you're testing and need example values:

**.env.local:**
```env
NEXT_PUBLIC_BAND_NAME="Hash Power Music"
NEXT_PUBLIC_BAND_SLUG="hash-power-music"
NEXT_PUBLIC_METADATA_FEE_ADDRESS="hashpower@getalby.com"
```

**feeds.json:**
```json
{
  "id": "test-album-1",
  "originalUrl": "https://wavlake.com/feed/music/abc123",
  "type": "album",
  "title": "Test Album",
  ...
}
```

## Need Help?

- Lightning wallet: https://getalby.com
- RSS feed validator: https://validator.w3.org/feed/
- Podcasting 2.0 spec: https://github.com/Podcastindex-org/podcast-namespace