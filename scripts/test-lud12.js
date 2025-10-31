#!/usr/bin/env node

/**
 * Test script for LUD-12 (Comments) implementation
 * This script tests the comment support detection and validation
 */

const { LNURLService } = require('../lib/lnurl-service.ts');

// Test Lightning addresses (some may support comments, others may not)
const testAddresses = [
  'test@getalby.com',
  'hello@lnbits.com',
  // Add more test addresses as needed
];

async function testCommentSupport(address) {
  console.log(`\n🧪 Testing comment support for: ${address}`);
  
  try {
    // Test comment info retrieval
    const commentInfo = await LNURLService.getCommentInfo(address);
    console.log(`  ✅ Comment support: ${commentInfo.supported}`);
    if (commentInfo.supported) {
      console.log(`  📝 Max comment length: ${commentInfo.maxLength} characters`);
    }
    
    // Test LNURL metadata fetch
    const url = LNURLService.decodeLNURL(address);
    const metadata = await LNURLService.fetchLNURLMetadata(url);
    console.log(`  📊 LNURL Response:`);
    console.log(`    - Min sendable: ${metadata.minSendable} msat`);
    console.log(`    - Max sendable: ${metadata.maxSendable} msat`);
    console.log(`    - Comments allowed: ${metadata.commentAllowed || 0}`);
    
    // Test comment validation
    if (commentInfo.supported) {
      console.log(`  🔍 Testing comment validation...`);
      
      // Test valid comment
      const validComment = 'Test comment';
      try {
        await LNURLService.getPaymentInvoice(address, 1000, validComment);
        console.log(`    ✅ Valid comment accepted: "${validComment}"`);
      } catch (error) {
        console.log(`    ❌ Valid comment rejected: ${error.message}`);
      }
      
      // Test comment too long
      if (commentInfo.maxLength > 0) {
        const longComment = 'x'.repeat(commentInfo.maxLength + 1);
        try {
          await LNURLService.getPaymentInvoice(address, 1000, longComment);
          console.log(`    ❌ Long comment should have been rejected`);
        } catch (error) {
          console.log(`    ✅ Long comment properly rejected: ${error.message}`);
        }
      }
    }
    
  } catch (error) {
    console.log(`  ❌ Error testing ${address}: ${error.message}`);
  }
}

async function runTests() {
  console.log('🚀 Starting LUD-12 Comment Support Tests\n');
  console.log('📋 Testing the following capabilities:');
  console.log('  - Comment support detection');
  console.log('  - LNURL metadata parsing');
  console.log('  - Comment validation');
  console.log('  - Error handling');
  
  for (const address of testAddresses) {
    await testCommentSupport(address);
  }
  
  console.log('\n✅ LUD-12 tests completed!');
  console.log('\n💡 To test the UI:');
  console.log('  1. Run the app: npm run dev');
  console.log('  2. Open a payment modal');
  console.log('  3. Use a Lightning address that supports comments');
  console.log('  4. Verify the comment field appears with proper validation');
}

// Run the tests
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testCommentSupport };