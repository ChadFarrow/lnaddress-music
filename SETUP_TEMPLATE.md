# HPM-Lightning Setup Template

Configure the platform for your band/artist by replacing all `[PLACEHOLDER]` values with your actual information.

## Quick Setup Checklist

### 1. Environment Configuration (.env.local)
✅ Created with placeholders - Edit the file and replace:
- `[YOUR_BAND_NAME]` - Your band/artist name
- `[your-band-slug]` - URL-friendly version (lowercase, hyphens)
- `[YOUR_LIGHTNING_ADDRESS]` - Lightning address from your RSS feed's value tags

### 2. RSS Feeds (data/feeds.json)
✅ Created with template structure - Replace:
- `[YOUR_RSS_FEED_URL_X]` - Your existing RSS feed URLs
- `[ALBUM_TITLE_X]` - Your album/EP titles
- `[feed-id-X]` - Unique identifiers for each feed

### 3. Required Information

**Essential (must have):**
- [ ] Band/Artist Name
- [ ] Existing RSS feed URLs with Podcasting 2.0 value tags (includes Lightning payment info)

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

## RSS Feed Requirements

Your RSS feeds must include:
- Podcasting 2.0 `<podcast:value>` tags
- Lightning payment splits configuration
- Valid audio enclosures

Common sources that support this:
- **Wavlake:** `https://wavlake.com/feed/artist/[ARTIST_ID]`
- **RSS.com:** With value tags enabled
- **Self-hosted:** RSS with proper value tags