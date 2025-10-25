/**
 * Application-wide constants
 * Centralizes magic numbers and strings for easier maintenance
 */

// Payment & Boost Amounts
export const PAYMENT_AMOUNTS = {
  AUTO_BOOST_DEFAULT: 25,
  MANUAL_BOOST_DEFAULT: 50,
  MANUAL_BOOST_OPTIONS: [10, 21, 50, 100, 210, 500, 1000, 2100, 5000, 10000, 21000],
} as const;

// TLV (Type-Length-Value) Record Types for Lightning Payments
// These are used in podcast 2.0 boost messages
export const TLV_TYPES = {
  PODCAST_BOOST: 7629169,      // Standard podcast boost
  TIP_NOTE: 7629171,           // Message/note with payment
  SPHINX_COMPAT: 133773310,    // Sphinx chat compatibility
} as const;

// Feed IDs (if these are specific to your content)
export const FEED_IDS = {
  BLOODSHOT_LIES: "6590183",
  INTO_DOERFEL_VERSE: "6590182",
} as const;

// Wallet & Connection Settings
export const WALLET_SETTINGS = {
  CHECK_INTERVAL_MS: 5000,           // How often to check wallet connection
  RATE_LIMIT_INTERVAL_MS: 5000,      // Rate limiting for connection checks
} as const;

// UI Settings
export const UI_SETTINGS = {
  CONFETTI_COUNT: 200,
  CONFETTI_COLORS: ['#FFD700', '#FFA500', '#FF8C00', '#FFE55C', '#FFFF00'] as string[],
};

// Local Storage Keys
export const STORAGE_KEYS = {
  BOOST_SENDER_NAME: 'boost-sender-name',
  LIGHTNING_ENABLED: 'lightning_enabled',
  BC_CONFIG: 'bc:config',
  NWC_CONNECTION: 'nwc_connection_string',
  AUTO_BOOST_ENABLED: 'auto_boost_enabled',
  AUTO_BOOST_AMOUNT: 'auto_boost_amount',
} as const;

// Image Settings
export const IMAGE_SETTINGS = {
  DEFAULT_ARTWORK_SIZE: '512x512',
  DEFAULT_ARTWORK_TYPE: 'image/png',
} as const;

// Cache Settings (for API routes)
export const CACHE_SETTINGS = {
  REVALIDATE_TIME: 3600, // 1 hour
  STALE_WHILE_REVALIDATE: 86400, // 24 hours
} as const;
