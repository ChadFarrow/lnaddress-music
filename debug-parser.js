const { DOMParser } = require('@xmldom/xmldom');

async function testMiddleSeasonParsing() {
  console.log('🔍 Testing Middle Season RSS parser...');
  
  // Fetch the Middle Season Inside Out feed
  const feedUrl = 'https://www.doerfelverse.com/artists/middleseason/inside-out.xml';
  
  try {
    const response = await fetch(feedUrl);
    const xmlContent = await response.text();
    
    console.log('📥 Fetched RSS feed successfully');
    
    // Parse XML
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlContent, 'application/xml');
    
    const channels = Array.from(doc.getElementsByTagName('channel'));
    if (channels.length === 0) {
      console.log('❌ No channel found');
      return;
    }
    
    const channel = channels[0];
    console.log('✅ Found channel element');
    
    // Test publisher parsing logic (same as in rss-parser.ts)
    console.log('🔍 Looking for podcast:publisher elements...');
    
    // Look for podcast:publisher element first (Podcasting 2.0 spec)
    const publisherElements = Array.from(channel.getElementsByTagName('podcast:publisher'));
    console.log(`Found ${publisherElements.length} podcast:publisher elements`);
    
    if (publisherElements.length > 0) {
      console.log('✅ Found podcast:publisher element');
      const publisherElement = publisherElements[0];
      
      // According to spec, podcast:publisher must contain exactly one podcast:remoteItem with medium="publisher"
      const remoteItem = publisherElement.getElementsByTagName('podcast:remoteItem')[0];
      console.log('Remote item found:', !!remoteItem);
      
      if (remoteItem) {
        console.log('Checking medium attribute:', remoteItem.getAttribute('medium'));
        
        if (remoteItem.getAttribute('medium') === 'publisher') {
          const feedGuid = remoteItem.getAttribute('feedGuid');
          const feedUrl = remoteItem.getAttribute('feedUrl');
          const medium = remoteItem.getAttribute('medium');
          
          console.log('✅ Publisher data extracted:');
          console.log('   Feed GUID:', feedGuid);
          console.log('   Feed URL:', feedUrl);
          console.log('   Medium:', medium);
          
          if (feedGuid && feedUrl && medium) {
            const publisher = {
              feedGuid,
              feedUrl,
              medium
            };
            console.log('✅ Publisher object created successfully:', publisher);
            return publisher;
          } else {
            console.log('❌ Missing required publisher attributes');
          }
        } else {
          console.log('❌ Remote item medium is not "publisher"');
        }
      } else {
        console.log('❌ No podcast:remoteItem found in publisher element');
      }
    } else {
      console.log('⚠️ No podcast:publisher element found, checking fallback...');
      
      // Fallback: Look for standalone podcast:remoteItem with medium="publisher"
      const remoteItems = Array.from(channel.getElementsByTagName('podcast:remoteItem'));
      console.log(`Found ${remoteItems.length} total podcast:remoteItem elements`);
      
      const publisherRemoteItem = remoteItems.find((item) => {
        return item.getAttribute('medium') === 'publisher';
      });
      
      if (publisherRemoteItem) {
        console.log('✅ Found standalone publisher remoteItem');
        const feedGuid = publisherRemoteItem.getAttribute('feedGuid');
        const feedUrl = publisherRemoteItem.getAttribute('feedUrl');
        const medium = publisherRemoteItem.getAttribute('medium');
        
        if (feedGuid && feedUrl && medium) {
          const publisher = {
            feedGuid,
            feedUrl,
            medium
          };
          console.log('✅ Publisher data extracted via fallback:', publisher);
          return publisher;
        }
      } else {
        console.log('❌ No publisher data found via fallback');
      }
    }
    
    console.log('❌ Failed to extract publisher data');
    return null;
    
  } catch (error) {
    console.error('❌ Error testing parser:', error);
    return null;
  }
}

// Test with current Node.js environment
async function main() {
  try {
    // Check if we have fetch available
    if (typeof fetch === 'undefined') {
      console.log('Installing node-fetch...');
      global.fetch = (await import('node-fetch')).default;
    }
    
    const result = await testMiddleSeasonParsing();
    
    if (result) {
      console.log('🎉 SUCCESS: Publisher parsing works!');
    } else {
      console.log('💥 FAILED: Publisher parsing failed');
    }
    
  } catch (error) {
    console.error('Error in main:', error);
  }
}

main();