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
      // Connect user's wallet
      await this.userWalletService.connect(config.userWalletConnection);
      this.userWalletInfo = await this.userWalletService.getInfo();
      
      console.log('✅ Connected to user wallet:', this.userWalletInfo);
      console.log('🔍 Wallet supports methods:', this.userWalletInfo?.result?.methods || []);

      // Check if user's wallet supports keysend natively
      const supportsKeysend = this.checkKeysendSupport(this.userWalletInfo);
      
      if (!supportsKeysend) {
        // Get bridge configuration from API (since env vars aren't available client-side)
        try {
          const bridgeConfigResponse = await fetch('/api/bridge-config');
          const bridgeConfig = await bridgeConfigResponse.json();
          
          if (bridgeConfig.isConfigured && bridgeConfig.connection) {
            const albyHubConnection = config.albyHubConnection || bridgeConfig.connection;
            
            this.albyHubService = new NWCService();
            await this.albyHubService.connect(albyHubConnection);
            this.isAlbyHubConnected = true;
            
            console.log('✅ Connected to Alby Hub bridge for keysend relay');
            console.log('🌉 Bridge will relay keysend payments for non-keysend wallet');
          } else {
            console.warn('⚠️ Keysend bridge not configured. Check ALBY_HUB_BRIDGE_NWC in .env.local');
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
      } else if (this.isAlbyHubConnected && this.albyHubService) {
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
            console.log(`⚡ Bridge: ${payment.amount} sats → Alby Hub (Primal timeout, payment likely succeeded)`);
            await new Promise(resolve => setTimeout(resolve, 1500)); // Wait for settlement
          } else {
            console.error(`❌ Bridge: Payment failed - ${paymentResult.error}`);
            return { success: false, error: paymentResult.error };
          }
        } else {
          console.log(`⚡ Bridge: ${payment.amount} sats → Alby Hub (confirmed)`);
        }
        
        // Step 3: Alby Hub sends keysend to final recipient
        const keysendResult = await this.albyHubService.payKeysend(
          payment.pubkey,
          payment.amount,
          payment.tlvRecords
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