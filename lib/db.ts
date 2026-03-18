import { Pool } from 'pg';
import fs from 'fs/promises';
import path from 'path';

// Load environment variables explicitly
if (typeof window === 'undefined') {
  require('dotenv').config({ path: '.env.local' });
}

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Helper function to execute SQL queries
const sql = async (query: string, params: any[] = []) => {
  const client = await pool.connect();
  try {
    const result = await client.query(query, params);
    return result;
  } finally {
    client.release();
  }
};

export interface DBFeed {
  id: string;
  original_url: string;
  type: 'album' | 'publisher';
  title: string;
  priority: 'core' | 'extended' | 'low';
  status: 'active' | 'inactive';
  added_at: Date;
  last_updated: Date;
  source?: 'manual' | 'podroll' | 'recursive';
  discovered_from?: string;
}

export interface DBUser {
  id: number;
  username: string;
  password_hash: string;
  created_at: Date;
  last_login: Date | null;
}

export interface DBUserWallet {
  id: number;
  user_id: number;
  encrypted_mnemonic: string;
  encryption_iv: string;
  encryption_tag: string;
  network: 'mainnet' | 'regtest';
  created_at: Date;
  updated_at: Date;
}

export interface DBPasskeyCredential {
  id: number;
  user_id: number;
  credential_id: string;
  public_key: string;
  counter: number;
  transports: string[] | null;
  prf_supported: boolean;
  created_at: Date;
}

