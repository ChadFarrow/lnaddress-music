import type { BreezSdk, ConnectRequest, SendPaymentRequest, ReceivePaymentRequest, GetInfoResponse, Payment, Config, Network, Seed } from '@breeztech/breez-sdk-spark/web';

/**
 * Breez SDK Spark Service
 * Provides integration with Breez SDK for self-custodial Lightning payments
 */

export interface BreezConfig {
  apiKey: string;
  network?: 'mainnet' | 'regtest';
  mnemonic?: string;
  storageDir?: string;
}

export interface BreezPaymentRequest {
  destination: string;  // Invoice, Lightning Address, Spark Address, etc.
  amountSats: number;
  label?: string;
  message?: string;
}

export interface BreezInvoiceRequest {
  amountSats: number;
  description?: string;
  expiry?: number;
}

class BreezService {
  private sdk: BreezSdk | null = null;
  private initialized: boolean = false;
  private connecting: boolean = false;
  private config: BreezConfig | null = null;

  /**
   * Initialize and connect to Breez SDK
   */
  async connect(config: BreezConfig): Promise<void> {
    if (this.connecting) {
      throw new Error('Connection already in progress');
    }

    if (this.isConnected()) {
      console.log('Already connected to Breez SDK');
      return;
    }

    this.connecting = true;
    this.config = config;

    try {
      const { connect, defaultConfig, defaultStorage } = await import('@breeztech/breez-sdk-spark/web');

      // Set up storage directory
      const storageDir = config.storageDir || './breez-sdk-data';

      // Create default config for the network
      const network: Network = config.network === 'regtest' ? 'regtest' : 'mainnet';
      const sdkConfig: Config = defaultConfig(network);

      // Set API key if provided
      if (config.apiKey) {
        (sdkConfig as any).apiKey = config.apiKey;
      }

      // Create seed from mnemonic or generate new one
      const seed: Seed = config.mnemonic
        ? { type: 'mnemonic', mnemonic: config.mnemonic }
        : await this.generateSeed();

      // Connect to Breez SDK
      const connectRequest: ConnectRequest = {
        config: sdkConfig,
        seed,
        storageDir
      };

      this.sdk = await connect(connectRequest);
      this.initialized = true;

      console.log('✅ Connected to Breez SDK Spark');

      // Store connection info in localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('breez:connected', 'true');
        localStorage.setItem('breez:config', JSON.stringify({
          network: config.network,
          apiKey: config.apiKey
        }));
        if (config.mnemonic) {
          // Note: In production, you'd want to encrypt this or use secure storage
          localStorage.setItem('breez:mnemonic', config.mnemonic);
        }
      }

    } catch (error) {
      console.error('Failed to connect to Breez SDK:', error);
      this.sdk = null;
      this.initialized = false;
      throw error;
    } finally {
      this.connecting = false;
    }
  }

  /**
   * Generate a new mnemonic seed
   */
  private async generateSeed(): Promise<Seed> {
    // For now, we'll require a mnemonic to be provided
    // In a full implementation, you'd generate one securely
    throw new Error('Mnemonic seed required. Please provide a mnemonic in the config.');
  }

  /**
   * Disconnect from Breez SDK
   */
  async disconnect(): Promise<void> {
    if (!this.sdk) {
      return;
    }

    try {
      await this.sdk.disconnect();
      this.sdk = null;
      this.initialized = false;

      if (typeof window !== 'undefined') {
        localStorage.removeItem('breez:connected');
        localStorage.removeItem('breez:config');
        localStorage.removeItem('breez:mnemonic');
      }

      console.log('Disconnected from Breez SDK');
    } catch (error) {
      console.error('Error disconnecting from Breez SDK:', error);
      throw error;
    }
  }

  /**
   * Check if connected to Breez SDK
   */
  isConnected(): boolean {
    return this.initialized && this.sdk !== null;
  }

  /**
   * Get wallet info
   */
  async getInfo(): Promise<GetInfoResponse> {
    if (!this.sdk) {
      throw new Error('Not connected to Breez SDK');
    }

    return await this.sdk.getInfo({});
  }

  /**
   * Get balance in sats
   */
  async getBalance(): Promise<number> {
    const info = await this.getInfo();
    return info.balanceSats;
  }

  /**
   * Send a payment
   */
  async sendPayment(request: BreezPaymentRequest): Promise<Payment> {
    if (!this.sdk) {
      throw new Error('Not connected to Breez SDK');
    }

    try {
      // Parse the destination to determine the payment type
      const { parse } = await import('@breeztech/breez-sdk-spark/web');
      const inputType = await parse(request.destination);

      // Prepare the payment
      const prepareRequest = {
        paymentRequest: request.destination,
        amount: BigInt(request.amountSats)
      };

      const prepareResponse = await this.sdk.prepareSendPayment(prepareRequest);

      // Send the payment
      const sendRequest: SendPaymentRequest = {
        prepareResponse
      };

      const sendResponse = await this.sdk.sendPayment(sendRequest);

      console.log('✅ Payment sent via Breez SDK:', sendResponse.payment.id);

      return sendResponse.payment;
    } catch (error) {
      console.error('Failed to send payment via Breez SDK:', error);
      throw error;
    }
  }

  /**
   * Receive a payment (create invoice)
   */
  async receivePayment(request: BreezInvoiceRequest): Promise<string> {
    if (!this.sdk) {
      throw new Error('Not connected to Breez SDK');
    }

    try {
      const receiveRequest: ReceivePaymentRequest = {
        paymentMethod: {
          type: 'bolt11Invoice',
          description: request.description || 'Lightning payment',
          amountSats: request.amountSats
        }
      };

      const response = await this.sdk.receivePayment(receiveRequest);

      console.log('✅ Invoice created via Breez SDK');

      return response.paymentRequest;
    } catch (error) {
      console.error('Failed to create invoice via Breez SDK:', error);
      throw error;
    }
  }

  /**
   * Sync wallet with the network
   */
  async syncWallet(): Promise<void> {
    if (!this.sdk) {
      throw new Error('Not connected to Breez SDK');
    }

    try {
      await this.sdk.syncWallet({});
      console.log('✅ Wallet synced');
    } catch (error) {
      console.error('Failed to sync wallet:', error);
      throw error;
    }
  }

  /**
   * List payments
   */
  async listPayments(filters?: { offset?: number; limit?: number }): Promise<Payment[]> {
    if (!this.sdk) {
      throw new Error('Not connected to Breez SDK');
    }

    try {
      const response = await this.sdk.listPayments({
        offset: filters?.offset,
        limit: filters?.limit
      });

      return response.payments;
    } catch (error) {
      console.error('Failed to list payments:', error);
      throw error;
    }
  }

  /**
   * Get stored config from localStorage
   */
  static getStoredConfig(): BreezConfig | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const isConnected = localStorage.getItem('breez:connected');
    if (!isConnected) {
      return null;
    }

    const configStr = localStorage.getItem('breez:config');
    const mnemonic = localStorage.getItem('breez:mnemonic');

    if (!configStr) {
      return null;
    }

    try {
      const config = JSON.parse(configStr);
      return {
        ...config,
        mnemonic: mnemonic || undefined
      };
    } catch {
      return null;
    }
  }

  /**
   * Check if Breez is stored as connected
   */
  static isStoredAsConnected(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    return localStorage.getItem('breez:connected') === 'true';
  }
}

// Singleton instance
let breezServiceInstance: BreezService | null = null;

/**
 * Get the Breez service singleton instance
 */
export function getBreezService(): BreezService {
  if (!breezServiceInstance) {
    breezServiceInstance = new BreezService();
  }
  return breezServiceInstance;
}

export default BreezService;
