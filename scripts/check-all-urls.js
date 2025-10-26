const fs = require('fs');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const data = JSON.parse(fs.readFileSync('data/parsed-feeds.json', 'utf8'));

async function checkUrl(url) {
  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(url);
      const client = parsedUrl.protocol === 'https:' ? https : http;

      const req = client.request(url, { method: 'HEAD' }, (res) => {
        resolve({
          status: res.statusCode,
          ok: res.statusCode >= 200 && res.statusCode < 300
        });
      });

      req.on('error', (err) => {
        resolve({ status: 'ERROR', ok: false, error: err.message });
      });

      req.setTimeout(5000, () => {
        req.destroy();
        resolve({ status: 'TIMEOUT', ok: false });
      });

      req.end();
    } catch (err) {
      resolve({ status: 'INVALID_URL', ok: false, error: err.message });
    }
  });
}

async function checkAllFeeds() {
  console.log('Checking all album track URLs...\n');

  let totalTracks = 0;
  let brokenTracks = 0;
  const brokenUrls = [];

  for (const feed of data.feeds || []) {
    if (feed.parsedData && feed.parsedData.album && feed.parsedData.album.tracks) {
      const album = feed.parsedData.album;
      console.log(`\nChecking: ${album.title} by ${album.artist || 'Unknown'}`);
      console.log(`Tracks: ${album.tracks.length}`);

      for (const track of album.tracks) {
        totalTracks++;
        const result = await checkUrl(track.url);

        if (!result.ok) {
          brokenTracks++;
          brokenUrls.push({
            album: album.title,
            track: track.title,
            url: track.url,
            status: result.status,
            error: result.error
          });
          console.log(`  ❌ ${track.trackNumber}. ${track.title} - ${result.status}`);
        } else {
          console.log(`  ✅ ${track.trackNumber}. ${track.title}`);
        }
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\nSummary:`);
  console.log(`Total tracks checked: ${totalTracks}`);
  console.log(`Working tracks: ${totalTracks - brokenTracks}`);
  console.log(`Broken tracks: ${brokenTracks}`);

  if (brokenUrls.length > 0) {
    console.log('\n' + '='.repeat(60));
    console.log('\nBroken URLs:');
    brokenUrls.forEach((item, i) => {
      console.log(`\n${i + 1}. ${item.album} - ${item.track}`);
      console.log(`   Status: ${item.status}`);
      console.log(`   URL: ${item.url}`);
      if (item.error) console.log(`   Error: ${item.error}`);
    });
  }
}

checkAllFeeds();
