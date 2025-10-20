#!/usr/bin/env node

/**
 * Parse all RSS feeds and save to parsed-feeds.json
 * This pre-parses feeds so the site doesn't have to parse them on each visit
 */

const { FeedParser } = require('../lib/feed-parser');

async function main() {
  console.log('🚀 Starting to parse all RSS feeds...\n');

  try {
    const report = await FeedParser.parseAllFeeds();

    console.log('\n✅ Feed parsing complete!\n');
    console.log('📊 Parse Report:');
    console.log(`   Total Feeds: ${report.totalFeeds}`);
    console.log(`   ✅ Successful: ${report.successfulParses}`);
    console.log(`   ❌ Failed: ${report.failedParses}`);
    console.log(`   🎵 Albums Found: ${report.albumsFound}`);
    console.log(`   📚 Publishers Found: ${report.publishersFound}`);
    console.log(`   🎶 Total Tracks: ${report.totalTracks}`);
    console.log(`   ⏱️  Total Duration: ${report.totalDuration}`);
    console.log(`   🔗 Feeds with PodRoll: ${report.podRollFeeds}`);
    console.log(`   💰 Feeds with Funding: ${report.fundingFeeds}`);
    console.log(`   ⌛ Parse Time: ${(report.parseTime / 1000).toFixed(2)}s\n`);

    if (report.errors.length > 0) {
      console.log('⚠️  Errors encountered:');
      report.errors.forEach(err => {
        console.log(`   - ${err.feedId}: ${err.error}`);
      });
      console.log('');
    }

    console.log('📁 Parsed data saved to: data/parsed-feeds.json');
    console.log('🎉 Your site will now load much faster!\n');

    process.exit(report.failedParses > 0 ? 1 : 0);

  } catch (error) {
    console.error('❌ Failed to parse feeds:', error);
    process.exit(1);
  }
}

main();
