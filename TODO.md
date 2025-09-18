# ITDV Lightning TODO

## Upcoming Features

### 🔋 Lightning & Payments
- [ ] **Test non-Alby wallets for Lightning payments**
  - Test WebLN wallets: Zeus, Mutiny, Phoenix
  - Test NWC wallets: Coinos, LNbits, Umbrel
  - Test browser extensions: LN Pay, other WebLN providers
  - Test mobile wallets: Breez, Phoenix, Muun
  - Ensure broad wallet compatibility

- [ ] **Add zap receipts functionality**
  - Implement NIP-57 zap receipt handling
  - Show payment verification
  - Display receipt confirmation
  - Track payment history
  - Enable payment analytics

### 📱 User Interface
- [ ] **Add auto boost when track is finished**
  - Automatic boost trigger at track completion
  - Configurable boost amount and message
  - User preference settings for auto-boost
  - Optional confirmation before auto-boosting


- [ ] **Add tutorial for new users**
  - Interactive onboarding flow
  - Explain Lightning payments and boosts
  - Show how to connect wallets
  - Guide through first boost experience
  - Skip option for returning users

### 📡 Content & Feeds

### 🤝 Partnerships & Outreach
- [ ] **Ask TSB**
  - Reach out to TSB for potential collaboration
  - Discuss integration possibilities
  - Explore partnership opportunities
  - Follow up on discussions

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

### 🔋 Lightning Network Integration
- ✅ **LNURL test feed integration** - Special test album with multiple payment recipients for testing
- ✅ **Multi-recipient payments** - Automatic value splitting to artists, collaborators, and platform
- ✅ **Bitcoin Connect integration** - Full WebLN and NWC wallet support
- ✅ **Lightning address support** - Email-style Lightning payments with LNURL resolution
- ✅ **Performance optimization** - Fixed render loops and removed failing payment recipients

### 📡 Nostr Integration  
- ✅ **NIP-57/NIP-73 boost posts** - Compliant boost notes published to major Nostr relays
- ✅ **GUID data loading for album detail pages** - Fixed RSS parsing to include proper podcast namespace GUIDs
- ✅ **Clean boost note formatting** - Removed JSON blob from boost content while preserving metadata in tags
- ✅ **Podcast metadata tags** - Complete k/i tag pairs for item, feed, and publisher GUIDs
- ✅ **Debug logging** - Comprehensive verification of GUID tag creation in Nostr events

---

*Last updated: $(date)*