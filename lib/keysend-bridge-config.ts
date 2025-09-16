/**
 * Keysend Bridge Configuration
 * 
 * This file configures the Alby Hub NWC connection that acts as a bridge
 * for wallets that don't support keysend payments (like Coinos).
 * 
 * SECURITY: The NWC connection string contains sensitive credentials.
 * Store it in environment variables, NOT in code!
 * 
 * To set up your Alby Hub bridge:
 * 1. Open your Alby Hub dashboard
 * 2. Go to Apps → Connections
 * 3. Create a new NWC connection
 * 4. Copy the connection string (starts with nostr+walletconnect://)
 * 5. Add to your .env.local file: ALBY_HUB_BRIDGE_NWC=your_connection_string
 */

// Get bridge connection from environment variable (server-side only)
// For client-side usage, this would need to be passed through an API endpoint
export const ALBY_HUB_BRIDGE_CONNECTION = process.env.ALBY_HUB_BRIDGE_NWC || '';

// Check if bridge is configured (has valid connection string)
export const IS_BRIDGE_CONFIGURED = !!ALBY_HUB_BRIDGE_CONNECTION && 
  !ALBY_HUB_BRIDGE_CONNECTION.includes('YOUR_');

/**
 * Configuration for the keysend bridge behavior
 */
export const BRIDGE_CONFIG = {
  // Enable automatic bridge for non-keysend wallets
  autoEnableBridge: true,
  
  // Show bridge status indicator in UI
  showBridgeIndicator: true,
  
  // Timeout for bridge operations (ms)
  bridgeTimeout: 30000,
  
  // List of wallets that should use the bridge (either no keysend or unreliable keysend)
  nonKeysendWallets: [
    'coinos',           // Has keysend but often fails, use bridge
    'ln.coinos.io',     // Coinos NWC service name
    'wallet of satoshi',
    'strike', 
    'cash app',
    'zebedee',
    'primal'            // Reports keysend support but doesn't implement it yet
  ],
  
  // List of wallets known to support reliable keysend
  keysendWallets: [
    'alby',
    'zeus',
    'breez', 
    'phoenix',
    'mutiny',
    'umbrel',
    'lnbits',
    'start9'
    // Note: coinos and primal removed - have keysend but unreliable/not implemented, use bridge instead
  ]
};