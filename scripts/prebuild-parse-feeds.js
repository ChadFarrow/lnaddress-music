#!/usr/bin/env node

/**
 * Pre-build script to parse all RSS feeds
 * Uses the compiled TypeScript from Next.js
 */

const { spawn } = require('child_process');
const path = require('path');

async function prebuildParse() {
  console.log('🚀 Pre-build: Parsing RSS feeds...\n');

  // Start a temporary Next.js server
  const serverProcess = spawn('npm', ['run', 'dev'], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let serverReady = false;

  // Wait for server to be ready
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      serverProcess.kill();
      reject(new Error('Server startup timeout'));
    }, 60000);

    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Ready') || output.includes('started server') || output.includes('Local:')) {
        serverReady = true;
        clearTimeout(timeout);
        resolve();
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error('Server error:', data.toString());
    });
  });

  if (!serverReady) {
    console.error('❌ Failed to start development server');
    process.exit(1);
  }

  console.log('✅ Dev server started, parsing feeds...\n');

  // Wait a bit more for the server to fully initialize
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Make request to parse feeds
  try {
    const fetch = require('node-fetch');
    const response = await fetch('http://localhost:3000/api/parse-feeds');
    const data = await response.json();

    if (data.success) {
      console.log('\n✅ Feed parsing complete!\n');
      console.log('📊 Parse Report:');
      console.log(`   Total Feeds: ${data.report.totalFeeds}`);
      console.log(`   ✅ Successful: ${data.report.successfulParses}`);
      console.log(`   ❌ Failed: ${data.report.failedParses}`);
      console.log(`   🎵 Albums Found: ${data.report.albumsFound}`);
      console.log(`   📚 Publishers Found: ${data.report.publishersFound}`);
      console.log(`   🎶 Total Tracks: ${data.report.totalTracks}`);
      console.log(`   ⏱️  Parse Time: ${(data.report.parseTime / 1000).toFixed(2)}s\n`);
    } else {
      console.error('❌ Feed parsing failed:', data.error);
      serverProcess.kill();
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Failed to parse feeds:', error.message);
    serverProcess.kill();
    process.exit(1);
  }

  // Kill the server
  serverProcess.kill();
  console.log('🎉 Pre-build parsing complete!\n');
  process.exit(0);
}

prebuildParse().catch(error => {
  console.error('❌ Pre-build script failed:', error);
  process.exit(1);
});
