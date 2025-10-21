#!/usr/bin/env node

/**
 * Build-time feed parser using dynamic import for ES modules
 * This runs before the Next.js build to ensure fresh feed data
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

async function buildParse() {
  console.log('🚀 Build: Starting feed parse...\n');

  return new Promise((resolve, reject) => {
    // Use Next.js's built-in TypeScript loader by running via tsx or ts-node
    const parseProcess = spawn('npx', [
      'tsx',
      join(projectRoot, 'scripts', 'direct-parse-feeds.ts')
    ], {
      cwd: projectRoot,
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'production' }
    });

    parseProcess.on('close', (code) => {
      if (code === 0) {
        console.log('\n✅ Feed parsing complete for build!\n');
        resolve();
      } else {
        console.error(`\n❌ Feed parsing failed with code ${code}\n`);
        reject(new Error(`Parse process exited with code ${code}`));
      }
    });

    parseProcess.on('error', (error) => {
      console.error('❌ Failed to start parse process:', error);
      reject(error);
    });
  });
}

buildParse().catch(error => {
  console.error('❌ Build parse script failed:', error);
  process.exit(1);
});
