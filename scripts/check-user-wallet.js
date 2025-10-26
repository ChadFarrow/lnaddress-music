require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkUserWallet(username) {
  const client = await pool.connect();
  try {
    // Get user
    const userResult = await client.query(
      'SELECT id, username, created_at FROM users WHERE username = $1',
      [username]
    );

    if (userResult.rows.length === 0) {
      console.log(`❌ User "${username}" not found`);
      return;
    }

    const user = userResult.rows[0];
    console.log('✅ User found:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Username: ${user.username}`);
    console.log(`   Created: ${user.created_at}`);

    // Get wallet
    const walletResult = await client.query(
      'SELECT id, user_id, network, created_at FROM user_wallets WHERE user_id = $1',
      [user.id]
    );

    if (walletResult.rows.length === 0) {
      console.log('\n❌ No wallet found for this user');
    } else {
      const wallet = walletResult.rows[0];
      console.log('\n✅ Wallet found:');
      console.log(`   Wallet ID: ${wallet.id}`);
      console.log(`   Network: ${wallet.network}`);
      console.log(`   Created: ${wallet.created_at}`);
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

const username = process.argv[2] || 'ChadF';
checkUserWallet(username);
