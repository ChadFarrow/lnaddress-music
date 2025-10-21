const http = require('http');

http.get('http://localhost:3000/api/albums-static-cached', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    const discoGirl = json.albums.find(a => a.title.toLowerCase().includes('disco girl'));

    if (discoGirl) {
      console.log('disco girl from API:');
      console.log('  Has value?', !!discoGirl.value);
      console.log('  Value:', JSON.stringify(discoGirl.value, null, 2));
      console.log('\n  First track has value?', !!discoGirl.tracks?.[0]?.value);
      console.log('  First track value:', JSON.stringify(discoGirl.tracks?.[0]?.value, null, 2));
    } else {
      console.log('disco girl not found in API response');
    }
  });
}).on('error', (err) => {
  console.error('Error:', err.message);
});
