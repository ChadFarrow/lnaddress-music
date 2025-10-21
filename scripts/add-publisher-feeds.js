const fs = require('fs');
const path = require('path');

const parsedDataPath = path.join(__dirname, '../data/parsed-feeds.json');
const feedsDataPath = path.join(__dirname, '../data/feeds.json');

// Load both files
const parsedData = JSON.parse(fs.readFileSync(parsedDataPath, 'utf8'));
const feedsData = JSON.parse(fs.readFileSync(feedsDataPath, 'utf8'));

// Extract all unique publishers from parsed album feeds
const publishers = new Map();

parsedData.feeds.forEach(feed => {
  const publisher = feed.parsedData?.album?.publisher;
  if (publisher && publisher.feedGuid && publisher.feedUrl) {
    if (!publishers.has(publisher.feedGuid)) {
      // Get artist name from the first album that references this publisher
      const artistName = feed.parsedData?.album?.artist || 'Unknown Artist';
      publishers.set(publisher.feedGuid, {
        feedGuid: publisher.feedGuid,
        feedUrl: publisher.feedUrl,
        artistName: artistName,
        albumCount: 0
      });
    }
    publishers.get(publisher.feedGuid).albumCount++;
  }
});

console.log(`Found ${publishers.size} unique publisher feeds`);
console.log('');

// Check which publishers are already in the feeds.json file
const existingPublisherIds = new Set(
  feedsData.feeds
    .filter(f => f.type === 'publisher')
    .map(f => f.id)
);

// Create new publisher feed entries
const newFeeds = [];
let addedCount = 0;

publishers.forEach((pub, guid) => {
  // Create a unique ID from the feed URL
  const urlPart = pub.feedUrl.split('/').pop() || guid.substring(0, 8);
  const feedId = `publisher-${urlPart}`;

  // Check if this publisher is already in the list
  if (existingPublisherIds.has(feedId)) {
    console.log(`Skipping ${feedId} - already exists`);
    return;
  }

  const newFeed = {
    id: feedId,
    originalUrl: pub.feedUrl,
    type: 'publisher',
    title: `${pub.artistName} Publisher Feed`,
    priority: 'standard',
    status: 'active',
    addedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    source: 'auto-discovered',
    parseStatus: 'pending',
    metadata: {
      publisherGuid: guid,
      albumCount: pub.albumCount
    }
  };

  newFeeds.push(newFeed);
  console.log(`Adding: ${newFeed.title} (${pub.albumCount} albums)`);
  addedCount++;
});

if (newFeeds.length > 0) {
  // Add new feeds to feeds.json
  feedsData.feeds.push(...newFeeds);
  feedsData.lastUpdated = new Date().toISOString();

  // Write back to feeds.json
  fs.writeFileSync(feedsDataPath, JSON.stringify(feedsData, null, 2));

  console.log('');
  console.log(`✅ Added ${addedCount} new publisher feeds to feeds.json`);
  console.log(`Total feeds now: ${feedsData.feeds.length}`);
} else {
  console.log('');
  console.log('No new publisher feeds to add');
}
