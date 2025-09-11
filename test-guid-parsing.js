#!/usr/bin/env node

// Test GUID parsing implementation
const { RSSParser } = require('./lib/rss-parser.ts');

async function testGuidParsing() {
  console.log('🧪 Testing GUID parsing for Kurtisdrums feed...');
  
  try {
    const album = await RSSParser.parseAlbumFeed('https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/Kurtisdrums-V1.xml');
    
    console.log('\n📊 Album-level data:');
    console.log(`Feed GUID: ${album.feedGuid || 'NOT FOUND'}`);
    console.log(`Publisher GUID: ${album.publisherGuid || 'NOT FOUND'}`);
    
    console.log('\n🎵 Track-level GUID data:');
    if (album.tracks && album.tracks.length > 0) {
      const callMeMedley = album.tracks.find(track => track.title === 'Call Me Medley');
      if (callMeMedley) {
        console.log('\n📻 Call Me Medley track:');
        console.log(`  Item GUID: ${callMeMedley.guid || 'NOT FOUND'}`);
        console.log(`  Podcast GUID: ${callMeMedley.podcastGuid || 'NOT FOUND'}`);
        console.log(`  Feed GUID: ${callMeMedley.feedGuid || 'NOT FOUND'}`);
        console.log(`  Publisher GUID: ${callMeMedley.publisherGuid || 'NOT FOUND'}`);
      } else {
        console.log('❌ Call Me Medley track not found');
      }
      
      // Show first track as example
      const firstTrack = album.tracks[0];
      console.log(`\n📻 First track (${firstTrack.title}):`);
      console.log(`  Item GUID: ${firstTrack.guid || 'NOT FOUND'}`);
      console.log(`  Podcast GUID: ${firstTrack.podcastGuid || 'NOT FOUND'}`);
      console.log(`  Feed GUID: ${firstTrack.feedGuid || 'NOT FOUND'}`);
      console.log(`  Publisher GUID: ${firstTrack.publisherGuid || 'NOT FOUND'}`);
    }
    
    console.log(`\n✅ Test completed - found ${album.tracks?.length || 0} tracks`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testGuidParsing();