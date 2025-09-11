#!/usr/bin/env node

// Simple Node.js script to query Nostr relays for boost events
const WebSocket = require('ws');

const RELAYS = [
  'wss://relay.nostr.band',
  'wss://relay.damus.io', 
  'wss://chadf.nostr1.com'  // The relay we added
];

// Pubkey from the boost event you shared
const PUBKEY = 'b46bf00320e95f9568a85baa3a0a377dd19948b79a4ff0db7854840a2fea1f0e';

async function queryRelay(relayUrl) {
  return new Promise((resolve) => {
    console.log(`\n🔍 Connecting to ${relayUrl}...`);
    
    const ws = new WebSocket(relayUrl);
    const events = [];
    let timeout;
    
    ws.on('open', () => {
      console.log(`✅ Connected to ${relayUrl}`);
      
      // Query for recent events (kind 1 = text notes) from this pubkey
      const req = ["REQ", "boost_check", {
        "authors": [PUBKEY],
        "kinds": [1],
        "limit": 5
      }];
      
      ws.send(JSON.stringify(req));
      
      // Set timeout to close connection after 3 seconds
      timeout = setTimeout(() => {
        ws.close();
      }, 3000);
    });
    
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        
        if (msg[0] === 'EVENT') {
          const event = msg[2];
          events.push(event);
          
          console.log(`\n📨 Event ID: ${event.id}`);
          console.log(`📅 Created: ${new Date(event.created_at * 1000).toISOString()}`);
          console.log(`📝 Content: ${event.content.substring(0, 100)}...`);
          console.log(`🏷️  Tags: ${JSON.stringify(event.tags)}`);
          
          // Look for GUID-related tags
          const guidTags = event.tags.filter(tag => 
            tag[0] === 'i' || tag[0] === 'k' || 
            (tag[0] === 'podcast' && (tag[1] === 'guid' || tag[1] === 'feedGuid'))
          );
          
          if (guidTags.length > 0) {
            console.log(`🎯 GUID Tags Found: ${JSON.stringify(guidTags)}`);
          } else {
            console.log(`❌ No GUID tags found`);
          }
        } else if (msg[0] === 'EOSE') {
          console.log(`✅ End of stream for ${relayUrl}`);
          clearTimeout(timeout);
          ws.close();
        }
      } catch (error) {
        console.error(`Error parsing message:`, error);
      }
    });
    
    ws.on('close', () => {
      console.log(`🔌 Disconnected from ${relayUrl}`);
      resolve(events);
    });
    
    ws.on('error', (error) => {
      console.error(`❌ Error with ${relayUrl}:`, error.message);
      clearTimeout(timeout);
      resolve([]);
    });
  });
}

async function main() {
  console.log(`🚀 Querying Nostr relays for boost events from pubkey: ${PUBKEY}`);
  
  for (const relay of RELAYS) {
    await queryRelay(relay);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s between relays
  }
  
  console.log('\n✨ Done checking relays!');
}

main().catch(console.error);