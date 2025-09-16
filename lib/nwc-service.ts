import { 
  SimplePool, 
  finalizeEvent, 
  generateSecretKey, 
  getPublicKey,
  nip04,
  type Event,
  type EventTemplate
} from 'nostr-tools';

export interface NWCConnection {
  relay: string;
  walletPubkey: string;
  secret: Uint8Array;
  publicKey: string;
}

export interface PaymentRequest {
  invoice: string;
  amount?: number;
  description?: string;
}

export interface PaymentResponse {
  preimage?: string;
  error?: string;
}

export interface BalanceResponse {
  balance?: number;
  error?: string;
}

export class NWCService {
  private pool: SimplePool;
  private connection: NWCConnection | null = null;
  private relays: string[] = [];

  constructor() {
    this.pool = new SimplePool();
  }

  /**
   * Parse NWC connection string (nostr+walletconnect://...)
   */
  parseConnectionString(connectionString: string): NWCConnection {
    console.log('🔍 Parsing connection string:', connectionString.substring(0, 50) + '...');
    const url = new URL(connectionString);
    
    if (!url.protocol.startsWith('nostr+walletconnect:')) {
      throw new Error('Invalid NWC connection string');
    }

    const walletPubkey = url.hostname || url.pathname.replace('//', '');
    const params = new URLSearchParams(url.search);
    
    const relay = params.get('relay');
    const secret = params.get('secret');
    
    console.log('🔍 Parsed params:', { relay, secret: secret ? secret.substring(0, 10) + '...' : null, walletPubkey });
    
    if (!relay || !secret || !walletPubkey) {
      throw new Error(`Missing required NWC parameters: relay=${!!relay}, secret=${!!secret}, walletPubkey=${!!walletPubkey}`);
    }

    const secretKey = Uint8Array.from(
      secret.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
    );
    
    return {
      relay,
      walletPubkey,
      secret: secretKey,
      publicKey: getPublicKey(secretKey)
    };
  }

  /**
   * Connect to a wallet using NWC connection string
   */
  async connect(connectionString: string): Promise<void> {
    try {
      this.connection = this.parseConnectionString(connectionString);
      this.relays = [this.connection.relay];
      
      // Test connection by fetching info
      const info = await this.getInfo();
      if (info.error) {
        throw new Error(info.error);
      }
      
      console.log('Connected to NWC wallet:', info);
    } catch (error) {
      this.connection = null;
      this.relays = [];
      throw error;
    }
  }

  /**
   * Disconnect from wallet
   */
  disconnect(): void {
    this.connection = null;
    this.relays = [];
    this.pool.close(this.relays);
  }

  /**
   * Check if wallet is connected
   */
  isConnected(): boolean {
    return this.connection !== null;
  }

  /**
   * Send NWC request
   */
  private async sendNWCRequest(method: string, params: any = {}): Promise<any> {
    if (!this.connection) {
      throw new Error('Not connected to wallet');
    }

    const request = {
      method,
      params
    };

    // Encrypt the request
    const encrypted = await nip04.encrypt(
      this.connection.secret,
      this.connection.walletPubkey,
      JSON.stringify(request)
    );

    // Create NWC event (kind 23194)
    const eventTemplate: EventTemplate = {
      kind: 23194,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['p', this.connection.walletPubkey]],
      content: encrypted
    };

    const event = finalizeEvent(eventTemplate, this.connection.secret);

    // Send event and wait for response
    const response = await this.waitForResponse(event);
    
    if (!response) {
      throw new Error('No response from wallet');
    }

    // Decrypt response
    const decrypted = await nip04.decrypt(
      this.connection.secret,
      this.connection.walletPubkey,
      response.content
    );

