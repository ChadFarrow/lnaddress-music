# Plan: Passkey Login as Default Wallet Setup Flow

## Overview

Replace password-based auth with WebAuthn passkey authentication as the **default** flow. Passkey PRF derives BIP39 mnemonics deterministically — no password, no encrypted storage needed. Keep password login as fallback for devices without PRF support.

## Dependencies to Add

- `@simplewebauthn/browser` — client-side WebAuthn API wrapper
- `@simplewebauthn/server` — server-side challenge generation & verification

## Phase 1: WebAuthn Foundation

### 1.1 Database Schema Migration
- Add `passkey_credentials` table:
  ```sql
  CREATE TABLE passkey_credentials (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    credential_id TEXT UNIQUE NOT NULL,
    public_key TEXT NOT NULL,
    counter INTEGER DEFAULT 0,
    transports TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );
  ```
- Make `password_hash` nullable in `users` table (passkey-only users won't have one)
- Update `lib/db.ts` with new table creation + migration

### 1.2 Server-Side WebAuthn Service
- Create `lib/webauthn-service.ts`:
  - `generateRegistrationOptions(username, userId)` — challenge + RP config
  - `verifyRegistration(credential, expectedChallenge)` — verify attestation, store credential
  - `generateAuthenticationOptions(userId?)` — challenge + allowed credentials
  - `verifyAuthentication(credential, expectedChallenge, storedCredential)` — verify assertion, update counter
- Add env vars: `NEXT_PUBLIC_WEBAUTHN_RP_ID`, `NEXT_PUBLIC_WEBAUTHN_RP_NAME` (default from `NEXT_PUBLIC_SITE_URL`)

### 1.3 Passkey API Routes
- `POST /api/auth/passkey/register/start` — generate registration challenge
- `POST /api/auth/passkey/register/complete` — verify attestation, create user + credential, set JWT cookie
- `POST /api/auth/passkey/login/start` — generate authentication challenge
- `POST /api/auth/passkey/login/complete` — verify assertion, set JWT cookie

### 1.4 Challenge Storage
- Store challenges in-memory with short TTL (5 min) via a simple Map with cleanup interval
- Key by generated challenge ID, value is `{ challenge, userId?, expiresAt }`

## Phase 2: Client-Side PRF Integration

### 2.1 PRF Service
- Create `lib/prf-service.ts`:
  - `deriveAccountMaster(credential)` — `PRF(passkey, 0x4e594f415354525453414f594e)` → account master
  - `deriveRootKey(credential, salt)` — `PRF(passkey, salt)` → root key
  - `rootKeyToMnemonic(rootKey)` — BIP39 encoding of root key
  - `deriveNostrKeys(accountMaster)` — BIP32 path `m/44'/1237'/55'/0/0`
  - `isPRFSupported()` — feature detection
- Uses `@simplewebauthn/browser` for PRF extension in `get()` calls

### 2.2 Nostr Salt Registry (Optional — Phase 2 stretch)
- Publish salt strings as kind-1 events signed by account 55 Nostr keys
- Query salts on restore to show user which wallets to recover
- Uses existing `nostr-tools` dependency

## Phase 3: UI Components

### 3.1 PasskeyLoginForm Component
- New `components/PasskeyLoginForm.tsx`:
  - Primary UI: "Sign in with Passkey" button (large, prominent)
  - Optional username field for discoverable credential hint
  - Calls `startPasskeyLogin()` → `navigator.credentials.get()` with PRF extension → `completePasskeyLogin()`
  - On success: if PRF supported, derive mnemonic and auto-connect Breez; if not, show NWC/manual options
  - Link to "Sign in with password" fallback at bottom

### 3.2 PasskeyRegisterForm Component
- New `components/PasskeyRegisterForm.tsx`:
  - Username input + "Create Passkey" button
  - Calls `startPasskeyRegistration()` → `navigator.credentials.create()` with PRF extension → `completePasskeyRegistration()`
  - After registration: derive default mnemonic from `PRF(passkey, "default")`, auto-connect Breez
  - Show mnemonic backup option (optional write-down per spec)

### 3.3 Update AuthModal
- Default tab: Passkey login/register
- Secondary tab: Password login/register (fallback)
- Detect PRF support on mount; if unavailable, show info banner explaining passkey benefits and that password login is the fallback

### 3.4 Update BreezConnect
- Add new connection path: "Connect with Passkey"
  - If user authenticated via passkey with PRF: derive mnemonic on-demand, pass to `breezService.connect()`
  - No password prompt needed
  - Salt selector (default: "default") for multi-wallet users
- Keep existing paths (localStorage mnemonic, password-decrypt from DB) as fallbacks

### 3.5 Update AuthContext
- Add methods:
  - `registerWithPasskey(username)` → full registration flow
  - `loginWithPasskey()` → full login flow
  - `deriveMnemonic(salt?)` → PRF-based mnemonic derivation (client-side only)
  - `hasPRFSupport` — boolean flag set on mount
- Keep existing `login(username, password)` and `register()` as fallbacks
- Add `authMethod: 'passkey' | 'password'` to user state so components know which flow was used

## Phase 4: Default Flow Wiring

### 4.1 Make Passkey the Default
- `LightningWallet.tsx`: Show passkey auth as first/default option when opening wallet modal
- `BreezConnect.tsx`: If `authMethod === 'passkey' && hasPRFSupport`, skip password prompt entirely and derive mnemonic from PRF
- Auto-connect flow on page load: if passkey session exists + PRF available → silent mnemonic derivation → Breez auto-connect

### 4.2 Fallback Handling
- If PRF not supported: fall back to password-based mnemonic encryption (current flow)
- If passkey registration fails: offer password registration
- If Breez connect fails with PRF mnemonic: show error + manual mnemonic import option

## Files Changed (Summary)

**New files:**
- `lib/webauthn-service.ts` — server-side WebAuthn
- `lib/prf-service.ts` — client-side PRF + mnemonic derivation
- `app/api/auth/passkey/register/start/route.ts`
- `app/api/auth/passkey/register/complete/route.ts`
- `app/api/auth/passkey/login/start/route.ts`
- `app/api/auth/passkey/login/complete/route.ts`
- `components/PasskeyLoginForm.tsx`
- `components/PasskeyRegisterForm.tsx`

**Modified files:**
- `lib/db.ts` — add `passkey_credentials` table, make `password_hash` nullable
- `contexts/AuthContext.tsx` — add passkey methods, `authMethod` state, `hasPRFSupport`
- `components/AuthModal.tsx` — passkey as default tab
- `components/BreezConnect.tsx` — PRF-based mnemonic derivation path
- `components/LightningWallet.tsx` — passkey as default wallet setup
- `hooks/useBreezAuth.ts` — add `connectWithPasskey(salt)` alongside `connectWithUserWallet(password)`
- `package.json` — add `@simplewebauthn/browser`, `@simplewebauthn/server`

**Unchanged:**
- NWC flow (independent wallet path)
- Bitcoin Connect / Alby Go flow (independent)
- Payment processing paths (they receive mnemonic-connected Breez, don't care how it was set up)
- RSS/feed system, audio player, all non-auth components
