const fs = require('fs');
const path = require('path');

const parsedDataPath = path.join(__dirname, '../data/parsed-feeds.json');
const feedsDataPath = path.join(__dirname, '../data/feeds.json');

// Load both files
const parsedData = JSON.parse(fs.readFileSync(parsedDataPath, 'utf8'));
const feedsData = JSON.parse(fs.readFileSync(feedsDataPath, 'utf8'));

// Get all publisher feeds
const publishers = parsedData.feeds.filter(f => f.type === 'publisher' && f.parseStatus === 'success');

console.log(`Found ${publishers.length} successfully parsed publisher feeds`);
console.log('');

// Collect all publisher items
const allItems = [];
publishers.forEach(pub => {
  const items = pub.parsedData?.publisherItems || [];
  const publisherInfo = pub.parsedData?.publisherInfo;

  items.forEach(item => {
    allItems.push({
      ...item,
      publisherName: publisherInfo?.artist || publisherInfo?.title || 'Unknown',
      publisherFeedUrl: pub.originalUrl,
      publisherGuid: pub.metadata?.publisherGuid
    });
  });
});

console.log(`Total items from all publishers: ${allItems.length}`);
console.log('');

// Check which items are already in feeds.json
const existingFeedUrls = new Set(feedsData.feeds.map(f => f.originalUrl));
const newFeeds = [];
let addedCount = 0;
let skippedCount = 0;

allItems.forEach(item => {
  if (existingFeedUrls.has(item.feedUrl)) {
    skippedCount++;
    return;
  }

  // Create a unique ID from the feed URL
  const urlPart = item.feedUrl.split('/').pop() || item.feedGuid?.substring(0, 8) || Math.random().toString(36).substring(7);
  const feedId = `publisher-item-${urlPart}`;

  const newFeed = {
    id: feedId,
    originalUrl: item.feedUrl,
    type: 'album',
    title: item.title || `${item.publisherName} Album`,
    priority: 'extended',
    status: 'active',
    addedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    source: 'publisher-discovery',
    parseStatus: 'pending',
    metadata: {
      discoveredFrom: 'publisher',
      publisherName: item.publisherName,
      publisherFeedUrl: item.publisherFeedUrl,
      publisherGuid: item.publisherGuid,
      itemGuid: item.feedGuid
    }
  };

  newFeeds.push(newFeed);
  console.log(`Adding: ${item.title || 'Untitled'} from ${item.publisherName}`);
  addedCount++;
  existingFeedUrls.add(item.feedUrl); // Prevent duplicates in this run
});

console.log('');
console.log(`Skipped ${skippedCount} items (already in feeds)`);
console.log('');

if (newFeeds.length > 0) {
  // Add new feeds to feeds.json
  feedsData.feeds.push(...newFeeds);
  feedsData.lastUpdated = new Date().toISOString();

  // Write back to feeds.json
  fs.writeFileSync(feedsDataPath, JSON.stringify(feedsData, null, 2));

  console.log(`✅ Added ${addedCount} new album feeds from publishers to feeds.json`);
  console.log(`Total feeds now: ${feedsData.feeds.length}`);
} else {
  console.log('No new feeds to add (all items already exist)');
}
