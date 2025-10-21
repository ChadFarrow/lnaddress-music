const data = require('../data/parsed-feeds.json');

console.log('Albums with keysend + node recipients:');
console.log('=====================================\n');

data.feeds.forEach(feed => {
  const album = feed.parsedData?.album;
  if (!album) return;

  // Check album-level
  if (album.value?.type === 'lightning' && album.value?.method === 'keysend') {
    const nodeRecipients = album.value.recipients?.filter(r => r.type === 'node');
    if (nodeRecipients && nodeRecipients.length > 0) {
      console.log(`📀 ${album.title}`);
      console.log(`   Artist: ${album.artist}`);
      console.log(`   Recipients: ${nodeRecipients.length}`);
      nodeRecipients.forEach((r, i) => {
        console.log(`     ${i+1}. ${r.name || 'Unnamed'} - ${r.split}%`);
      });
      console.log('');
      return;
    }
  }

  // Check first track
  const track = album.tracks?.[0];
  if (track?.value?.type === 'lightning' && track.value?.method === 'keysend') {
    const nodeRecipients = track.value.recipients?.filter(r => r.type === 'node');
    if (nodeRecipients && nodeRecipients.length > 0) {
      console.log(`📀 ${album.title} (track-level)`);
      console.log(`   Artist: ${album.artist}`);
      console.log(`   Recipients: ${nodeRecipients.length}`);
      nodeRecipients.forEach((r, i) => {
        console.log(`     ${i+1}. ${r.name || 'Unnamed'} - ${r.split}%`);
      });
      console.log('');
    }
  }
});

console.log('\n\nAlbums with lnaddress (won\'t show splits):');
console.log('==========================================\n');

let lnaddressCount = 0;
data.feeds.forEach(feed => {
  const album = feed.parsedData?.album;
  if (!album) return;

  if (album.value?.method === 'lnaddress' || album.tracks?.[0]?.value?.method === 'lnaddress') {
    console.log(`📀 ${album.title}`);
    lnaddressCount++;
  }
});

console.log(`\n   Total: ${lnaddressCount}`);
