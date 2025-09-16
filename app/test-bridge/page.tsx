'use client';

import { useState } from 'react';
import { getKeysendBridge } from '@/lib/nwc-keysend-bridge';
import { getNWCService } from '@/lib/nwc-service';

export default function TestBridgePage() {
  const [results, setResults] = useState<string[]>([]);
  const [nwcConnection, setNwcConnection] = useState('');

  const addResult = (message: string) => {
    setResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  // Test 1: Basic NWC Connection & Wallet Info
  const testWalletConnection = async () => {
    try {
      addResult('🔄 Testing wallet connection...');
      const nwcService = getNWCService();
      
      if (!nwcConnection) {
        addResult('❌ Please enter NWC connection string first');
        return;
      }

      await nwcService.connect(nwcConnection);
      const walletInfo = await nwcService.getInfo();
      
      addResult(`✅ Connected to wallet: ${walletInfo.result?.alias || 'Unknown'}`);
      addResult(`🔍 Wallet methods: ${JSON.stringify(walletInfo.result?.methods || [])}`);
    } catch (error) {
      addResult(`❌ Wallet connection failed: ${error}`);
    }
  };

  // Test 2: Check Wallet Balance
  const testWalletBalance = async () => {
    try {
      addResult('🔄 Testing wallet balance...');
      const nwcService = getNWCService();
      
      if (!nwcService.isConnected()) {
        addResult('❌ Wallet not connected. Run connection test first.');
        return;
      }

      const balanceResult = await nwcService.getBalance();
      
      if (balanceResult.error) {
        addResult(`❌ Balance check failed: ${balanceResult.error}`);
      } else {
        addResult(`💰 Wallet balance: ${balanceResult.balance || 'Unknown'} sats`);
      }
    } catch (error) {
      addResult(`❌ Balance check threw error: ${error}`);
    }
  };

  // Test 3: Test Alby Hub Connection
  const testAlbyHubConnection = async () => {
    try {
      addResult('🔄 Testing Alby Hub connection...');
      
      // Get bridge configuration
      const bridgeConfigResponse = await fetch('/api/bridge-config');
      const bridgeConfig = await bridgeConfigResponse.json();
      
      if (!bridgeConfig.isConfigured) {
        addResult('❌ Alby Hub bridge not configured in environment');
        return;
      }

      const nwcService = getNWCService();
      await nwcService.connect(bridgeConfig.connection);
      const albyInfo = await nwcService.getInfo();
      
      addResult(`✅ Connected to Alby Hub: ${albyInfo.result?.alias || 'Unknown'}`);
      addResult(`🔍 Alby Hub methods: ${JSON.stringify(albyInfo.result?.methods || [])}`);
    } catch (error) {
      addResult(`❌ Alby Hub connection failed: ${error}`);
    }
  };

  // Test 4: Test Invoice Creation (Alby Hub)
  const testInvoiceCreation = async () => {
    try {
      addResult('🔄 Testing invoice creation...');
      
      const bridgeConfigResponse = await fetch('/api/bridge-config');
      const bridgeConfig = await bridgeConfigResponse.json();
      
      if (!bridgeConfig.isConfigured) {
        addResult('❌ Alby Hub bridge not configured');
        return;
      }

      const nwcService = getNWCService();
      await nwcService.connect(bridgeConfig.connection);
      
      const testAmount = 10; // 10 sats
      const invoiceResult = await nwcService.makeInvoice(testAmount * 1000, 'Test bridge invoice');
      
      if (invoiceResult.error) {
        addResult(`❌ Invoice creation failed: ${invoiceResult.error}`);
      } else {
        addResult(`✅ Created test invoice for ${testAmount} sats`);
        addResult(`📄 Invoice: ${invoiceResult.invoice?.substring(0, 50)}...`);
      }
    } catch (error) {
      addResult(`❌ Invoice creation threw error: ${error}`);
    }
  };

  // Test 5: Test Invoice Payment (User Wallet)
  const testInvoicePayment = async () => {
    try {
      addResult('🔄 Testing invoice payment...');
      
      if (!nwcConnection) {
        addResult('❌ Please enter NWC connection string first');
        return;
      }

      // First create an invoice with Alby Hub
      const bridgeConfigResponse = await fetch('/api/bridge-config');
      const bridgeConfig = await bridgeConfigResponse.json();
      
      if (!bridgeConfig.isConfigured) {
        addResult('❌ Alby Hub bridge not configured');
        return;
      }

      const albyService = getNWCService();
      await albyService.connect(bridgeConfig.connection);
      
      const testAmount = 5; // 5 sats
      const invoiceResult = await albyService.makeInvoice(testAmount * 1000, 'Test payment via bridge');
      
      if (invoiceResult.error || !invoiceResult.invoice) {
        addResult(`❌ Failed to create test invoice: ${invoiceResult.error}`);
        return;
      }

      addResult(`📝 Created test invoice for ${testAmount} sats`);

      // Now try to pay it with user wallet
      const userService = getNWCService();
      await userService.connect(nwcConnection);
      
      const paymentResult = await userService.payInvoice(invoiceResult.invoice);
      
      if (paymentResult.error) {
        addResult(`❌ Invoice payment failed: ${paymentResult.error}`);
        addResult(`🔍 Full payment result: ${JSON.stringify(paymentResult)}`);
      } else {
        addResult(`✅ Successfully paid ${testAmount} sat test invoice!`);
        addResult(`🔍 Payment preimage: ${paymentResult.preimage?.substring(0, 20)}...`);
      }
    } catch (error) {
      addResult(`❌ Invoice payment threw error: ${error}`);
    }
  };

  // Test 6: Full Bridge Flow
  const testFullBridge = async () => {
    try {
      addResult('🔄 Testing full bridge flow...');
      
      if (!nwcConnection) {
        addResult('❌ Please enter NWC connection string first');
        return;
      }

      const bridge = getKeysendBridge();
      await bridge.initialize({ userWalletConnection: nwcConnection });
      
      const capabilities = bridge.getCapabilities();
      addResult(`🔍 Bridge capabilities: ${JSON.stringify(capabilities)}`);
      
      if (!capabilities.hasBridge) {
        addResult('❌ Bridge not properly initialized');
        return;
      }

      // Test keysend payment
      const testPubkey = '031ce2f133b570edf1c776e571e27d22a715dc6ea73956f0e79f4272d81d9dc0d5';
      const testAmount = 3;
      
      const result = await bridge.payKeysend({
        pubkey: testPubkey,
        amount: testAmount,
        description: 'Test bridge keysend payment'
      });
      
      if (result.success) {
        addResult(`✅ Full bridge flow successful! Amount: ${testAmount} sats`);
        addResult(`🔍 Preimage: ${result.preimage?.substring(0, 20)}...`);
      } else {
        addResult(`❌ Bridge flow failed: ${result.error}`);
      }
    } catch (error) {
      addResult(`❌ Full bridge test threw error: ${error}`);
    }
  };

  const clearResults = () => setResults([]);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">🌉 Keysend Bridge Testing</h1>
      
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">
          NWC Connection String (Your Wallet):
        </label>
        <input
          type="text"
          value={nwcConnection}
          onChange={(e) => setNwcConnection(e.target.value)}
          placeholder="nostr+walletconnect://..."
          className="w-full p-2 border rounded-md text-sm"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <button
          onClick={testWalletConnection}
          className="p-3 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          1. Test Wallet Connection
        </button>
        
        <button
          onClick={testWalletBalance}
          className="p-3 bg-green-500 text-white rounded-md hover:bg-green-600"
        >
          2. Check Wallet Balance
        </button>
        
        <button
          onClick={testAlbyHubConnection}
          className="p-3 bg-purple-500 text-white rounded-md hover:bg-purple-600"
        >
          3. Test Alby Hub Connection
        </button>
        
        <button
          onClick={testInvoiceCreation}
          className="p-3 bg-orange-500 text-white rounded-md hover:bg-orange-600"
        >
          4. Test Invoice Creation
        </button>
        
        <button
          onClick={testInvoicePayment}
          className="p-3 bg-red-500 text-white rounded-md hover:bg-red-600"
        >
          5. Test Invoice Payment
        </button>
        
        <button
          onClick={testFullBridge}
          className="p-3 bg-indigo-500 text-white rounded-md hover:bg-indigo-600"
        >
          6. Test Full Bridge Flow
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          onClick={clearResults}
          className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
        >
          Clear Results
        </button>
      </div>

      <div className="bg-black text-green-400 p-4 rounded-md font-mono text-sm max-h-96 overflow-y-auto">
        <h3 className="text-white mb-2">Test Results:</h3>
        {results.length === 0 ? (
          <p className="text-gray-400">No tests run yet. Click a test button above.</p>
        ) : (
          results.map((result, index) => (
            <div key={index} className="mb-1">
              {result}
            </div>
          ))
        )}
      </div>

      <div className="mt-6 p-4 bg-gray-100 rounded-md text-sm">
        <h3 className="font-semibold mb-2">Testing Guide:</h3>
        <ol className="list-decimal list-inside space-y-1">
          <li>Enter your Primal NWC connection string above</li>
          <li>Run tests in order (1-6) to isolate any issues</li>
          <li>Test 5 specifically tests if Primal can pay invoices</li>
          <li>Watch the console for detailed error messages</li>
        </ol>
      </div>
    </div>
  );
}