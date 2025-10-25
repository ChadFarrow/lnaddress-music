#!/usr/bin/env node

/**
 * Cache clearing utility for local development
 *
 * This script helps clear browser caches during development.
 * It increments the CACHE_VERSION in the service worker file.
 *
 * Usage:
 *   node scripts/clear-cache.js
 *
 * Or add to package.json:
 *   "clear-cache": "node scripts/clear-cache.js"
 */

const fs = require('fs');
const path = require('path');

const SW_PATH = path.join(__dirname, '..', 'public', 'sw.js');

function clearCache() {
  try {
    // Read the service worker file
    let content = fs.readFileSync(SW_PATH, 'utf8');

    // Find and increment the cache version
    const versionRegex = /const CACHE_VERSION = ['"]v(\d+)['"]/;
    const match = content.match(versionRegex);

    if (match) {
      const currentVersion = parseInt(match[1]);
      const newVersion = currentVersion + 1;

      content = content.replace(
        versionRegex,
        `const CACHE_VERSION = 'v${newVersion}'`
      );

      fs.writeFileSync(SW_PATH, content, 'utf8');

      console.log('\x1b[32m✓\x1b[0m Cache version bumped from v' + currentVersion + ' to v' + newVersion);
      console.log('\x1b[33m➜\x1b[0m Refresh your browser to load the new service worker');
      console.log('\x1b[33m➜\x1b[0m You may need to close all tabs and reopen to fully clear cache');
      console.log('\x1b[33m➜\x1b[0m Or use Chrome DevTools → Application → Clear Storage → Clear site data');
    } else {
      console.error('\x1b[31m✗\x1b[0m Could not find CACHE_VERSION in service worker');
      process.exit(1);
    }
  } catch (error) {
    console.error('\x1b[31m✗\x1b[0m Error clearing cache:', error.message);
    process.exit(1);
  }
}

clearCache();
