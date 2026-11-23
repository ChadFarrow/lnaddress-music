# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**lnaddress-music** (package name: `hpm-lightning`) is a Lightning Network-powered Value4Value music platform template built on Next.js. Artists, bands, and music platforms fork this template and customize it. It streams music from RSS feeds with Podcasting 2.0 value tags, enabling instant Bitcoin payments via Lightning Network, Nostr zap publishing, and multi-wallet support.

No database is required for core functionality — data comes from RSS feeds configured in `data/feeds.json`, parsed and cached in `data/parsed-feeds.json`.

## Commands

```bash
npm run dev              # Dev server (default Lightning mode)
npm run dev:lightning    # Dev with Lightning payments enabled
npm run dev:basic        # Dev with payments disabled (music-only)
npm run build            # Production build
npm run build:lightning  # Build Lightning version
npm run build:basic      # Build basic (no payments) version
npm run lint             # ESLint
npm test                 # Unit tests (node --test, Node's built-in TypeScript type stripping; test/*.test.ts)
npm run test-feeds       # Validate RSS feeds in feeds.json (NOTE: script missing as of 2026-03)
npm run clear-cache      # Clear RSS feed cache
npm run deploy           # Auto-version PWA + deploy
```

Node.js 24 required (`engines` is `^24.22.1`; see `.nvmrc`).

## Architecture

### Dual-Mode System

The app runs in two modes controlled by `NEXT_PUBLIC_ENABLE_LIGHTNING` env var:
- **Lightning mode**: Full payments, boosts, Nostr integration, multi-wallet support
- **Basic mode**: Music streaming only, all payment components tree-shaken out

Feature flags defined in `lib/feature-flags.ts`. Lightning components are loaded with `dynamic()` and `ssr: false` to avoid server-side rendering issues with browser-only wallet APIs.

### Data Flow

```
data/feeds.json (feed URLs) → RSS parsing (lib/rss-parser.ts) → data/parsed-feeds.json (pre-parsed cache)
                                                                        ↓
                                                              API routes serve to frontend
                                                                        ↓
                                                              AlbumCard/PublisherCard render
```

- **Feed configuration**: `data/feeds.json` — list of RSS feed URLs with type (album/publisher), priority, status
- **Pre-parsed data**: `data/parsed-feeds.json` (1.7MB) — build uses this for fast startup
- **RSS cache**: `data/rss-cache/` — individual feed cache files with 30-min TTL
- On Vercel: filesystem is read-only, so `lib/rss-cache.ts` falls back to in-memory caching

### Provider Hierarchy (app/layout.tsx)

```
ClientErrorBoundary → ErrorBoundary → AuthProvider → LightningProvider → AudioProvider → BitcoinConnectProvider
```

All state management uses React Context — no Redux or external state library.

### Payment Processing

Multiple wallet backends, each independent — NWC and Breez are separate wallets, not fallbacks for each other:
- **NWC** (`lib/nwc-service.ts`, `hooks/useNWC.ts`) — Nostr Wallet Connect (NIP-47), supports `lnaddress` and `node` (keysend, Alby only)
- **Breez SDK Spark** (`lib/breez-service.ts`, `hooks/useBreez.ts`) — self-custodial WASM-based on-device wallet (v0.13.1), supports `lnaddress` only. The `prepareLnurlPay` branch in `sendPayment()` is dormant — app converts Lightning Addresses to BOLT11 via `LNURLService.getPaymentInvoice()` first, then pays via `prepareSendPayment` (expects `amount: BigInt(sats)`)
- **WebLN** (`lib/webln-service.ts`) — browser extension wallets (Alby)
- **LNURL-Pay** (`lib/lnurl-service.ts`) — converts Lightning Addresses to invoices, carries LUD-12 comments via `?comment=` callback param

Payment recipients come from Podcasting 2.0 `<podcast:value>` tags in RSS feeds. Recipients have a `type` field: `lnaddress` (Lightning Address) or `node` (keysend pubkey). Split percentages determine payment amounts. TLV records (`lib/tlv-utils.ts`) encode boost metadata for keysend.

