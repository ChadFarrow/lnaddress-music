# Keysend Bridge Setup Guide

## Overview
The Keysend Bridge allows wallets that don't natively support keysend payments (like Coinos, Wallet of Satoshi, Strike) to make them through your Alby Hub. This enables TSB and other non-keysend wallets to pay podcasters and artists who receive payments via node public keys.

## How It Works
1. User connects their non-keysend wallet (e.g., Coinos) via NWC
2. System detects the wallet doesn't support keysend
3. Your Alby Hub acts as a bridge:
   - Creates an invoice for the payment amount
   - User's wallet pays the invoice
   - Alby Hub forwards the payment as keysend to the recipient

## Setup Instructions

### Step 1: Get Your Alby Hub NWC Connection String
1. Open your Alby Hub dashboard
2. Navigate to **Apps → Connections**
3. Click **"Create New Connection"**
4. Give it a name like "ITDV Keysend Bridge"
5. Set appropriate permissions (needs payment capabilities)
6. Copy the NWC connection string (starts with `nostr+walletconnect://`)

### Step 2: Configure the Bridge (Secure Method)
1. Open your `.env.local` file (create it if it doesn't exist)
2. Add your Alby Hub connection string:
   ```bash
   ALBY_HUB_BRIDGE_NWC=nostr+walletconnect://YOUR_ACTUAL_CONNECTION_STRING_HERE
   ```
3. Make sure `.env.local` is in your `.gitignore` (it should be by default)
4. Restart your development server to load the new environment variable

### Step 3: Test the Bridge
1. Connect a non-keysend wallet like Coinos
2. Try making a boost payment to a podcast
3. Check the console logs for "🌉 Using keysend bridge" messages
4. Verify the payment goes through

## Supported Wallets

### Wallets That DON'T Support Keysend (Will Use Bridge):
- Coinos
- Wallet of Satoshi
- Strike
- Cash App
- Zebedee

### Wallets That Support Keysend Natively (Won't Need Bridge):
- Alby
- Zeus
- Breez
- Phoenix
- Mutiny
- Umbrel
- LNbits
- Start9

## Important Notes
- Your Alby Hub needs sufficient balance to relay payments
- The bridge adds a small delay to payments (invoice generation + forwarding)
- All boost metadata (messages, sender name, etc.) is preserved through the bridge
- The bridge only activates for wallets that don't support keysend

## Troubleshooting
- **Bridge not connecting**: Check your Alby Hub connection string is correct in `.env.local`
- **Payments failing**: Ensure your Alby Hub has sufficient balance
- **Bridge not activating**: Check that `ALBY_HUB_BRIDGE_NWC` is set in `.env.local` and server was restarted
- **Console errors**: Look for "⚠️ Keysend bridge not configured" messages
- **Environment variable not loading**: Restart the dev server after adding to `.env.local`

## Security Considerations
- The Alby Hub connection string contains sensitive credentials
- Never commit the actual connection string to public repositories
- Consider using environment variables for production deployments
- The bridge connection is only used for relaying payments, not for receiving funds