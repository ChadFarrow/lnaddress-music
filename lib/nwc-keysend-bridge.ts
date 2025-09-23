/**
 * NWC Keysend Bridge Service
 * 
 * This service enables keysend payments for NWC wallets that don't natively support it
 * (like Coinos) by using Alby Hub as an intermediary bridge.
 * 
 * Flow:
 * 1. User connects their non-keysend NWC wallet (e.g., Coinos)
 * 2. System connects to Alby Hub via NWC for keysend capability
 * 3. When keysend payment is needed:
 *    - Generate invoice from Alby Hub for the keysend amount
 *    - User's wallet pays the invoice
 *    - Alby Hub forwards as keysend to the recipient
 */

import { NWCService } from './nwc-service';
import { getNWCService } from './nwc-service';
import { ALBY_HUB_BRIDGE_CONNECTION, IS_BRIDGE_CONFIGURED, BRIDGE_CONFIG } from './keysend-bridge-config';

export interface KeysendBridgeConfig {
  // Alby Hub NWC connection string for keysend relay (optional, will use hardcoded if not provided)
  albyHubConnection?: string;
  // User's NWC wallet connection (may not support keysend)
  userWalletConnection: string;
}

export interface BridgedKeysendPayment {
  pubkey: string;
  amount: number; // in sats
  tlvRecords?: any;
  description?: string;
}

export class NWCKeysendBridge {
  private userWalletService: NWCService;
  private albyHubService: NWCService | null = null;
  private isAlbyHubConnected: boolean = false;
  private userWalletInfo: any = null;
  private isInitialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;

  constructor() {
    this.userWalletService = new NWCService();
  }

  /**
   * Initialize the bridge with user wallet and optional Alby Hub connection
   */
  async initialize(config: KeysendBridgeConfig): Promise<void> {
    // Prevent concurrent initializations
    if (this.isInitialized) {
      console.log('🔄 Bridge already initialized, skipping...');
      return;
    }
    
    if (this.initializationPromise) {
      console.log('🔄 Bridge initialization in progress, waiting...');
      return this.initializationPromise;
    }
    
    this.initializationPromise = this._doInitialize(config);
    await this.initializationPromise;
    this.initializationPromise = null;
  }

