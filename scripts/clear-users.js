#!/usr/bin/env node

/**
 * Clear all users and wallets from the database
 * This will delete all user accounts and their associated wallet data
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function clearUsers() {
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    console.log('🗑️  Clearing all users and wallets from database...\n');

    // Get count before deletion
    const userCount = await pool.query('SELECT COUNT(*) FROM users');
    const walletCount = await pool.query('SELECT COUNT(*) FROM user_wallets');

    console.log(`📊 Current state:`);
    console.log(`   - Users: ${userCount.rows[0].count}`);
    console.log(`   - Wallets: ${walletCount.rows[0].count}\n`);

    if (userCount.rows[0].count === '0') {
      console.log('✅ Database is already empty. No users to delete.');
      await pool.end();
      return;
    }

    // Delete all user wallets (will cascade delete due to foreign key)
    await pool.query('DELETE FROM user_wallets');
    console.log('✅ Deleted all wallets');

    // Delete all users
    await pool.query('DELETE FROM users');
    console.log('✅ Deleted all users');

    // Verify deletion
    const finalUserCount = await pool.query('SELECT COUNT(*) FROM users');
    const finalWalletCount = await pool.query('SELECT COUNT(*) FROM user_wallets');

    console.log(`\n📊 Final state:`);
    console.log(`   - Users: ${finalUserCount.rows[0].count}`);
    console.log(`   - Wallets: ${finalWalletCount.rows[0].count}`);

    console.log('\n✨ Database cleared successfully!');

    await pool.end();
  } catch (error) {
    console.error('❌ Error clearing database:', error);
    await pool.end();
    process.exit(1);
  }
}

clearUsers();
