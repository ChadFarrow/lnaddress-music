const data = require('../data/parsed-feeds.json');

const discoGirl = data.feeds.find(f =>
  f.parsedData?.album?.title?.toLowerCase().includes('disco girl')
);

if (discoGirl) {
  const album = discoGirl.parsedData.album;
  console.log('Album:', album.title);
  console.log('Has value?', !!album.value);
  console.log('Value type:', album.value?.type);
  console.log('Value method:', album.value?.method);
  console.log('Recipients:', album.value?.recipients?.length || 0);

  if (album.value?.recipients) {
    console.log('\nRecipients:');
    album.value.recipients.forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.name || 'Unnamed'} - ${r.split}% (${r.type})`);
    });
  }

  // Check first track
  if (album.tracks?.[0]?.value) {
    console.log('\nFirst track has value:', !!album.tracks[0].value);
    console.log('Track recipients:', album.tracks[0].value.recipients?.length || 0);
  }
} else {
  console.log('disco girl not found');
}
