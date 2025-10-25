import type { BreezSdk, ConnectRequest, SendPaymentRequest, ReceivePaymentRequest, GetInfoResponse, Payment, Config, Network, Seed, EventListener, SdkEvent } from '@breeztech/breez-sdk-spark/web';

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
  private connectPromise: Promise<void> | null = null;
  private config: BreezConfig | null = null;
  private eventListenerId: string | null = null;
  private parseFunction: ((input: string) => Promise<any>) | null = null;

  /**
   * Initialize and connect to Breez SDK
   */
  async connect(config: BreezConfig): Promise<void> {
    // If already connected, return immediately
    if (this.isConnected()) {
      console.log('✅ Already connected to Breez SDK');
      return;
    }

    // If connection is in progress, wait for it to complete
    if (this.connecting && this.connectPromise) {
      console.log('⏳ Connection already in progress, waiting...');
      return this.connectPromise;
    }

    this.connecting = true;
    this.config = config;

    // Store the connection promise so concurrent calls can wait for it
    this.connectPromise = this._performConnect(config);

    try {
      await this.connectPromise;
    } finally {
      this.connecting = false;
      this.connectPromise = null;
    }
  }

  /**
   * Internal method to perform the actual connection
   */
  private async _performConnect(config: BreezConfig): Promise<void> {
    try {
      // Import and initialize Breez SDK WASM module
      const breezSDK = await import('@breeztech/breez-sdk-spark/web');
      const initBreezSDK = breezSDK.default;

      // Initialize the WASM module first
      console.log('🔧 Initializing Breez SDK WASM module...');
      await initBreezSDK();
      console.log('✅ Breez SDK WASM initialized');

      const { connect, defaultConfig, parse } = breezSDK;

      if (!connect || !defaultConfig) {
        throw new Error('Breez SDK connect or defaultConfig function not found');
      }

      // Store the parse function for later use
      if (parse) {
        this.parseFunction = parse;
      }

      // Set up storage directory
      const storageDir = config.storageDir || './breez-sdk-data';

      // Create default config for the network
      const network: Network = config.network === 'regtest' ? 'regtest' : 'mainnet';
      const sdkConfig: Config = defaultConfig(network);

      // Set API key if provided
      if (config.apiKey) {
        sdkConfig.apiKey = config.apiKey;
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

      // Set up event listener for payment events
      await this.setupEventListener();

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

        // Dispatch event to notify components that Breez is connected
        window.dispatchEvent(new CustomEvent('breez:connected', {
          detail: { walletType: 'breez' }
        }));
        console.log('📢 Dispatched breez:connected event');
      }

    } catch (error) {
      console.error('❌ Failed to connect to Breez SDK:', error);
      this.sdk = null;
      this.initialized = false;
      throw error;
    }
  }

  /**
   * Generate a new mnemonic seed
   */
  private async generateSeed(): Promise<Seed> {
    // Generate a new random 12-word mnemonic using BIP39
    const { generateMnemonic } = await import('bip39');
    const mnemonic = generateMnemonic();

    console.log('🔐 Generated new wallet mnemonic - SAVE THIS SECURELY!');
    console.log('Mnemonic:', mnemonic);
    console.log('⚠️ IMPORTANT: Write down these 12 words and store them safely!');

    // Store in localStorage as a backup (user should also save it manually)
    if (typeof window !== 'undefined') {
      localStorage.setItem('breez:generated-mnemonic', mnemonic);
      // Also show an alert to the user
      alert(`🔐 NEW WALLET CREATED!\n\nYour recovery phrase:\n${mnemonic}\n\n⚠️ SAVE THESE 12 WORDS IMMEDIATELY!\nYou need them to recover your wallet.`);
    }

    return { type: 'mnemonic', mnemonic };
  }

  /**
   * Set up event listener for Breez SDK events
   */
  private async setupEventListener(): Promise<void> {
    if (!this.sdk) {
      return;
    }

    try {
      const eventListener: EventListener = {
        onEvent: (event: SdkEvent) => {
          console.log('📢 Breez SDK Event:', event.type);

          if (event.type === 'paymentSucceeded') {
            console.log('✅ Payment succeeded:', event.payment.id);
            console.log('💳 Payment type:', event.payment.paymentType);
            console.log('📊 Payment status:', event.payment.status);
            const amountSats = Number(event.payment.amount);
            console.log('💰 Payment amount:', amountSats, 'sats');

            // Only dispatch event for INCOMING payments (receive type)
            if (event.payment.paymentType === 'receive') {
              console.log('📥 INCOMING payment detected!');

              // Dispatch custom event to notify UI components to refresh balance
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('breez:payment-received', {
                  detail: {
                    payment: event.payment,
                    amount: amountSats
                  }
                }));
                console.log('📢 Dispatched breez:payment-received event');
              }
            } else {
              console.log('📤 Outgoing payment (send) - not dispatching event');
            }
          } else if (event.type === 'paymentFailed') {
            console.log('❌ Payment failed:', event.payment.id);
          } else if (event.type === 'synced') {
            console.log('🔄 Wallet synced');
          }
        }
      };

      this.eventListenerId = await this.sdk.addEventListener(eventListener);
      console.log('✅ Event listener registered with ID:', this.eventListenerId);
    } catch (error) {
      console.error('❌ Failed to set up event listener:', error);
    }
  }

  /**
   * Disconnect from Breez SDK
   */
  async disconnect(): Promise<void> {
    try {
      if (this.sdk) {
        // Remove event listener if registered
        if (this.eventListenerId) {
          try {
            await this.sdk.removeEventListener(this.eventListenerId);
            console.log('✅ Event listener removed');
          } catch (err) {
            console.error('❌ Failed to remove event listener:', err);
          }
        }

        await this.sdk.disconnect();
      }
    } catch (error) {
      console.error('Error disconnecting SDK:', error);
      // Continue with cleanup even if SDK disconnect fails
    } finally {
      // Always clean up state
      this.sdk = null;
      this.initialized = false;
      this.connecting = false;
      this.connectPromise = null;
      this.eventListenerId = null;

      if (typeof window !== 'undefined') {
        localStorage.removeItem('breez:connected');
        localStorage.removeItem('breez:config');
        localStorage.removeItem('breez:mnemonic');
        localStorage.removeItem('breez:generated-mnemonic');
        console.log('✅ Cleared all Breez localStorage data');
      }

      console.log('✅ Disconnected from Breez SDK');
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
    console.log('🔍 Full Breez getInfo() response:', JSON.stringify(info, null, 2));
    return info.balanceSats;
  }

  /**
   * Check if wallet has sufficient funds for a payment
   * Note: Breez SDK Spark doesn't provide maxPayable, so we use balance as approximation
   */
  async canPay(amountSats: number): Promise<{ canPay: boolean; balance: number; message?: string }> {
    const info = await this.getInfo();
    // For Breez SDK Spark, we approximate with balance since maxPayable isn't available
    const canPay = amountSats <= info.balanceSats;

    return {
      canPay,
      balance: info.balanceSats,
      message: canPay ? undefined : `Insufficient funds. Need ${amountSats} sats but balance is ${info.balanceSats} sats`
    };
  }

  /**
   * Send a payment
   */
  async sendPayment(request: BreezPaymentRequest): Promise<Payment> {
    if (!this.sdk) {
      throw new Error('Not connected to Breez SDK');
    }

    try {
      // Parse the destination to get input type
      console.log('🔍 Parsing payment destination:', request.destination);

      if (!this.parseFunction) {
        throw new Error('Parse function not available. SDK may not be fully initialized.');
      }

      const inputType = await this.parseFunction(request.destination);
      console.log('✅ Parsed input type:', inputType.type);

      // Handle Lightning Address / LNURL-Pay separately
      if (inputType.type === 'lnurlPay' || inputType.type === 'lightningAddress') {
        console.log('💡 Detected LNURL-Pay - using LNURL payment flow');

        // Prepare LNURL payment with the parsed payRequest
        const prepareLnurlRequest = {
          payRequest: inputType.data,
          amountSats: request.amountSats,
          comment: request.message || '',
          // Disable strict success action URL validation to allow payments to services like Fountain
          // that use different domains for success actions (which is safe and common)
          validateSuccessActionUrl: false
        };

        console.log('📤 Preparing LNURL payment:', prepareLnurlRequest);
        const prepareLnurlResponse = await this.sdk.prepareLnurlPay(prepareLnurlRequest);
        console.log('✅ LNURL payment prepared:', prepareLnurlResponse);

        // Execute LNURL payment
        const lnurlPayRequest = {
          prepareResponse: prepareLnurlResponse
        };

        const lnurlPayResponse = await this.sdk.lnurlPay(lnurlPayRequest);
        console.log('✅ LNURL payment sent:', lnurlPayResponse);

        return lnurlPayResponse.payment;
      } else {
        // Regular invoice payment
        console.log('💡 Using regular invoice payment flow');

        const prepareRequest = {
          paymentRequest: request.destination,
          amount: BigInt(request.amountSats)
        };

        console.log('📤 Preparing payment with request:', prepareRequest);
        const prepareResponse = await this.sdk.prepareSendPayment(prepareRequest);
        console.log('✅ Payment prepared:', prepareResponse);

        // Send the payment
        const sendRequest: SendPaymentRequest = {
          prepareResponse
        };

        const sendResponse = await this.sdk.sendPayment(sendRequest);
        console.log('✅ Payment sent via Breez SDK:', sendResponse.payment.id);

        return sendResponse.payment;
      }
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
