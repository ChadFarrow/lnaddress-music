import type { BreezSdk, ConnectRequest, SendPaymentRequest, ReceivePaymentRequest, GetInfoResponse, Payment, Config, Network, Seed, EventListener, SdkEvent, LnurlPayRequestDetails } from '@breeztech/breez-sdk-spark/web';
import type { Event as NostrEvent } from 'nostr-tools';

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

export interface BreezZapRequest {
  destination: string;  // Lightning Address or LNURL
  amountSats: number;
  recipientPubkey: string;  // Nostr pubkey of recipient
  comment?: string;
  relays?: string[];
  track?: {
    title?: string;
    artist?: string;
    album?: string;
    guid?: string;
    feedGuid?: string;
    publisherGuid?: string;
    feedUrl?: string;
    publisherUrl?: string;
  };
}

export interface ZapCheckResult {
  supportsZaps: boolean;
  nostrPubkey?: string;
  minSendable?: number;
  maxSendable?: number;
  commentAllowed?: number;
}

class BreezService {
  private sdk: BreezSdk | null = null;
  private initialized: boolean = false;
  private connecting: boolean = false;
  private connectPromise: Promise<void> | null = null;
  private config: BreezConfig | null = null;
  private eventListenerId: string | null = null;

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

      const { connect, defaultConfig } = breezSDK;

      if (!connect || !defaultConfig) {
        throw new Error('Breez SDK connect or defaultConfig function not found');
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
   * Show recovery phrase modal with styled UI
   */
  private showRecoveryPhraseModal(mnemonic: string): void {
    const words = mnemonic.split(' ');

    // Create modal overlay
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-300';

    modal.innerHTML = `
      <div class="bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-yellow-500/50 rounded-2xl p-6 max-w-2xl w-full shadow-2xl animate-in zoom-in-95 duration-300">
        <!-- Header -->
        <div class="flex items-center gap-3 mb-6">
          <div class="w-12 h-12 bg-yellow-500/20 rounded-full flex items-center justify-center">
            <svg class="w-7 h-7 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
            </svg>
          </div>
          <div>
            <h2 class="text-2xl font-bold text-white">New Wallet Created!</h2>
            <p class="text-gray-400 text-sm">Your self-custodial Lightning wallet is ready</p>
          </div>
        </div>

        <!-- Warning Banner -->
        <div class="bg-red-900/30 border-2 border-red-500/50 rounded-xl p-4 mb-6">
          <div class="flex items-start gap-3">
            <svg class="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
            </svg>
            <div>
              <p class="font-bold text-red-200 text-sm mb-1">⚠️ CRITICAL: Save These Words Immediately!</p>
              <p class="text-red-200 text-xs">These 12 words are the ONLY way to recover your wallet. Write them down on paper and store them in a safe place. Do NOT take a screenshot or save digitally!</p>
            </div>
          </div>
        </div>

        <!-- Recovery Phrase -->
        <div class="mb-6">
          <label class="block text-gray-300 text-sm font-semibold mb-3">Your Recovery Phrase:</label>
          <div class="bg-black/40 border border-gray-700 rounded-xl p-4">
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              ${words.map((word, i) => `
                <div class="bg-gray-800/50 border border-purple-500/30 rounded-lg px-3 py-2 flex items-center gap-2">
                  <span class="text-gray-500 text-xs font-mono w-6">${i + 1}.</span>
                  <span class="text-white font-medium text-sm">${word}</span>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Copy Button -->
          <button
            onclick="navigator.clipboard.writeText('${mnemonic}').then(() => {
              this.innerHTML = '<svg class=\\'w-4 h-4\\' fill=\\'currentColor\\' viewBox=\\'0 0 20 20\\'><path fill-rule=\\'evenodd\\' d=\\'M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z\\' clip-rule=\\'evenodd\\'></path></svg> Copied!';
              setTimeout(() => this.innerHTML = '<svg class=\\'w-4 h-4\\' fill=\\'none\\' stroke=\\'currentColor\\' viewBox=\\'0 0 24 24\\'><path stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\' stroke-width=\\'2\\' d=\\'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z\\'></path></svg> Copy to Clipboard', 2000);
            })"
            class="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm font-medium"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
            </svg>
            Copy to Clipboard
          </button>
        </div>

        <!-- Confirmation Checkbox -->
        <div class="mb-6">
          <label class="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              id="confirm-saved"
              class="mt-1 w-5 h-5 rounded border-2 border-purple-500 bg-gray-800 checked:bg-purple-600 checked:border-purple-600 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900 cursor-pointer"
            />
            <span class="text-gray-300 text-sm group-hover:text-white transition-colors">
              I have written down my 12-word recovery phrase and stored it in a safe place. I understand that losing these words means losing access to my funds forever.
            </span>
          </label>
        </div>

