# ITDV Lightning TODO

## Upcoming Features

### 🔋 Lightning & Payments
- [ ] **Add LNURL test feed to the application**
  - Integrate test feed for LNURL payment testing
  - Ensure proper payment flow validation

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

## Completed Features
- ✅ **GUID data loading for album detail pages** - Fixed RSS parsing to include proper podcast namespace GUIDs
- ✅ **Clean boost note formatting** - Removed JSON blob from boost content while preserving metadata in tags

---

*Last updated: $(date)*