**Critical: 4+ independent payment code paths** exist across the app — changes to payment logic must be applied to ALL of them:
1. `app/page.tsx` ~line 218 `sendPayment()` — main page album boost
2. `app/album/[id]/AlbumDetailClient.tsx` ~line 290 — album detail boost (album-level + track-level)
3. `components/NowPlayingScreen.tsx` ~line 560 — now playing screen boost
4. `utils/payment-utils.ts` — auto-boost (streaming sats) for both NWC and Breez

Each path has its own wallet selection logic (`if nwc... else if breez...`). When modifying payment behavior, grep for the pattern and update all paths.

**NWC keysend support**: Only Alby NWC connections support keysend (checked via `supportsKeysend` in `hooks/useNWC.ts` — looks for `getalby.com` in the connection string). Other NWC wallets (Primal, etc.) only support `lnaddress` recipients.

**React state vs service state**: Payment functions should check wallet connection via the service directly (`getNWCService().isConnected()`) rather than relying on React hook state (`nwc.isConnected`) which can be stale in closures.

After payment, a boost is posted to Nostr as a kind 1 boost note (`lib/boost-to-nostr-service.ts`, format in `lib/boost-note.ts`).

**Boost notes are signed on the server.** When `NEXT_PUBLIC_SITE_NOSTR_NPUB` is set, `hooks/useBoostToNostr.ts` sends the boost data to `POST /api/nostr/boost-note`. The route signs with the server-only `SITE_NOSTR_NSEC` and returns the event. The browser checks the signature and the pubkey, then publishes to the same relays as before. The secret key never reaches the browser. Never give it a `NEXT_PUBLIC_` prefix: Next.js copies `NEXT_PUBLIC_` values into the client bundle (the old `NEXT_PUBLIC_SITE_NOSTR_NSEC` put the key in the live bundle until 2026-11-22). Without the npub, each browser signs with its own random key (template forks).

The route is not an open signer (`lib/boost-note-guard.ts`, tests in `test/boost-note-guard.test.ts`): kind 1 boost-note shape only, built on the server; every GUID must be in the catalog (`data/parsed-feeds.json`, `data/feeds.json`), and at least one item or feed GUID is required; an image outside the catalog is dropped; amount 0–10,000,000 sats, comment ≤ 600 chars, body ≤ 16 KB; a cross-origin `Origin` is refused; 12 notes per minute per IP and 120 per minute per instance (in memory, so per Vercel instance). It cannot prove that a payment happened: anyone can still get a boost note about a catalog item with their own comment, within those limits. Changing the note format? Change `lib/boost-note.ts` and its test, so the server and the browser fallback stay the same.

