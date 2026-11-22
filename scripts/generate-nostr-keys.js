const { generateSecretKey, getPublicKey, nip19 } = require('nostr-tools');

// Generate new Nostr keys for the site
const secretKey = generateSecretKey();
const publicKey = getPublicKey(secretKey);

// Encode as nsec/npub for easy use
const nsec = nip19.nsecEncode(secretKey);
const npub = nip19.npubEncode(publicKey);

console.log('Generated Nostr keys for HPM Lightning site:');
console.log('# Server-only secret. Never add a NEXT_PUBLIC_ prefix (that puts it in the browser bundle).');
console.log('# On Vercel, add it as a Sensitive variable.');
console.log('SITE_NOSTR_NSEC=' + nsec);
console.log('NEXT_PUBLIC_SITE_NOSTR_NPUB=' + npub);
console.log('');
console.log('Public key (hex):', publicKey);
console.log('Profile URL: https://primal.net/p/' + npub);