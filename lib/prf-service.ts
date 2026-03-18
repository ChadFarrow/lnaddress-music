'use client';

/**
 * PRF (Pseudo-Random Function) service for passkey-derived deterministic key generation
 * Implements the Breez passkey-login spec (v0.9.1):
 * - account_master = PRF(passkey, 0x4e594f415354525453414f594e)
 * - root_key = PRF(passkey, salt_string)
 * - mnemonic = BIP39(root_key)
 *
 * Client-side only — secrets never leave the device
 */

// Magic challenge for account master derivation (hex of "NYOASTRTSAOYN")
const ACCOUNT_MASTER_CHALLENGE = new Uint8Array([
  0x4e, 0x59, 0x4f, 0x41, 0x53, 0x54, 0x52, 0x54,
  0x53, 0x41, 0x4f, 0x59, 0x4e,
]);

/**
 * Check if the browser supports WebAuthn PRF extension
 */
export async function isPRFSupported(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!window.PublicKeyCredential) return false;

  // Check if the PRF extension is available via getClientCapabilities if supported
  try {
    if ('getClientCapabilities' in PublicKeyCredential) {
      const capabilities = await (PublicKeyCredential as any).getClientCapabilities();
      if (capabilities?.prf !== undefined) {
        return !!capabilities.prf;
      }
    }
  } catch {
    // Fall through to feature detection at registration time
  }

  // Can't definitively know until we try — return true to attempt
  return true;
}

/**
 * Convert a string salt to the PRF eval input format (ArrayBuffer)
 */
function saltToBuffer(salt: string): ArrayBuffer {
  return new TextEncoder().encode(salt).buffer as ArrayBuffer;
}

/**
 * Extract PRF output from a WebAuthn credential response
 */
function extractPRFOutput(credential: PublicKeyCredential): ArrayBuffer | null {
  const extensions = credential.getClientExtensionResults() as any;
  if (extensions?.prf?.results?.first) {
    return extensions.prf.results.first;
  }
  return null;
}

/**
 * Derive the account master key using PRF with the magic challenge.
 * This key is used to derive the Nostr salt registry account.
 */
export async function deriveAccountMaster(
  credentialId: string
): Promise<{ accountMaster: Uint8Array; prfSupported: boolean } | null> {
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{
          id: base64urlToBuffer(credentialId),
          type: 'public-key' as const,
        }],
        userVerification: 'required',
        extensions: {
          prf: {
            eval: {
              first: ACCOUNT_MASTER_CHALLENGE.buffer,
            },
          },
        },
      },
    }) as PublicKeyCredential | null;

    if (!assertion) return null;

    const prfOutput = extractPRFOutput(assertion);
    if (!prfOutput) {
      return { accountMaster: new Uint8Array(0), prfSupported: false };
    }

    return {
      accountMaster: new Uint8Array(prfOutput),
      prfSupported: true,
    };
  } catch (error) {
    console.error('Failed to derive account master:', error);
    return null;
  }
}

/**
 * Derive a root key from a passkey + salt string using PRF.
 * The root key is then converted to a BIP39 mnemonic.
 */
export async function deriveRootKey(
  credentialId: string,
  salt: string = 'default'
): Promise<Uint8Array | null> {
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{
          id: base64urlToBuffer(credentialId),
          type: 'public-key' as const,
        }],
        userVerification: 'required',
        extensions: {
          prf: {
            eval: {
              first: saltToBuffer(salt),
            },
          },
        },
      },
    }) as PublicKeyCredential | null;

    if (!assertion) return null;

    const prfOutput = extractPRFOutput(assertion);
    if (!prfOutput) return null;

    // PRF output is 32 bytes — use first 16 bytes for 12-word BIP39 mnemonic (128 bits)
    return new Uint8Array(prfOutput).slice(0, 16);
  } catch (error) {
    console.error('Failed to derive root key:', error);
    return null;
  }
}

/**
 * Derive a BIP39 mnemonic from a passkey + salt using PRF.
 * This is the main entry point for wallet mnemonic derivation.
 */
export async function deriveMnemonicFromPasskey(
  credentialId: string,
  salt: string = 'default'
): Promise<string | null> {
  const rootKey = await deriveRootKey(credentialId, salt);
  if (!rootKey || rootKey.length === 0) return null;

  // Dynamic import of bip39 (client-side only)
  const bip39 = await import('bip39');
  const mnemonic = bip39.entropyToMnemonic(Buffer.from(rootKey).toString('hex'));

  return mnemonic;
}

// Utility: base64url string to ArrayBuffer
function base64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer as ArrayBuffer;
}
