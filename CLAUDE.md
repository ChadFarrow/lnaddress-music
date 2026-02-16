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
npm run test-feeds       # Validate RSS feeds in feeds.json
npm run clear-cache      # Clear RSS feed cache
npm run deploy           # Auto-version PWA + deploy
```

Node.js >= 22.0.0 required (see `.nvmrc`).

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

Multiple wallet backends, all converging through a common payment flow:
- **WebLN** (`lib/webln-service.ts`) — browser extension wallets (Alby)
- **NWC** (`lib/nwc-service.ts`, `hooks/useNWC.ts`) — Nostr Wallet Connect (NIP-47)
- **Breez SDK** (`lib/breez-service.ts`, `hooks/useBreez.ts`) — self-custodial on-device
- **Lightning Address** (`lib/lnurl-service.ts`) — LNURL-pay with LUD-12 comments

Payment recipients come from Podcasting 2.0 `<podcast:value>` tags in RSS feeds, which specify split percentages across multiple recipients. TLV records (`lib/tlv-utils.ts`) encode boost metadata.

After payment, boosts are published to Nostr relays as NIP-57 zaps (`lib/boost-to-nostr-service.ts`).

**BoostBox** (`lib/boostbox-service.ts`) — persistent boost metadata storage via [boostbox.cloud](https://boostbox.cloud). Before each payment, boost metadata is POSTed to BoostBox, which returns a URL. That URL is embedded in the Lightning invoice LUD-12 comment so receiving services can retrieve the full payload. Active by default (defaults to `https://boostbox.cloud` with API key `v4v4me`). Fire-and-forget — failures are logged but never block payments. Integrations in `components/NowPlayingScreen.tsx` (manual boosts) and `utils/payment-utils.ts` (auto-boosts).

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
2. Run `npm run test-feeds` to validate
3. Re-parse feeds to update `data/parsed-feeds.json`

## Environment Variables

Required for dev:
```
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_ENABLE_LIGHTNING=true   # or false for basic mode
JWT_SECRET=<any-secret>
```

Optional BoostBox config (defaults work out of the box):
```
NEXT_PUBLIC_BOOSTBOX_URL=https://boostbox.cloud   # default
NEXT_PUBLIC_BOOSTBOX_API_KEY=v4v4me                # default
```

See `env.lightning.template` and `env.basic.template` for full variable lists. The dev modes (`dev:lightning`/`dev:basic`) copy the appropriate template to `.env.local`.

## Deployment

- **Platform**: Vercel (read-only filesystem, in-memory RSS cache)
- **Cron**: Daily feed refresh at 6 AM UTC (`vercel.json`)
- **PWA**: Auto-versioned via `scripts/auto-version-update.js` on deploy
- **Capacitor**: Android build support via `@capacitor/android` (dev dependency)

## Conventions

- TypeScript throughout, React 18, Next.js 15 App Router
- Tailwind CSS for styling (dark theme, `bg-gray-50` base)
- Image optimization via Next.js Image with 20+ allowed domains in `next.config.js`
- Constants centralized in `lib/constants.ts` (payment amounts, TLV types, storage keys, cache TTLs)
- Heavy use of `dynamic()` imports with `ssr: false` for wallet/payment components
