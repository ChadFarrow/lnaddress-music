const http = require('http');

http.get('http://localhost:3000/api/album/disco-girl', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    console.log('Album:', json.album?.title);
    console.log('Has value?', !!json.album?.value);
    console.log('Value recipients:', json.album?.value?.recipients?.length || 0);

    if (json.album?.value?.recipients) {
      console.log('\nRecipients:');
      json.album.value.recipients.forEach((r, i) => {
        console.log(`  ${i+1}. ${r.name || 'Recipient'} - ${r.split}%`);
      });
    }
  });
}).on('error', (err) => {
  console.error('Error:', err.message);
});
