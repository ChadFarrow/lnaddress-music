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
- [ ] **Create a page showing boosts sent from the app**
  - Display recent boosts with track details
  - Show payment amounts and timestamps
  - Link to Nostr boost notes
  - Track receipt status
  - Pull from local storage and Nostr relays

- [ ] **Improve boost UI layout**
  - Optimize mobile responsiveness
  - Better spacing and alignment
  - Streamline boost workflow

## Completed Features

### 🎵 Boostagram System (January 2025)
- ✅ **Implement Boostagrams** - Full 250-character message support with Lightning payments
- ✅ **Add Sender Name support** - Persistent sender names with localStorage, included in boost metadata
- ✅ **Custom boost amounts** - User-defined amounts with input validation and preset suggestions
- ✅ **GUID tagging for Nostr posts** - Comprehensive podcast namespace GUID metadata for discovery
- ✅ **Compact boost UI** - Streamlined interface with consolidated controls and reduced whitespace
- ✅ **Message integration** - Boostagrams included in Lightning TLV records and Nostr boost posts

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