    return JSON.parse(decrypted);
  }

  /**
   * Wait for NWC response
   */
  private async waitForResponse(requestEvent: Event): Promise<Event | null> {
    if (!this.connection) return null;

    return new Promise((resolve) => {
      const sub = this.pool.subscribeMany(
        this.relays,
        [
          {
            kinds: [23195], // NWC response kind
            authors: [this.connection!.walletPubkey],
            '#e': [requestEvent.id],
            since: requestEvent.created_at
          }
        ],
        {
          onevent: (event) => {
            sub.close();
            resolve(event);
          },
          oneose: () => {
            // Wait for response
          }
        }
      );

      // Publish request
      this.pool.publish(this.relays, requestEvent);

      // Timeout after 15 seconds for faster failed payments
      setTimeout(() => {
        sub.close();
        resolve(null);
      }, 15000);
    });
  }

  /**
   * Get wallet info
   */
  async getInfo(): Promise<any> {
    try {
      return await this.sendNWCRequest('get_info');
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get wallet balance
   */
  async getBalance(): Promise<BalanceResponse> {
    try {
      const response = await this.sendNWCRequest('get_balance');
      console.log('🔍 Full NWC balance response:', response);
      console.log('🔍 Balance value:', response.result?.balance, 'Type:', typeof response.result?.balance);
      return {
        balance: response.result?.balance
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Pay a Lightning invoice
   */
  async payInvoice(invoice: string): Promise<PaymentResponse> {
    try {
      const response = await this.sendNWCRequest('pay_invoice', { invoice });
      
      if (response.error) {
        return { error: response.error.message || response.error };
      }
      
      return {
        preimage: response.result?.preimage
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Create a Lightning invoice
   */
  async makeInvoice(amount: number, description?: string): Promise<{ invoice?: string; payment_hash?: string; error?: string }> {
    try {
      const response = await this.sendNWCRequest('make_invoice', {
        amount,
        description
      });
      
      if (response.error) {
        return { error: response.error.message || response.error };
      }
      
      return {
        invoice: response.result?.invoice,
        payment_hash: response.result?.payment_hash
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Pay Lightning address by resolving to invoice first
   */
  async payLightningAddress(lnAddress: string, amount: number, comment?: string): Promise<PaymentResponse> {
    try {
      console.log(`🔗 NWC resolving Lightning address to invoice: ${lnAddress}`);
      
      const { LNURLService } = await import('./lnurl-service');
      const amountMillisats = amount * 1000; // Convert sats to millisats
      
      const invoice = await LNURLService.getPaymentInvoice(
        lnAddress,
        amountMillisats,
        comment
      );
      
      console.log(`💳 NWC got invoice for ${lnAddress}, paying via NWC`);
      
      return await this.payInvoice(invoice);
    } catch (error) {
      console.error('❌ Lightning address payment failed:', error);
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Pay keysend (direct payment without invoice)
   */
  async payKeysend(pubkey: string, amount: number, tlvRecords?: any): Promise<PaymentResponse> {
    try {
      // Convert sats to msats for NWC (if not already in msats)
      const amountMsats = amount < 1000000 ? amount * 1000 : amount;
      
      // Ensure we have proper TLV records structure (array format)
      const finalTlvRecords = tlvRecords || [];
      
      console.log('⚡ Sending keysend payment:', { 
        pubkey, 
        amount: amountMsats, 
        tlv_records: finalTlvRecords 
      });
      
      const response = await this.sendNWCRequest('pay_keysend', {
        pubkey,
        amount: amountMsats,
        tlv_records: finalTlvRecords
      });
      
      console.log('⚡ Keysend payment response:', response);
      
      if (response.error) {
        console.error('❌ Keysend payment error:', response.error);
        return { error: response.error.message || response.error };
      }
      
      return {
        preimage: response.result?.preimage
      };
    } catch (error) {
      console.error('💥 Keysend payment exception:', error);
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Look up invoice status
   */
  async lookupInvoice(invoice: string, paymentHash?: string): Promise<{ settled?: boolean; paid?: boolean; error?: string }> {
    try {
      const params: any = { invoice };
      if (paymentHash) {
        params.payment_hash = paymentHash;
      }
      
      const response = await this.sendNWCRequest('lookup_invoice', params);
      
      if (response.error) {
        return { error: response.error.message || response.error };
      }
      
      return {
        settled: response.result?.settled,
        paid: response.result?.paid
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * List transactions
   */
  async listTransactions(params?: { from?: number; until?: number; limit?: number }): Promise<any> {
    try {
      return await this.sendNWCRequest('list_transactions', params);
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

// Singleton instance
let nwcService: NWCService | null = null;

export function getNWCService(): NWCService {
  if (!nwcService) {
    nwcService = new NWCService();
  }
  return nwcService;
}