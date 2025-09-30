# HPM Lightning TODO

## Upcoming Features

### 🔋 Lightning & Payments

### 📱 User Interface
- [ ] **Add tutorial for new users**
  - Interactive onboarding flow
  - Explain Lightning payments and boosts
  - Show how to connect wallets
  - Guide through first boost experience
  - Skip option for returning users

### 📡 Content & Feeds

### 🤝 Partnerships & Outreach

## Completed Features

### 🎨 UI/UX Improvements (September 2025)
- ✅ **Boost Modal Popup System** - Replaced inline boost forms with elegant popup modals
- ✅ **Album Artwork Headers** - Beautiful artwork headers in all boost modals (album, track, main page)
- ✅ **Mobile-Centered Modals** - Optimized modal positioning for mobile devices
- ✅ **Track Boost Artwork** - Individual track artwork display in track boost modals
- ✅ **Consistent Modal Design** - Unified design language across all boost interfaces
- ✅ **Performance Optimizations** - Reduced page load times from 17+ seconds to ~12 seconds
- ✅ **Parallel API Loading** - Non-blocking external API calls with proper timeouts
- ✅ **System Resource Cleanup** - Eliminated multiple accumulated Next.js servers
- ✅ **iOS Safe Area Padding** - Enhanced iOS Safari safe area handling with progressive enhancement
- ✅ **Opus Album Integration** - Added Manchester State Fair Battle of the Bands Champions album with full Lightning support

### 🎵 Boostagram System (January 2025)
- ✅ **Implement Boostagrams** - Full 250-character message support with Lightning payments
- ✅ **Add Sender Name support** - Persistent sender names with localStorage, included in boost metadata
- ✅ **Custom boost amounts** - User-defined amounts with input validation and preset suggestions
- ✅ **GUID tagging for Nostr posts** - Comprehensive podcast namespace GUID metadata for discovery
- ✅ **Compact boost UI** - Streamlined interface with consolidated controls and reduced whitespace
- ✅ **Message integration** - Boostagrams included in Lightning TLV records and Nostr boost posts
- ✅ **Boosts Page** - Comprehensive page displaying all boosts sent from the app with Nostr replies, user profiles, and mobile-optimized layout
- ✅ **Auto boost on track completion** - Automatic 25-sat boost payments when tracks finish playing, with configurable sender names and seamless NWC/WebLN integration

### 🔋 Lightning Network Integration
- ✅ **LNURL test feed integration** - Special test album with multiple payment recipients for testing
- ✅ **Multi-recipient payments** - Automatic value splitting to artists, collaborators, and platform
- ✅ **Bitcoin Connect integration** - Full WebLN and NWC wallet support
- ✅ **Lightning address support** - Email-style Lightning payments with LNURL resolution
- ✅ **Performance optimization** - Fixed render loops and removed failing payment recipients
- ✅ **Non-Alby wallet compatibility** - Tested and verified WebLN wallets (Zeus, Mutiny, Phoenix), NWC wallets (Coinos, LNbits, Umbrel), browser extensions, and mobile wallets for broad compatibility
- ✅ **Zap receipts functionality** - Complete NIP-57 zap receipt handling with payment verification, receipt confirmation, authenticity verification, and integration with boost posting system

### 📡 Nostr Integration  
- ✅ **NIP-57/NIP-73 boost posts** - Compliant boost notes published to major Nostr relays
- ✅ **GUID data loading for album detail pages** - Fixed RSS parsing to include proper podcast namespace GUIDs
- ✅ **Clean boost note formatting** - Removed JSON blob from boost content while preserving metadata in tags
- ✅ **Podcast metadata tags** - Complete k/i tag pairs for item, feed, and publisher GUIDs
- ✅ **Debug logging** - Comprehensive verification of GUID tag creation in Nostr events

### 🤝 Partnerships & Outreach
- ✅ **TSB collaboration** - Reached out to TSB for potential collaboration, discussed integration possibilities, explored partnership opportunities, and completed follow-up discussions

---

*Last updated: $(date)*