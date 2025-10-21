#!/usr/bin/env ts-node

/**
 * Direct TypeScript feed parser for build time
 */

import { FeedParser } from '../lib/feed-parser';

async function main() {
  console.log('🚀 Starting to parse all RSS feeds...\\n');

  try {
    const report = await FeedParser.parseAllFeeds();

    console.log('\\n✅ Feed parsing complete!\\n');
    console.log('📊 Parse Report:');
    console.log(`   Total Feeds: ${report.totalFeeds}`);
    console.log(`   ✅ Successful: ${report.successfulParses}`);
    console.log(`   ❌ Failed: ${report.failedParses}`);
    console.log(`   🎵 Albums Found: ${report.albumsFound}`);
    console.log(`   📚 Publishers Found: ${report.publishersFound}`);
    console.log(`   🎶 Total Tracks: ${report.totalTracks}`);
    console.log(`   ⏱️  Parse Time: ${(report.parseTime / 1000).toFixed(2)}s\\n`);

    if (report.errors.length > 0) {
      console.log('⚠️  Errors encountered:');
      report.errors.forEach(err => {
        console.log(`   - ${err.feedId}: ${err.error}`);
      });
      console.log('');
    }

    console.log('📁 Parsed data saved to: data/parsed-feeds.json');
    console.log('🎉 Ready for static build!\\n');

    process.exit(report.failedParses > 0 ? 1 : 0);

  } catch (error) {
    console.error('❌ Failed to parse feeds:', error);
    process.exit(1);
  }
}

main();