**BoostBox** (`lib/boostbox-service.ts`) — persistent boost metadata storage via [tardbox.com](https://tardbox.com). Before each payment, boost metadata is POSTed to BoostBox, which returns `{url, desc}`. The URL is embedded in the LUD-12 comment in Fountain-compatible format: `rss::payment::boost <boostbox_url> <user_message>`. Active by default (defaults to `https://tardbox.com`, API key must be set via `NEXT_PUBLIC_BOOSTBOX_API_KEY` env var). Fire-and-forget — failures are logged but never block payments.

**LNURL comment flow**: For `lnaddress` recipients, `LNURLService.getPaymentInvoice()` fetches LNURL metadata, appends `?comment=` to the callback URL (LUD-12), and returns a BOLT11 invoice. The comment is sent when the invoice is created, NOT when it's paid. The `commentAllowed` field from the LNURL endpoint determines max comment length (e.g., Alby allows 255 chars). Comments that exceed the limit are truncated; unsupported endpoints skip the comment silently.

### Key Directories

- `app/api/` — 20+ API routes (albums, feeds, auth, admin, cron, proxy endpoints)
- `components/` — 34 React components (album cards, player, payment modals, wallet UIs)
- `contexts/` — React context providers (Audio, BitcoinConnect, Lightning, Auth)
- `hooks/` — Custom hooks (useAutoBoost, useBreez, useNWC, useBoostToNostr, usePlaylist)
- `lib/` — Core business logic (RSS parsing, payment services, caching, utilities)
- `scripts/` — 43 utility scripts (feed parsing, deployment, cache management)
- `data/` — Feed configs, parsed data, RSS cache, static content

### Important API Routes

- `GET /api/albums-static-cached` — Primary album data endpoint (cached, fast)
- `GET /api/albums-no-db` — Fresh album data (dynamic, slower)
- `POST /api/parse-feeds` — Trigger RSS feed re-parsing
- `GET /api/cron/refresh-feeds` — Daily cron (6 AM UTC, configured in `vercel.json`)
- `GET /api/publisher/[name]` — Publisher page data

### Adding a New Feed

1. Add entry to `data/feeds.json` with URL, type, priority, status
2. Re-parse feeds to update `data/parsed-feeds.json`

### Discovering New Feeds

`scripts/discover-new-fountain-feeds.ts` queries the Podcast Index API (`/podcasts/bymedium?medium=music` and `/search/music/byterm?q=fountain`) to find fountain.fm music feeds not yet in `feeds.json`. Run with `npx tsx scripts/discover-new-fountain-feeds.ts` (dry run) or `--write` to add directly. Requires `PODCAST_INDEX_API_KEY` and `PODCAST_INDEX_API_SECRET` in `.env.local`.

Feed sources include fountain.fm, phafe.com (self-hosted RSS), and wavlake.com. Feeds use either `lnaddress` recipients (Lightning Address) or `node` recipients (keysend) — some sources like Wavlake are keysend-only.

## Environment Variables

Required for dev:
```
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_ENABLE_LIGHTNING=true   # or false for basic mode
JWT_SECRET=<any-secret>
```

BoostBox config (API key required for boost metadata storage):
```
NEXT_PUBLIC_BOOSTBOX_URL=https://tardbox.com       # default
NEXT_PUBLIC_BOOSTBOX_API_KEY=your-api-key          # required
```

Site Nostr key for boost notes (`node scripts/generate-nostr-keys.js` makes a pair):
```
SITE_NOSTR_NSEC=nsec1...             # server-only; on Vercel a Sensitive variable (Production, Preview)
NEXT_PUBLIC_SITE_NOSTR_NPUB=npub1... # public; turns on server signing
```

See `env.lightning.template` and `env.basic.template` for full variable lists. The dev modes (`dev:lightning`/`dev:basic`) copy the appropriate template to `.env.local`.

## Deployment

- **Platform**: Vercel (read-only filesystem, in-memory RSS cache)
- **Cron**: Daily feed refresh at 6 AM UTC (`vercel.json`)
- **PWA**: Auto-versioned via `scripts/auto-version-update.js` on deploy. Service worker caches aggressively — after deploying, users may need to hard-refresh (Cmd+Shift+R) or unregister the service worker (DevTools → Application → Service Workers) to see changes. Check chunk hashes in console vs build output to confirm which version is running.
- **Capacitor**: Android build support via `@capacitor/android` (dev dependency)

## Conventions

- TypeScript throughout, React 18, Next.js 15 App Router
- Tailwind CSS for styling (dark theme, `bg-gray-50` base)
- Image optimization via Next.js Image with 20+ allowed domains in `next.config.js`
- Constants centralized in `lib/constants.ts` (payment amounts, TLV types, storage keys, cache TTLs)
- Heavy use of `dynamic()` imports with `ssr: false` for wallet/payment components
- `package.json` `overrides` gives `next` the top-level `postcss`: Next 15.5 pins `postcss` 8.4.31, which has high advisories (fixed in 8.5.23). Remove the override when Next itself depends on `postcss` >= 8.5.23 (Next 16.4.6 does).
- Since Next 15.5.29 (GHSA-pc58-hwjq-p385), a route-handler response loses its `Content-Length`, `Content-Encoding` and `Transfer-Encoding` headers. Never gzip a body yourself in a route handler: the browser gets gzip bytes with no `Content-Encoding`. The image routes (`/api/proxy-image`, `/api/optimized-images`) now send chunked responses with no `Content-Length`; the bodies are unchanged. Without `Content-Length`, the Vercel edge cache answers a `Range` request with 200 and the full body, not 206. Images do not need `Range`, but audio and video seeking does: do not send media through a route handler.
- Git: Quote paths with brackets in shell commands (e.g., `git add "app/album/[id]/AlbumDetailClient.tsx"`) — zsh treats `[]` as glob patterns
