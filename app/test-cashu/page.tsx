'use client';

import { useState, useEffect } from 'react';
import { BitcoinConnectWallet, BitcoinConnectPayment } from '@/components/BitcoinConnect';
import { useBitcoinConnect } from '@/contexts/BitcoinConnectContext';
import { Zap, Info, CheckCircle, XCircle } from 'lucide-react';

export default function TestCashuPage() {
  const [paymentAmount, setPaymentAmount] = useState(100);
  const [paymentResults, setPaymentResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { isConnected } = useBitcoinConnect();
  const [connectionInfo, setConnectionInfo] = useState<any>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<any>(null);
  const [walletType, setWalletType] = useState<'cashu' | 'other' | null>(null);

  useEffect(() => {
    // Check for NWC connection info
    const checkConnection = () => {
      const bcConfig = localStorage.getItem('bc:config');
      const nwcUrl = localStorage.getItem('nwc_connection_string');
      const connectorType = localStorage.getItem('bc:connectorType');
      
      // Log all bitcoin connect related localStorage items
      console.log('🔍 Cashu Test - localStorage debug:', {
        bcConnectorType: connectorType,
        hasNwcConnectionString: !!nwcUrl,
        hasBcConfig: !!bcConfig,
        allBcKeys: Object.keys(localStorage).filter(k => k.startsWith('bc:') || k.includes('nwc') || k.includes('cashu')),
      });
      
      let parsedConfig = null;
      try {
        if (bcConfig) {
          parsedConfig = JSON.parse(bcConfig);
          console.log('🔍 Parsed bc:config:', parsedConfig);
        }
      } catch (e) {
        console.error('Failed to parse bc:config:', e);
      }
      
      // Check all possible NWC URL locations (Cashu.me might store it differently)
      const nwcConnection = nwcUrl || parsedConfig?.nwcUrl || parsedConfig?.nwcConnectionString;
      
      // Check if it's a Cashu.me connection
      const isCashuConnected = connectorType === 'nwc.cashume' || 
                              parsedConfig?.connectorType === 'nwc.cashume' ||
                              connectorType === 'nwc.cashu' ||
                              parsedConfig?.connectorType === 'nwc.cashu' ||
                              (nwcConnection && (nwcConnection.includes('cashu') || nwcConnection.includes('mint')));
      
      // Set wallet type for UI warnings
      if (isCashuConnected) {
        setWalletType('cashu');
      } else if (nwcConnection) {
        setWalletType('other');
      } else {
        setWalletType(null);
      }

      // Try to get NWC service status
      let nwcServiceStatus = 'unknown';
      try {
        // Check if service is already loaded globally
        if (typeof window !== 'undefined' && (window as any).__nwcService) {
          nwcServiceStatus = (window as any).__nwcService.isConnected() ? 'connected' : 'disconnected';
        }
      } catch (e) {
        console.error('Failed to check NWC service:', e);
      }

      setConnectionInfo({
        connectorType: parsedConfig?.connectorType || connectorType,
        hasNWC: !!nwcConnection || isCashuConnected,
        nwcUrl: nwcConnection ? nwcConnection.substring(0, 50) + '...' : (isCashuConnected ? 'Cashu.me Connected' : null),
        webln: !!(window as any).webln,
        weblnEnabled: !!(window as any).webln?.enabled,
        isCashu: isCashuConnected,
        nwcServiceStatus,
      });
    };

    checkConnection();
    const interval = setInterval(checkConnection, 2000);
    return () => clearInterval(interval);
  }, []);

  const handlePaymentSuccess = (response: any) => {
    console.log('✅ Payment successful:', response);
    setPaymentResults([...paymentResults, { success: true, response, timestamp: Date.now() }]);
    setError(null);
  };

  const handlePaymentError = (errorMessage: string) => {
    console.error('❌ Payment failed:', errorMessage);
    // Try to extract more details about the error
    console.log('🔍 Error details:', {
      errorMessage,
      localStorage: {
        bcConnectorType: localStorage.getItem('bc:connectorType'),
        hasNWC: !!localStorage.getItem('nwc_connection_string'),
      },
      webln: !!(window as any).webln,
      weblnEnabled: !!(window as any).webln?.enabled,
    });
    setPaymentResults([...paymentResults, { success: false, error: errorMessage, timestamp: Date.now() }]);
    setError(errorMessage);
  };

  const testNWCConnection = async () => {
    setTestingConnection(true);
    setConnectionTestResult(null);
    try {
      // Check multiple locations for the NWC connection string
      let nwcString = localStorage.getItem('nwc_connection_string');
      
      // Also check bc:config for Cashu.me connections
      if (!nwcString) {
        const bcConfig = localStorage.getItem('bc:config');
        if (bcConfig) {
          try {
            const parsedConfig = JSON.parse(bcConfig);
            nwcString = parsedConfig?.nwcUrl;
          } catch (e) {
            console.error('Failed to parse bc:config:', e);
          }
        }
      }
      
      if (!nwcString) {
        throw new Error('No NWC connection string found. Please connect your Cashu.me wallet first.');
      }
      
      console.log('🔍 Found NWC connection string in:', nwcString === localStorage.getItem('nwc_connection_string') ? 'nwc_connection_string' : 'bc:config');

      // Use dynamic import with proper error handling
      let nwcService;
      try {
        const nwcModule = await import('../../lib/nwc-service');
        nwcService = nwcModule.getNWCService();
      } catch (importError) {
        console.error('❌ Failed to import NWC service:', importError);
        throw new Error('Failed to load NWC service module');
      }
      
      console.log('🔌 Testing NWC connection...');
      await nwcService.connect(nwcString);
      
      console.log('📊 Getting wallet info...');
      const info = await nwcService.getInfo();
      
      if (info.error) {
        throw new Error(info.error);
      }
      
      // Check if this is a Cashu wallet
      const isCashu = nwcService.isCashu();
      
      console.log('✅ NWC connection successful:', info);
      setConnectionTestResult({ 
        success: true, 
        info,
        isCashu,
        walletType: isCashu ? 'Cashu Wallet' : 'Lightning Wallet'
      });
    } catch (error) {
      console.error('❌ NWC connection test failed:', error);
      setConnectionTestResult({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setTestingConnection(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-black text-white p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 text-transparent bg-clip-text">
            Cashu.me Wallet Test
          </h1>
          <p className="text-gray-300">Test Bitcoin Connect with Cashu.me NWC Integration</p>
        </div>

        {/* Instructions Card */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 space-y-4 border border-white/20">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Info className="w-6 h-6 text-blue-400" />
            How to Connect Cashu.me
          </h2>
          <ol className="space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-yellow-400 font-bold">1.</span>
              <span>Visit <a href="https://wallet.cashu.me" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">wallet.cashu.me</a> and create or access your wallet</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-400 font-bold">2.</span>
              <span>In Cashu.me, go to Settings → Connections → Nostr Wallet Connect (NWC)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-400 font-bold">3.</span>
              <span>Click "Generate New Connection" or use existing NWC connection string</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-400 font-bold">4.</span>
              <span>Copy the NWC connection string (starts with nostr+walletconnect://)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-400 font-bold">5.</span>
              <span>Click the Bitcoin Connect button below and select "Nostr Wallet Connect"</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-400 font-bold">6.</span>
              <span>Paste your Cashu.me NWC connection string</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-400 font-bold">7.</span>
              <span>Click Connect and start testing payments!</span>
            </li>
          </ol>
          
          <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <p className="text-sm text-yellow-300">
              <strong>Note:</strong> Cashu.me is an ecash wallet that provides Lightning compatibility through NWC. 
              Payments are processed through the Cashu mint's Lightning node.
            </p>
          </div>
        </div>

        {/* Connection Section */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 space-y-4 border border-white/20">
          <h2 className="text-2xl font-semibold">Wallet Connection</h2>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <BitcoinConnectWallet />
              <div className="text-sm">
                {isConnected ? (
                  <span className="flex items-center gap-2 text-green-400">
                    <CheckCircle className="w-4 h-4" />
                    Wallet Connected
                  </span>
                ) : (
                  <span className="flex items-center gap-2 text-gray-400">
                    <XCircle className="w-4 h-4" />
                    Not Connected
                  </span>
                )}
              </div>
            </div>
          </div>

          {connectionInfo && (
            <div className="mt-4 p-4 bg-black/30 rounded-lg font-mono text-xs space-y-1">
              <div>Connector Type: {connectionInfo.connectorType || 'none'}</div>
              {connectionInfo.isCashu && (
                <div className="text-green-400 font-bold">✅ Cashu.me Wallet Connected!</div>
              )}
              <div>NWC Available: {connectionInfo.hasNWC ? 'Yes' : 'No'}</div>
              <div>NWC Service Status: {connectionInfo.nwcServiceStatus}</div>
              <div>WebLN: {connectionInfo.webln ? 'Available' : 'Not Available'}</div>
              <div>WebLN Enabled: {connectionInfo.weblnEnabled ? 'Yes' : 'No'}</div>
              {connectionInfo.nwcUrl && (
                <div className="break-all">NWC: {connectionInfo.nwcUrl}</div>
              )}
            </div>
          )}

          {/* Manual Connection Test */}
          <div className="mt-4">
            <button
              onClick={testNWCConnection}
              disabled={testingConnection}
              className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-600 text-black rounded-lg font-semibold transition-colors"
            >
              {testingConnection ? 'Testing...' : 'Test NWC Connection'}
            </button>
          </div>

          {connectionTestResult && (
            <div className={`mt-4 p-4 rounded-lg ${connectionTestResult.success ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
              <div className="font-mono text-xs">
                {connectionTestResult.success ? (
                  <>
                    <div className="text-green-400 font-bold mb-2">✅ Connection Successful!</div>
                    <pre className="whitespace-pre-wrap">{JSON.stringify(connectionTestResult.info, null, 2)}</pre>
                  </>
                ) : (
                  <>
                    <div className="text-red-400 font-bold mb-2">❌ Connection Failed</div>
                    <div>{connectionTestResult.error}</div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Cashu Wallet Limitations Warning */}
        {walletType === 'cashu' && (
          <div className="bg-orange-500/10 backdrop-blur-md rounded-xl p-6 space-y-4 border border-orange-500/30">
            <h2 className="text-2xl font-semibold flex items-center gap-2 text-orange-400">
              <Info className="w-6 h-6" />
              Cashu Wallet Limitations
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <span className="text-orange-400 text-lg">⚠️</span>
                <div>
                  <strong>Keysend Payments Not Supported:</strong> Cashu wallets cannot send keysend payments (direct payments without invoices). 
                  Lightning address payments work by converting them to invoices first.
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-orange-400 text-lg">🐌</span>
                <div>
                  <strong>Slower Performance:</strong> Cashu wallets may be slower than traditional Lightning wallets due to 
                  ecash protocol requirements and relay communication overhead.
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-orange-400 text-lg">📡</span>
                <div>
                  <strong>Relay Dependencies:</strong> Cashu NWC relies on Nostr relays which may sometimes be unreliable. 
                  Connection errors are normal and the system will retry automatically.
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-400 text-lg">💡</span>
                <div>
                  <strong>Best Use Cases:</strong> Lightning address payments and invoice-based payments work well.
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-400 text-lg">🌉</span>
                <div>
                  <strong>Bridge Support:</strong> Keysend payments can work through an Alby Hub bridge service, 
                  allowing full podcast compatibility. The bridge converts keysend to invoice payments automatically.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Payment Test Section */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 space-y-4 border border-white/20">
          <h2 className="text-2xl font-semibold">Test Payment</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Amount (sats)</label>
              <input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-2 bg-black/30 border border-white/20 rounded-lg focus:outline-none focus:border-yellow-400"
                min="1"
                max="10000"
              />
            </div>

            <div className="flex gap-4">
              {/* Test Lightning Address Payment to Minibits */}
              <BitcoinConnectPayment
                amount={paymentAmount}
                description="Test Cashu.me → Minibits Payment"
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
                className="flex-1"
                recipients={[
                  { 
                    address: 'seatedglide692@minibits.cash',
                    split: 100,
                    name: 'Minibits Test',
                    type: 'lnaddress'
                  }
                ]}
              />

              {/* Test Manual Payment Button */}
              <button
                onClick={async () => {
                  try {
                    console.log('🔌 Testing manual payment...');
                    const nwcModule = await import('../../lib/nwc-service');
                    const nwcService = nwcModule.getNWCService();
                    
                    const result = await nwcService.payLightningAddress(
                      'seatedglide692@minibits.cash',
                      paymentAmount,
                      'Test payment from Cashu.me wallet'
                    );
                    
                    if (result.error) {
                      handlePaymentError(result.error);
                    } else {
                      handlePaymentSuccess(result);
                    }
                  } catch (error) {
                    handlePaymentError(error instanceof Error ? error.message : 'Manual payment failed');
                  }
                }}
                className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold transition-colors"
              >
                Manual Payment Test
              </button>
            </div>

            {/* Test Split Payment with Minibits */}
            <BitcoinConnectPayment
              amount={paymentAmount}
              description="Test Cashu.me Split Payment"
              onSuccess={handlePaymentSuccess}
              onError={handlePaymentError}
              recipients={[
                { 
                  address: 'seatedglide692@minibits.cash',
                  split: 70,
                  name: 'Minibits (Lightning Address)',
                  type: 'lnaddress'
                },
                { 
                  address: '03740ea02585ed87b83b2f76317a4562b616bd7b8ec3f925be6596932b2003fc9e',
                  split: 30,
                  name: 'ITDV (Keysend)',
                  type: 'node'
                }
              ]}
            />
          </div>

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Results Section */}
        {paymentResults.length > 0 && (
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 space-y-4 border border-white/20">
            <h2 className="text-2xl font-semibold">Payment Results</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {paymentResults.map((result, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg text-sm font-mono ${
                    result.success 
                      ? 'bg-green-500/10 border border-green-500/30' 
                      : 'bg-red-500/10 border border-red-500/30'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {result.success ? (
                      <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1 break-all">
                      <div className="font-semibold">
                        {result.success ? 'Success' : 'Failed'} - {new Date(result.timestamp).toLocaleTimeString()}
                      </div>
                      <pre className="text-xs mt-2 whitespace-pre-wrap">
                        {JSON.stringify(result.success ? result.response : result.error, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Technical Details */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 space-y-4 border border-white/20">
          <h2 className="text-2xl font-semibold">Technical Information</h2>
          <div className="space-y-3 text-sm text-gray-300">
            <p>
              <strong>Cashu.me</strong> is an ecash wallet that uses the Cashu protocol for privacy-preserving transactions.
            </p>
            <p>
              <strong>NWC (Nostr Wallet Connect)</strong> allows Cashu.me to interact with Lightning-enabled apps through a secure connection string.
            </p>
            <p>
              <strong>Bitcoin Connect</strong> provides a unified interface for connecting various wallet types including NWC-compatible wallets.
            </p>
            <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <p className="text-blue-300">
                <strong>Privacy Note:</strong> Cashu transactions provide enhanced privacy through blind signatures. 
                The mint cannot link payments to users or see transaction details.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}