#!/usr/bin/env node

/**
 * Database Seeding Script
 * 
 * This script seeds the database with feeds from data/feeds.json
 * Run this script to populate the database with initial feeds
 */

const fs = require('fs/promises');
const path = require('path');
const { sql } = require('@vercel/postgres');

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

async function seedDatabase() {
  try {
    console.log('🌱 Seeding database with feeds from feeds.json...');
    
    // Read feeds.json file
    const feedsPath = path.join(process.cwd(), 'data', 'feeds.json');
    const feedsData = await fs.readFile(feedsPath, 'utf8');
    const { feeds } = JSON.parse(feedsData);
    
    let seededCount = 0;
    
    for (const feed of feeds) {
      try {
        // Check if feed already exists
        const existing = await sql`
          SELECT id FROM feeds WHERE id = ${feed.id}
        `;
        
        if (existing.rows.length === 0) {
          // Insert new feed
          await sql`
            INSERT INTO feeds (id, original_url, type, title, priority, status, added_at, last_updated)
            VALUES (
              ${feed.id}, 
              ${feed.originalUrl}, 
              ${feed.type}, 
              ${feed.title}, 
              ${feed.priority}, 
              ${feed.status},
              ${feed.addedAt},
              ${feed.lastUpdated}
            )
          `;
          seededCount++;
          console.log(`✅ Seeded feed: ${feed.title}`);
        } else {
          console.log(`⏭️  Feed already exists: ${feed.title}`);
        }
      } catch (error) {
        console.error(`❌ Failed to seed feed ${feed.title}:`, error);
      }
    }
    
    console.log(`✅ Database seeding complete. ${seededCount} new feeds added.`);
    return seededCount;
  } catch (error) {
    console.error('❌ Failed to seed database:', error);
    throw error;
  }
}

async function initializeDatabase() {
  try {
    console.log('🔧 Initializing database...');
    
    // Create feeds table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS feeds (
        id VARCHAR(255) PRIMARY KEY,
        original_url TEXT NOT NULL UNIQUE,
        type VARCHAR(20) NOT NULL CHECK (type IN ('album', 'publisher')),
        title VARCHAR(500) NOT NULL,
        priority VARCHAR(20) NOT NULL CHECK (priority IN ('core', 'extended', 'low')),
        status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'inactive')),
        added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    console.log('✅ Feeds table created/verified');

    // Create index for better query performance
    await sql`
      CREATE INDEX IF NOT EXISTS idx_feeds_status ON feeds(status);
    `;
    console.log('✅ Status index created/verified');

    await sql`
      CREATE INDEX IF NOT EXISTS idx_feeds_priority ON feeds(priority);
    `;
    console.log('✅ Priority index created/verified');

    console.log('✅ Database initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    throw error;
  }
}

async function main() {
  console.log('🌱 ITDV-Site Database Seeding Script\n');
  
  try {
    // Initialize database
    await initializeDatabase();
    
    // Seed the database
    const seededCount = await seedDatabase();
    
    console.log(`\n✅ Seeding complete! ${seededCount} feeds added to database.`);
    console.log('\n🎵 Your ITDV-Site is now ready to serve albums!');
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

main(); 