export async function seedDatabase() {
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
        const existing = await sql(
          'SELECT id FROM feeds WHERE id = $1',
          [feed.id]
        );
        
        if (existing.rows.length === 0) {
          // Insert new feed
          await sql(
            'INSERT INTO feeds (id, original_url, type, title, priority, status, added_at, last_updated) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
            [feed.id, feed.originalUrl, feed.type, feed.title, feed.priority, feed.status, feed.addedAt, feed.lastUpdated]
          );
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

export async function initializeDatabase(shouldSeed = true) {
  try {
    console.log('🔧 Initializing database...');
    
    // Create feeds table if it doesn't exist
    await sql(`
      CREATE TABLE IF NOT EXISTS feeds (
        id VARCHAR(255) PRIMARY KEY,
        original_url TEXT NOT NULL UNIQUE,
        type VARCHAR(20) NOT NULL CHECK (type IN ('album', 'publisher')),
        title VARCHAR(500) NOT NULL,
        priority VARCHAR(20) NOT NULL CHECK (priority IN ('core', 'extended', 'low')),
        status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'inactive')),
        added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        source VARCHAR(20) CHECK (source IN ('manual', 'podroll', 'recursive')),
        discovered_from TEXT
      );
    `);
    console.log('✅ Feeds table created/verified');

    // Create users table for authentication
    await sql(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_login TIMESTAMP WITH TIME ZONE
      );
    `);
    console.log('✅ Users table created/verified');

    // Create user_wallets table for encrypted mnemonic storage
    await sql(`
      CREATE TABLE IF NOT EXISTS user_wallets (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        encrypted_mnemonic TEXT NOT NULL,
        encryption_iv VARCHAR(32) NOT NULL,
        encryption_tag VARCHAR(32) NOT NULL,
        network VARCHAR(20) DEFAULT 'mainnet' CHECK (network IN ('mainnet', 'regtest')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('✅ User wallets table created/verified');

    // Create passkey_credentials table for WebAuthn passkey storage
    await sql(`
      CREATE TABLE IF NOT EXISTS passkey_credentials (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        credential_id TEXT UNIQUE NOT NULL,
        public_key TEXT NOT NULL,
        counter INTEGER DEFAULT 0,
        transports TEXT[],
        prf_supported BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('✅ Passkey credentials table created/verified');

    // Make password_hash nullable for passkey-only users (migration)
    try {
      await sql(`
        ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
      `);
      console.log('✅ password_hash made nullable for passkey users');
    } catch {
      // Column may already be nullable
    }

    // Create index for better query performance
    await sql(`
      CREATE INDEX IF NOT EXISTS idx_feeds_status ON feeds(status);
    `);
    console.log('✅ Status index created/verified');

    await sql(`
      CREATE INDEX IF NOT EXISTS idx_feeds_priority ON feeds(priority);
    `);
    console.log('✅ Priority index created/verified');

    await sql(`
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    `);
    console.log('✅ Username index created/verified');

    await sql(`
      CREATE INDEX IF NOT EXISTS idx_user_wallets_user_id ON user_wallets(user_id);
    `);
    console.log('✅ User wallets index created/verified');

    await sql(`
      CREATE INDEX IF NOT EXISTS idx_passkey_credentials_user_id ON passkey_credentials(user_id);
    `);
    await sql(`
      CREATE INDEX IF NOT EXISTS idx_passkey_credentials_credential_id ON passkey_credentials(credential_id);
    `);
    console.log('✅ Passkey credentials indexes created/verified');

    // Add new columns if they don't exist (migration)
    try {
      await sql(`
        ALTER TABLE feeds ADD COLUMN IF NOT EXISTS source VARCHAR(20) CHECK (source IN ('manual', 'podroll', 'recursive'));
      `);
      await sql(`
        ALTER TABLE feeds ADD COLUMN IF NOT EXISTS discovered_from TEXT;
      `);
      console.log('✅ Podroll tracking columns added/verified');
    } catch (error) {
      console.log('ℹ️  Podroll tracking columns already exist or migration not needed');
    }

    // Seed database if requested
    if (shouldSeed) {
      await seedDatabase();
    }

    console.log('✅ Database initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    throw error; // Re-throw to surface the error
  }
}

export async function getAllFeeds(): Promise<DBFeed[]> {
  try {
    const result = await sql(`
      SELECT * FROM feeds 
      WHERE status = 'active' 
      ORDER BY 
        CASE priority 
          WHEN 'core' THEN 1 
          WHEN 'extended' THEN 2 
          WHEN 'low' THEN 3 
        END,
        added_at ASC
    `);
    return result.rows as DBFeed[];
  } catch (error) {
    console.error('Failed to fetch feeds:', error);
    return [];
  }
}

export async function addFeed(
  url: string, 
  type: 'album' | 'publisher', 
  title?: string,
  options?: {
    priority?: 'core' | 'extended' | 'low';
    source?: 'manual' | 'podroll' | 'recursive';
    discoveredFrom?: string;
  }
): Promise<{ success: boolean; error?: string; feed?: DBFeed }> {
  try {
    // Generate ID from URL - limit length and clean up
    let feedId = url.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    // Remove multiple consecutive dashes and trim
    feedId = feedId.replace(/-+/g, '-').replace(/^-|-$/g, '');
    // Limit to 200 characters to avoid database issues
    if (feedId.length > 200) {
      feedId = feedId.substring(0, 200).replace(/-$/, '');
    }
    
    // Default title if not provided
    const feedTitle = title || `Feed from ${new URL(url).hostname}`;
    
    // Default options
    const priority = options?.priority || 'core';
    const source = options?.source || 'manual';
    const discoveredFrom = options?.discoveredFrom;
    
    const result = await sql(
      'INSERT INTO feeds (id, original_url, type, title, priority, status, source, discovered_from) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [feedId, url, type, feedTitle, priority, 'active', source, discoveredFrom]
    );

    if (result.rows.length > 0) {
      return { success: true, feed: result.rows[0] as DBFeed };
    }
    
    return { success: false, error: 'Failed to insert feed' };
  } catch (error: any) {
    if (error?.message?.includes('duplicate key')) {
      return { success: false, error: 'Feed already exists' };
    }
    console.error('Failed to add feed:', error);
    return { success: false, error: 'Database error occurred' };
  }
}

export async function removeFeed(feedId: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`🗑️ Attempting to remove feed: ${feedId}`);
    
    const result = await sql(
      'DELETE FROM feeds WHERE id = $1',
      [feedId]
    );
    
    console.log(`📊 Delete result - Row count: ${result.rowCount}`);
    
    if (result.rowCount && result.rowCount > 0) {
      console.log(`✅ Successfully removed feed: ${feedId}`);
      return { success: true };
    }
    
    console.log(`❌ Feed not found: ${feedId}`);
    return { success: false, error: 'Feed not found' };
  } catch (error) {
    console.error('❌ Failed to remove feed:', error);
    return { success: false, error: 'Database error occurred' };
  }
}

// Default feeds functionality removed - database starts empty
// Users must manually add all RSS feeds they want

// ===== USER AUTHENTICATION FUNCTIONS =====

/**
 * Create a new user account
 */
export async function createUser(username: string, passwordHash: string): Promise<{ success: boolean; user?: DBUser; error?: string }> {
  try {
    const result = await sql(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING *',
      [username, passwordHash]
    );

    if (result.rows.length > 0) {
      return { success: true, user: result.rows[0] as DBUser };
    }
    
    return { success: false, error: 'Failed to create user' };
  } catch (error: any) {
    if (error?.message?.includes('duplicate key')) {
      return { success: false, error: 'Username already exists' };
    }
    console.error('Failed to create user:', error);
    return { success: false, error: 'Database error occurred' };
  }
}

/**
 * Find user by username
 */
export async function findUserByUsername(username: string): Promise<DBUser | null> {
  try {
    const result = await sql(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    
    return result.rows.length > 0 ? result.rows[0] as DBUser : null;
  } catch (error) {
    console.error('Failed to find user by username:', error);
    return null;
  }
}

/**
 * Find user by ID
 */
export async function findUserById(id: number): Promise<DBUser | null> {
  try {
    const result = await sql(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    
    return result.rows.length > 0 ? result.rows[0] as DBUser : null;
  } catch (error) {
    console.error('Failed to find user by ID:', error);
    return null;
  }
}

/**
 * Update user's last login timestamp
 */
export async function updateUserLastLogin(userId: number): Promise<boolean> {
  try {
    await sql(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [userId]
    );
    return true;
  } catch (error) {
    console.error('Failed to update last login:', error);
    return false;
  }
}

/**
 * Store encrypted wallet mnemonic for user
 */
export async function storeUserWallet(
  userId: number, 
  encryptedMnemonic: string, 
  encryptionIv: string, 
  encryptionTag: string,
  network: 'mainnet' | 'regtest' = 'mainnet'
): Promise<{ success: boolean; wallet?: DBUserWallet; error?: string }> {
  try {
    // Check if user already has a wallet
    const existingWallet = await getUserWallet(userId);
    
    if (existingWallet) {
      // Update existing wallet
      const result = await sql(
        'UPDATE user_wallets SET encrypted_mnemonic = $1, encryption_iv = $2, encryption_tag = $3, network = $4, updated_at = NOW() WHERE user_id = $5 RETURNING *',
        [encryptedMnemonic, encryptionIv, encryptionTag, network, userId]
      );
      
      if (result.rows.length > 0) {
        return { success: true, wallet: result.rows[0] as DBUserWallet };
      }
    } else {
      // Create new wallet
      const result = await sql(
        'INSERT INTO user_wallets (user_id, encrypted_mnemonic, encryption_iv, encryption_tag, network) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [userId, encryptedMnemonic, encryptionIv, encryptionTag, network]
      );
      
      if (result.rows.length > 0) {
        return { success: true, wallet: result.rows[0] as DBUserWallet };
      }
    }
    
    return { success: false, error: 'Failed to store wallet' };
  } catch (error) {
    console.error('Failed to store user wallet:', error);
    return { success: false, error: 'Database error occurred' };
  }
}

/**
 * Get user's wallet information
 */
export async function getUserWallet(userId: number): Promise<DBUserWallet | null> {
  try {
    const result = await sql(
      'SELECT * FROM user_wallets WHERE user_id = $1',
      [userId]
    );
    
    return result.rows.length > 0 ? result.rows[0] as DBUserWallet : null;
  } catch (error) {
    console.error('Failed to get user wallet:', error);
    return null;
  }
}

/**
 * Delete user's wallet
 */
export async function deleteUserWallet(userId: number): Promise<boolean> {
  try {
    await sql(
      'DELETE FROM user_wallets WHERE user_id = $1',
      [userId]
    );
    return true;
  } catch (error) {
    console.error('Failed to delete user wallet:', error);
    return false;
  }
}

// ===== PASSKEY CREDENTIAL FUNCTIONS =====

/**
 * Create a new user with passkey (no password required)
 */
export async function createUserWithPasskey(username: string): Promise<{ success: boolean; user?: DBUser; error?: string }> {
  try {
    const result = await sql(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING *',
      [username, ''] // Empty password_hash for passkey-only users
    );

    if (result.rows.length > 0) {
      return { success: true, user: result.rows[0] as DBUser };
    }

    return { success: false, error: 'Failed to create user' };
  } catch (error: any) {
    if (error?.message?.includes('duplicate key')) {
      return { success: false, error: 'Username already exists' };
    }
    console.error('Failed to create user with passkey:', error);
    return { success: false, error: 'Database error occurred' };
  }
}

/**
 * Store a passkey credential for a user
 */
export async function storePasskeyCredential(
  userId: number,
  credentialId: string,
  publicKey: string,
  counter: number,
  transports?: string[],
  prfSupported: boolean = false
): Promise<{ success: boolean; error?: string }> {
  try {
    await sql(
      'INSERT INTO passkey_credentials (user_id, credential_id, public_key, counter, transports, prf_supported) VALUES ($1, $2, $3, $4, $5, $6)',
      [userId, credentialId, publicKey, counter, transports || null, prfSupported]
    );
    return { success: true };
  } catch (error: any) {
    if (error?.message?.includes('duplicate key')) {
      return { success: false, error: 'Credential already exists' };
    }
    console.error('Failed to store passkey credential:', error);
    return { success: false, error: 'Database error occurred' };
  }
}

/**
 * Get all passkey credentials for a user
 */
export async function getPasskeyCredentials(userId: number): Promise<DBPasskeyCredential[]> {
  try {
    const result = await sql(
      'SELECT * FROM passkey_credentials WHERE user_id = $1',
      [userId]
    );
    return result.rows as DBPasskeyCredential[];
  } catch (error) {
    console.error('Failed to get passkey credentials:', error);
    return [];
  }
}

/**
 * Find a passkey credential by credential ID
 */
export async function findPasskeyCredential(credentialId: string): Promise<(DBPasskeyCredential & { username: string }) | null> {
  try {
    const result = await sql(
      `SELECT pc.*, u.username FROM passkey_credentials pc
       JOIN users u ON pc.user_id = u.id
       WHERE pc.credential_id = $1`,
      [credentialId]
    );
    return result.rows.length > 0 ? result.rows[0] as (DBPasskeyCredential & { username: string }) : null;
  } catch (error) {
    console.error('Failed to find passkey credential:', error);
    return null;
  }
}

/**
 * Update passkey credential counter (for replay attack prevention)
 */
export async function updatePasskeyCounter(credentialId: string, newCounter: number): Promise<boolean> {
  try {
    await sql(
      'UPDATE passkey_credentials SET counter = $1 WHERE credential_id = $2',
      [newCounter, credentialId]
    );
    return true;
  } catch (error) {
    console.error('Failed to update passkey counter:', error);
    return false;
  }
}

/**
 * Get all passkey credentials by username (for login flow)
 */
export async function getPasskeyCredentialsByUsername(username: string): Promise<DBPasskeyCredential[]> {
  try {
    const result = await sql(
      `SELECT pc.* FROM passkey_credentials pc
       JOIN users u ON pc.user_id = u.id
       WHERE u.username = $1`,
      [username]
    );
    return result.rows as DBPasskeyCredential[];
  } catch (error) {
    console.error('Failed to get passkey credentials by username:', error);
    return [];
  }
}