        <!-- Close Button -->
        <button
          id="close-recovery-modal"
          disabled
          class="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors shadow-lg disabled:opacity-50"
        >
          I've Saved My Recovery Phrase
        </button>
      </div>
    `;

    document.body.appendChild(modal);

    // Enable close button when checkbox is checked
    const checkbox = modal.querySelector('#confirm-saved') as HTMLInputElement;
    const closeBtn = modal.querySelector('#close-recovery-modal') as HTMLButtonElement;

    checkbox?.addEventListener('change', () => {
      closeBtn.disabled = !checkbox.checked;
    });

    // Close modal
    closeBtn?.addEventListener('click', () => {
      modal.classList.add('animate-out', 'fade-out', 'duration-200');
      setTimeout(() => modal.remove(), 200);
    });
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

      // Modal disabled - mnemonic is logged to console and stored in localStorage
      // Users can access it via console or their saved wallet in the database
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

      // Use the parse method on the SDK instance
      const inputType = await this.sdk.parse(request.destination);
      console.log('✅ Parsed input type:', inputType.type);
      console.log('🔍 Full parsed object:', JSON.stringify(inputType, null, 2));

      // Handle Lightning Address / LNURL-Pay separately
      if (inputType.type === 'lnurlPay' || inputType.type === 'lightningAddress') {
        console.log('💡 Detected LNURL-Pay - using LNURL payment flow');

        // For lightningAddress type, the payRequest is in inputType.payRequest
        // For lnurlPay type, inputType itself contains the LnurlPayRequestDetails
        const payRequestData = inputType.type === 'lightningAddress'
          ? inputType.payRequest
          : inputType;
        console.log('🔍 Using payRequest data:', JSON.stringify(payRequestData, null, 2));

        // Prepare LNURL payment with the parsed payRequest
        const prepareLnurlRequest = {
          payRequest: payRequestData,
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

  /**
   * LNURL-Withdraw support (new in v0.3.4)
   * Process a withdraw request from an LNURL service
   * Note: Method names may not be finalized in this SDK version
   */
  async lnurlWithdraw(lnurlWithdrawUrl: string, description?: string): Promise<Payment> {
    if (!this.sdk) {
      throw new Error('Not connected to Breez SDK');
    }

    // TODO: LNURL-Withdraw support will be added when method names are confirmed in SDK
    throw new Error('LNURL-Withdraw support not yet available in this SDK version');
  }

  /**
   * Sign a message (new in v0.3.4)
   * Sign arbitrary messages for authentication or verification
   */
  async signMessage(message: string): Promise<{ signature: string; recoveryId: number }> {
    if (!this.sdk) {
      throw new Error('Not connected to Breez SDK');
    }

    try {
      console.log('🔐 Signing message:', message);
      
      const signRequest = {
        message,
        compact: true // Use compact signature format
      };

      const signResponse = await this.sdk.signMessage(signRequest);
      console.log('✅ Message signed successfully');

      return {
        signature: signResponse.signature,
        recoveryId: 0 // Recovery ID not available in current SDK version
      };
    } catch (error) {
      console.error('❌ Failed to sign message:', error);
      throw error;
    }
  }

  /**
   * Verify a message signature (new in v0.3.4)
   * Verify that a message was signed by a specific public key
   */
  async checkMessage(message: string, pubkey: string, signature: string): Promise<boolean> {
    if (!this.sdk) {
      throw new Error('Not connected to Breez SDK');
    }

    try {
      console.log('🔍 Verifying message signature');
      console.log('Message:', message);
      console.log('Public key:', pubkey);
      console.log('Signature:', signature);

      const checkRequest = {
        message,
        pubkey,
        signature
      };

      const checkResponse = await this.sdk.checkMessage(checkRequest);
      console.log('✅ Message verification result:', checkResponse.isValid);

      return checkResponse.isValid;
    } catch (error) {
      console.error('❌ Failed to verify message:', error);
      throw error;
    }
  }

  /**
   * Check if a Lightning Address or LNURL supports Nostr zaps (NIP-57)
   * Returns zap support info including the recipient's Nostr pubkey
   */
  async checkZapSupport(destination: string): Promise<ZapCheckResult> {
    if (!this.sdk) {
      throw new Error('Not connected to Breez SDK');
    }

    try {
      console.log('🔍 Checking zap support for:', destination);

      // Parse the destination to get LNURL details
      const inputType = await this.sdk.parse(destination);

      if (inputType.type === 'lnurlPay' || inputType.type === 'lightningAddress') {
        const payRequest: LnurlPayRequestDetails = inputType.type === 'lightningAddress'
          ? (inputType as any).payRequest
          : inputType as unknown as LnurlPayRequestDetails;

        const result: ZapCheckResult = {
          supportsZaps: !!(payRequest.allowsNostr && payRequest.nostrPubkey),
          nostrPubkey: payRequest.nostrPubkey,
          minSendable: payRequest.minSendable,
          maxSendable: payRequest.maxSendable,
          commentAllowed: payRequest.commentAllowed
        };

        console.log('⚡ Zap support check result:', result);
        return result;
      }

      // Not an LNURL/Lightning Address - no zap support
      return { supportsZaps: false };
    } catch (error) {
      console.error('❌ Failed to check zap support:', error);
      return { supportsZaps: false };
    }
  }

  /**
   * Send a Nostr zap (NIP-57) via Breez SDK
   * Creates a zap request, gets invoice with nostr param, and pays it
   *
   * @param request - Zap request parameters
   * @param zapRequestEvent - Pre-created NIP-57 Kind 9734 event (optional - will create if not provided)
   * @returns Payment result with zap metadata
   */
  async sendZap(
    request: BreezZapRequest,
    zapRequestEvent?: NostrEvent
  ): Promise<{ payment: Payment; zapRequest?: NostrEvent }> {
    if (!this.sdk) {
      throw new Error('Not connected to Breez SDK');
    }

    try {
      console.log('⚡ Starting Nostr zap flow:', {
        destination: request.destination,
        amount: request.amountSats,
        recipientPubkey: request.recipientPubkey?.slice(0, 16) + '...'
      });

      // 1. Parse destination to check zap support
      const inputType = await this.sdk.parse(request.destination);

      if (inputType.type !== 'lnurlPay' && inputType.type !== 'lightningAddress') {
        throw new Error('Zaps only supported for Lightning Addresses and LNURL-Pay');
      }

      const payRequest: LnurlPayRequestDetails = inputType.type === 'lightningAddress'
        ? (inputType as any).payRequest
        : inputType as unknown as LnurlPayRequestDetails;

      // 2. Check if zaps are supported
      if (!payRequest.allowsNostr) {
        console.warn('⚠️ Recipient does not support Nostr zaps, falling back to regular payment');
        // Fall back to regular LNURL payment
        const payment = await this.sendPayment({
          destination: request.destination,
          amountSats: request.amountSats,
          message: request.comment
        });
        return { payment };
      }

      // 3. Import LNURLService for zap invoice
      const { LNURLService } = await import('./lnurl-service');

      // 4. If no zap request provided, create one
      let finalZapRequest = zapRequestEvent;
      if (!finalZapRequest) {
        console.log('📝 Creating zap request event...');
        const { getBoostToNostrService } = await import('./boost-to-nostr-service');
        const boostService = getBoostToNostrService(request.relays);

        // Generate keys if not available
        if (!boostService.hasKeys()) {
          console.log('🔑 Generating keys for zap request...');
          boostService.generateKeys();
        }

        const zapResult = await boostService.createZapRequest({
          amount: request.amountSats * 1000, // Convert to millisats
          recipientPubkey: request.recipientPubkey,
          comment: request.comment,
          relays: request.relays || [
            'wss://relay.damus.io',
            'wss://relay.nostr.band',
            'wss://relay.primal.net'
          ],
          track: request.track
        });

        if (!zapResult) {
          throw new Error('Failed to create zap request');
        }

        finalZapRequest = zapResult.event;
      }

      console.log('📝 Zap request created:', finalZapRequest.id);

      // 5. Get invoice with zap request attached
      console.log('🔄 Getting zap invoice...');
      const invoice = await LNURLService.getZapInvoice(
        request.destination,
        request.amountSats * 1000, // millisats
        finalZapRequest,
        request.comment
      );

      console.log('✅ Got zap invoice, paying via Breez SDK...');

      // 6. Pay the invoice using Breez SDK
      const prepareRequest = {
        paymentRequest: invoice
      };

      const prepareResponse = await this.sdk.prepareSendPayment(prepareRequest);

      const sendRequest: SendPaymentRequest = {
        prepareResponse
      };

      const sendResponse = await this.sdk.sendPayment(sendRequest);

      console.log('✅ Zap payment completed:', sendResponse.payment.id);

      return {
        payment: sendResponse.payment,
        zapRequest: finalZapRequest
      };
    } catch (error) {
      console.error('❌ Failed to send zap:', error);
      throw error;
    }
  }

  /**
   * Send payment with optional zap support
   * Automatically uses zaps if recipient supports it and Nostr params provided
   */
  async sendPaymentWithZap(
    request: BreezPaymentRequest & {
      recipientPubkey?: string;
      relays?: string[];
      track?: BreezZapRequest['track'];
    }
  ): Promise<{ payment: Payment; isZap: boolean; zapRequest?: NostrEvent }> {
    // If no recipient pubkey provided, use regular payment
    if (!request.recipientPubkey) {
      const payment = await this.sendPayment(request);
      return { payment, isZap: false };
    }

    // Check if destination supports zaps
    const zapSupport = await this.checkZapSupport(request.destination);

    if (zapSupport.supportsZaps && zapSupport.nostrPubkey) {
      // Use zap flow
      const result = await this.sendZap({
        destination: request.destination,
        amountSats: request.amountSats,
        recipientPubkey: zapSupport.nostrPubkey, // Use the pubkey from LNURL
        comment: request.message,
        relays: request.relays,
        track: request.track
      });

      return {
        payment: result.payment,
        isZap: true,
        zapRequest: result.zapRequest
      };
    }

    // Fall back to regular payment
    const payment = await this.sendPayment(request);
    return { payment, isZap: false };
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