  private async _doInitialize(config: KeysendBridgeConfig): Promise<void> {
    try {
      // For Cashu wallets, be more resilient to connection issues during initialization
      console.log('🔄 Initializing bridge - trying Cashu wallet connection...');
      
      // Try to connect user's wallet, but don't fail bridge init if it has relay issues
      let cashuConnected = false;
      try {
        if (!this.userWalletService.isConnected()) {
          await Promise.race([
            this.userWalletService.connect(config.userWalletConnection),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Cashu connection timeout during init')), 8000)
            )
          ]);
          cashuConnected = true;
          console.log('✅ Cashu wallet connected during bridge init');
        } else {
          console.log('🔄 Reusing existing NWC connection for bridge initialization');
          cashuConnected = true;
        }
      } catch (error) {
        console.log('⚠️ Cashu wallet connection failed during init, but continuing with bridge setup:', error instanceof Error ? error.message : String(error));
      }
      
      // Always set up default wallet info for Cashu wallets, whether connected or not
      this.userWalletInfo = {
        result: { 
          alias: 'Cashu Wallet', 
          methods: ['pay_invoice', 'make_invoice', 'get_balance'] 
        }
      };
      
      // If we connected to Cashu wallet, try to get real wallet info quickly
      if (cashuConnected) {
        try {
          const realWalletInfo = await Promise.race([
            this.userWalletService.getInfo(),
            new Promise((resolve) => setTimeout(() => resolve(null), 2000))
          ]);
          
          if (realWalletInfo?.result?.alias) {
            this.userWalletInfo = realWalletInfo;
            console.log('✅ Got real Cashu wallet info:', this.userWalletInfo.result.alias);
          }
        } catch (error) {
          console.log('⚠️ Using default Cashu wallet profile due to info timeout');
        }
      }
      
      console.log('✅ Connected to user wallet:', this.userWalletInfo);
      console.log('🔍 Wallet supports methods:', this.userWalletInfo?.result?.methods || []);

      // Check if user's wallet supports keysend natively
      const supportsKeysend = this.checkKeysendSupport(this.userWalletInfo);
      
      if (!supportsKeysend) {
        // Get bridge configuration from API (since env vars aren't available client-side)
        try {
          const bridgeConfigResponse = await fetch('/api/bridge-config');
          const bridgeConfig = await bridgeConfigResponse.json();
          
          console.log('🔍 Bridge config response:', bridgeConfig);
          
          if (bridgeConfig.isConfigured && bridgeConfig.connection) {
            const albyHubConnection = config.albyHubConnection || bridgeConfig.connection;
            console.log('🔍 Using Alby Hub connection string:', albyHubConnection.substring(0, 50) + '...');
            
            // Try to connect to Alby Hub with timeout and retry logic
            try {
              this.albyHubService = new NWCService();
              
              // Add timeout wrapper for Alby Hub connection
              await Promise.race([
                this.albyHubService.connect(albyHubConnection),
                new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('Alby Hub connection timeout')), 10000)
                )
              ]);
              
              this.isAlbyHubConnected = true;
              console.log('✅ Connected to Alby Hub bridge for keysend relay');
              console.log('🌉 Bridge will relay keysend payments for non-keysend wallet');
              
            } catch (albyError) {
              console.warn('⚠️ Failed to connect to Alby Hub bridge:', albyError);
              console.log('🔄 Bridge initialization will continue, Alby Hub connection will be retried on payment attempts');
              
              // Don't fail initialization - mark bridge as configured but not connected
              // This allows for retry logic during payment attempts
              this.albyHubService = new NWCService();
              this.isAlbyHubConnected = false;
              
              // Store the connection string for retry attempts
              (this.albyHubService as any)._pendingConnection = albyHubConnection;
            }
          } else {
            console.warn('⚠️ Keysend bridge not configured. Bridge config:', bridgeConfig);
          }
        } catch (error) {
          console.error('Failed to fetch bridge configuration:', error);
        }
      } else {
        console.log('ℹ️ User wallet supports keysend natively, bridge not needed');
      }
      
      this.isInitialized = true;
      console.log('✅ Bridge initialization complete');
    } catch (error) {
      console.error('Failed to initialize keysend bridge:', error);
      this.isInitialized = false;
      throw error;
    }
  }

  /**
   * Retry getting wallet info with proper delays for connection stabilization
   * For Cashu wallets, be more lenient and accept minimal wallet info
   */
  private async retryGetWalletInfo(maxRetries: number = 1, baseDelay: number = 1000): Promise<any> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Add initial delay for connection to stabilize
        if (attempt === 1) {
          await new Promise(resolve => setTimeout(resolve, baseDelay));
        }
        
        const walletInfo = await this.userWalletService.getInfo();
        
        // For Cashu wallets, be more lenient about what constitutes valid info
        if (walletInfo && walletInfo.result) {
          // Accept if we have at least some wallet identification
          if (walletInfo.result.alias || 
              walletInfo.result.methods || 
              walletInfo.result.balance !== undefined ||
              walletInfo.result.currency) {
            console.log(`✅ Got wallet info on attempt ${attempt}:`, {
              alias: walletInfo.result.alias || 'Cashu Wallet',
              methods: walletInfo.result.methods || []
            });
            return walletInfo;
          }
        }
        
        // If we get an error but it's not a connection error, that might be sufficient
        if (walletInfo && walletInfo.error && !walletInfo.error.includes('No response')) {
          console.log(`✅ Wallet responding with error (but connected) on attempt ${attempt}`);
          // Create a minimal valid response
          return {
            result: {
              alias: 'Cashu Wallet',
              methods: ['pay_invoice', 'make_invoice', 'get_balance'],
              currency: 'btc'
            }
          };
        }
        
        console.warn(`⚠️ Attempt ${attempt}: Got incomplete wallet info, retrying...`, walletInfo);
        
        // Shorter delay for Cashu wallets with relay issues
        if (attempt < maxRetries) {
          const delay = baseDelay;
          console.log(`⏳ Waiting ${delay}ms before retry ${attempt + 1}/${maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        console.warn(`⚠️ Attempt ${attempt} failed:`, error);
        
        if (attempt < maxRetries) {
          const delay = baseDelay;
          console.log(`⏳ Waiting ${delay}ms before retry ${attempt + 1}/${maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          // For the final attempt, if it's a Cashu wallet, create a default profile
          console.log('🥜 Creating default Cashu wallet profile for bridge initialization');
          return {
            result: {
              alias: 'Cashu Wallet',
              methods: ['pay_invoice', 'make_invoice', 'get_balance'],
              currency: 'btc'
            }
          };
        }
      }
    }
    
    // Fallback for Cashu wallets
    console.log('🥜 Using fallback Cashu wallet profile');
    return {
      result: {
        alias: 'Cashu Wallet',
        methods: ['pay_invoice', 'make_invoice', 'get_balance'],
        currency: 'btc'
      }
    };
  }

  /**
   * Check if wallet supports invoice payments
   */
  private checkInvoiceSupport(walletInfo: any): boolean {
    if (!walletInfo?.result?.methods || !Array.isArray(walletInfo.result.methods)) {
      return false;
    }
    return walletInfo.result.methods.includes('pay_invoice');
  }

  /**
   * Check if a wallet supports keysend based on wallet info
   */
  private checkKeysendSupport(walletInfo: any): boolean {
    // If no wallet info, assume no keysend support to be safe
    if (!walletInfo) {
      return false;
    }
    
    // Get wallet name first
    const walletName = walletInfo.result?.alias?.toLowerCase() || '';
    
    // Check against known non-keysend wallets FIRST (overrides methods array)
    const isNonKeysendWallet = BRIDGE_CONFIG.nonKeysendWallets.some(wallet => 
      walletName.includes(wallet.toLowerCase())
    );
    
    if (isNonKeysendWallet) {
      console.log(`🚫 Wallet "${walletName}" is configured to use bridge (bypassing native keysend)`);
      return false;
    }
    
    // Check against known keysend wallets
    const isKeysendWallet = BRIDGE_CONFIG.keysendWallets.some(wallet => 
      walletName.includes(wallet.toLowerCase())
    );
    
    if (isKeysendWallet) {
      console.log(`✅ Wallet "${walletName}" supports reliable keysend`);
      return true;
    }
    
    // Fallback: Check methods array for pay_keysend support
    if (walletInfo.result?.methods && Array.isArray(walletInfo.result.methods)) {
      const hasKeysendMethod = walletInfo.result.methods.includes('pay_keysend');
      console.log(`🔍 Wallet "${walletName}" keysend method check: ${hasKeysendMethod}`);
      return hasKeysendMethod;
    }
    
    // Default to no keysend support
    console.log(`❓ Wallet "${walletName}" keysend support unknown, defaulting to no support`);
    return false;
  }

  /**
   * Determine if wallet needs bridged keysend
   */
  needsBridge(): boolean {
    if (!this.userWalletInfo) return false;
    return !this.checkKeysendSupport(this.userWalletInfo) && this.isAlbyHubConnected;
  }

  /**
   * Attempt to connect to Alby Hub if not already connected
   */
  private async ensureAlbyHubConnection(): Promise<boolean> {
    if (this.isAlbyHubConnected) {
      return true;
    }
    
    if (!this.albyHubService) {
      return false;
    }
    
    // Try to connect using stored connection string
    const pendingConnection = (this.albyHubService as any)._pendingConnection;
    if (!pendingConnection) {
      return false;
    }
    
    try {
      console.log('🔄 Retrying Alby Hub connection for payment...');
      await Promise.race([
        this.albyHubService.connect(pendingConnection),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Alby Hub retry timeout')), 8000)
        )
      ]);
      
      this.isAlbyHubConnected = true;
      console.log('✅ Successfully connected to Alby Hub on retry');
      return true;
      
    } catch (error) {
      console.warn('⚠️ Alby Hub retry connection failed:', error);
      return false;
    }
  }

  /**
   * Attempt to reconnect Cashu wallet if needed for payment
   */
  private async ensureCashuConnection(): Promise<boolean> {
    if (this.userWalletService.isConnected()) {
      return true;
    }
    
    // Try to reconnect using stored connection string
    const pendingCashuConnection = (this.userWalletService as any)._pendingConnection;
    if (!pendingCashuConnection) {
      console.log('⚠️ No stored Cashu connection string for retry');
      return false;
    }
    
    try {
      console.log('🔄 Retrying Cashu wallet connection for payment...');
      await Promise.race([
        this.userWalletService.connect(pendingCashuConnection),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Cashu retry timeout')), 8000)
        )
      ]);
      
      console.log('✅ Successfully reconnected to Cashu wallet');
      return true;
      
    } catch (error) {
      console.warn('⚠️ Cashu wallet retry connection failed:', error);
      return false;
    }
  }

  /**
   * Make a keysend payment, using bridge if necessary
   */
  async payKeysend(payment: BridgedKeysendPayment): Promise<{ success: boolean; error?: string; preimage?: string }> {
    try {
      const supportsKeysend = this.checkKeysendSupport(this.userWalletInfo);
      
      if (supportsKeysend) {
        // Direct keysend payment
        console.log('⚡ Making direct keysend payment');
        const result = await this.userWalletService.payKeysend(
          payment.pubkey,
          payment.amount,
          payment.tlvRecords
        );
        
        if (result.error) {
          return { success: false, error: result.error };
        }
        
        return { success: true, preimage: result.preimage };
      } else if (this.albyHubService) {
        // Try to ensure Alby Hub connection (retry if needed)
        const albyConnected = await this.ensureAlbyHubConnection();
        
        if (albyConnected) {
          // Check if wallet supports invoice payments for bridge
          const supportsInvoice = this.checkInvoiceSupport(this.userWalletInfo);
          if (!supportsInvoice) {
            return {
              success: false,
              error: 'Wallet does not support invoice payments required for bridge routing'
            };
          }
          
          // Bridged keysend payment through Alby Hub
          console.log('🌉 Making bridged keysend payment through Alby Hub');
          
          // Step 1: Create invoice from Alby Hub for the amount
          // Convert sats to millisats for NWC make_invoice
          const amountMillisats = payment.amount * 1000;
          const invoiceResult = await this.albyHubService.makeInvoice(
            amountMillisats,
            payment.description || `Keysend bridge payment to ${payment.pubkey.substring(0, 8)}...`
          );
          
          if (invoiceResult.error || !invoiceResult.invoice) {
            return { success: false, error: invoiceResult.error || 'Failed to create bridge invoice' };
          }
          
          console.log(`📝 Bridge: Created ${payment.amount} sat invoice for ${payment.description || 'payment'}`);
          
          // Step 2: User's wallet pays the invoice
          const paymentResult = await this.userWalletService.payInvoice(invoiceResult.invoice);
          
          if (paymentResult.error) {
            if (paymentResult.error === "No response from wallet") {
              console.log(`⚡ Bridge: ${payment.amount} sats → Alby Hub (timeout, assuming success)`);
              // Reduced wait time for faster bridge processing
              await new Promise(resolve => setTimeout(resolve, 500));
            } else {
              console.error(`❌ Bridge: Payment failed - ${paymentResult.error}`);
              return { success: false, error: paymentResult.error };
            }
          } else {
            console.log(`⚡ Bridge: ${payment.amount} sats → Alby Hub (confirmed)`);
          }
          
          // Step 3: Alby Hub sends keysend to final recipient with TLV records
          console.log(`🏷️ Bridge: Forwarding ${payment.tlvRecords?.length || 0} TLV records for boost metadata`);
          const keysendResult = await this.albyHubService.payKeysend(
            payment.pubkey,
            payment.amount,
            payment.tlvRecords // Forward TLV records for podcast boost metadata
          );
          
          if (keysendResult.error) {
            console.error(`❌ Bridge: Keysend ${payment.amount} sats → ${payment.pubkey.substring(0, 8)}... FAILED: ${keysendResult.error}`);
            return { 
              success: false, 
              error: `Bridge payment succeeded but keysend forward failed: ${keysendResult.error}` 
            };
          }
          
          console.log(`✅ Bridge: ${payment.amount} sats → ${payment.pubkey.substring(0, 8)}... SUCCESS`);
          
          return { success: true, preimage: keysendResult.preimage };
        } else {
          return { 
            success: false, 
            error: 'Bridge configuration available but Alby Hub connection failed. Try again in a moment.' 
          };
        }
      } else {
        return { 
          success: false, 
          error: 'Wallet does not support keysend and no bridge is configured' 
        };
      }
    } catch (error) {
      console.error('Keysend payment failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Get wallet capabilities
   */
  getCapabilities(): {
    supportsKeysend: boolean;
    hasBridge: boolean;
    walletName?: string;
    methods?: string[];
  } {
    const supportsKeysend = this.checkKeysendSupport(this.userWalletInfo);
    
    return {
      supportsKeysend,
      hasBridge: this.isAlbyHubConnected,
      walletName: this.userWalletInfo?.result?.alias || 'Unknown',
      methods: this.userWalletInfo?.result?.methods || []
    };
  }

  /**
   * Disconnect all services
   */
  disconnect(): void {
    this.userWalletService.disconnect();
    if (this.albyHubService) {
      this.albyHubService.disconnect();
    }
    this.isAlbyHubConnected = false;
    this.userWalletInfo = null;
  }
}

// Singleton instance
let keysendBridge: NWCKeysendBridge | null = null;

export function getKeysendBridge(): NWCKeysendBridge {
  if (!keysendBridge) {
    keysendBridge = new NWCKeysendBridge();
  }
  return keysendBridge;
}