# LUD-12 Implementation: Comments for Lightning Payments

This document describes the implementation of LUD-12 (LNURL-pay Comments) in the lnaddress-music application.

## What is LUD-12?

LUD-12 allows wallets to send optional comments with Lightning payments, enabling new interaction models like donations with messages. It's an extension to the LNURL-pay protocol that adds a `commentAllowed` field to indicate the maximum comment character length supported by the service.

## Implementation Details

### 1. Service-Side Support (lib/lnurl-service.ts)

The `LNURLResponse` interface now includes:
```typescript
export interface LNURLResponse {
  callback: string;
  maxSendable: number;
  minSendable: number;
  metadata: string;
  tag: string;
  allowsNostr?: boolean;
  nostrPubkey?: string;
  commentAllowed?: number; // LUD-12: Maximum comment length
}
```

### 2. Comment Validation

The service automatically validates comments:
- Checks if comments are supported (`commentAllowed > 0`)
- Validates comment length against the limit
- Includes comments in the callback URL when making payments

### 3. UI Components (components/LightningPayment.tsx)

The payment component now includes:
- Automatic detection of comment support when opening the payment modal
- Dynamic comment input field (only shown when supported)
- Real-time character count and validation
- Integration with all payment methods (NWC, Breez, WebLN)

### 4. Payment Flow Integration

Comments are supported in:
- Manual payments via the LightningPayment component
- Auto-boost payments for music streaming
- All LNURL-based payment flows

## Usage Examples

### Basic Comment Support Check
```typescript
import { LNURLService } from '@/lib/lnurl-service';

// Check if a Lightning address supports comments
const commentInfo = await LNURLService.getCommentInfo('user@domain.com');
console.log('Comments supported:', commentInfo.supported);
console.log('Max length:', commentInfo.maxLength);
```

### Making a Payment with Comment
```typescript
// The service handles comment validation automatically
const invoice = await LNURLService.getPaymentInvoice(
  'user@domain.com',
  1000000, // 1000 sats in millisats
  'Thanks for the great music!' // Comment
);
```

### UI Integration
```tsx
<LightningPayment
  recipientName="Artist Name"
  recipientAddress="artist@domain.com" // Lightning address for LUD-12
  defaultAmount={1000}
  description="Support the artist"
/>
```

## Technical Implementation

### Comment Validation
- Comments are validated both client-side and service-side
- Maximum length is enforced by the `commentAllowed` field
- Empty comments are treated as no comment
- URL length limitations are respected

### Backward Compatibility
- Implementation is fully backward compatible
- Works with existing LNURL endpoints that don't support comments
- Gracefully degrades when comments aren't supported

### Security Considerations
- Comments are sent in URL parameters (as per LUD-12 spec)
- No sensitive information should be included in comments
- Comments are limited by overall URL length constraints

## Testing

To test the LUD-12 implementation:

1. Use a Lightning address from a service that supports LUD-12 comments
2. Open the payment modal in the app
3. Verify that the comment field appears with the correct character limit
4. Test comment validation (try exceeding the limit)
5. Complete a payment with a comment and verify it's received

## Supported Services

The implementation works with any LNURL service that supports LUD-12, including:
- Alby Hub
- LNbits
- BTCPay Server (with LNURL plugin)
- And other LUD-12 compatible services

## Future Enhancements

Potential improvements could include:
- Comment preview/formatting
- Emoji support indicators
- Comment history/templates
- Integration with boost metadata for richer messages