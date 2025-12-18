const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export interface AvatarResponse {
  paymail: string;
  url: string;
  txid: string;
  timestamp: number;
}

export interface FeedItem {
  paymail: string;
  outpoint: string;
  url: string;
  txid: string;
  timestamp: number;
  confirmed: boolean;
}

export interface FeedResponse {
  items: FeedItem[];
  total: number;
  offset: number;
  limit: number;
}

export interface ExistsResponse {
  exists: boolean;
  paymail: string;
  txid?: string;
}

export interface BroadcastResponse {
  txid: string;
  success: boolean;
  error?: string;
}

export interface StatusResponse {
  connected: boolean;
  syncing: boolean;
  blockHeight: number;
  blockHash: string;
  timestamp: number;
}

export interface PaymailAvailableResponse {
  available: boolean;
  handle: string;
}

export interface RegisterPaymailRequest {
  handle: string;
  pubKey: string;
  signature: string;
  rawtx: string;
}

export class BitPicAPI {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || API_BASE;
  }

  async getAvatar(paymail: string): Promise<AvatarResponse | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/avatar/${encodeURIComponent(paymail)}`,
      );
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Failed to get avatar: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error("Error fetching avatar:", error);
      return null;
    }
  }

  async getFeed(offset = 0, limit = 20): Promise<FeedResponse> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/feed?offset=${offset}&limit=${limit}`,
      );
      if (!response.ok) {
        throw new Error(`Failed to get feed: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error("Error fetching feed:", error);
      return { items: [], total: 0, offset, limit };
    }
  }

  async exists(paymail: string): Promise<ExistsResponse> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/exists/${encodeURIComponent(paymail)}`,
      );
      if (!response.ok) {
        throw new Error(`Failed to check existence: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error("Error checking existence:", error);
      return { exists: false, paymail };
    }
  }

  async broadcast(rawtx: string): Promise<BroadcastResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/broadcast`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rawtx }),
      });

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: response.statusText }));
        throw new Error(
          error.error || `Failed to broadcast: ${response.statusText}`,
        );
      }

      return await response.json();
    } catch (error) {
      console.error("Error broadcasting transaction:", error);
      return {
        txid: "",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async getStatus(): Promise<StatusResponse | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/status`);
      if (!response.ok) {
        throw new Error(`Failed to get status: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error("Error fetching status:", error);
      return null;
    }
  }

  async checkPaymailAvailable(
    handle: string,
  ): Promise<PaymailAvailableResponse> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/paymail/available/${encodeURIComponent(handle)}`,
      );
      if (!response.ok) {
        throw new Error(
          `Failed to check paymail availability: ${response.statusText}`,
        );
      }
      return await response.json();
    } catch (error) {
      console.error("Error checking paymail availability:", error);
      return { available: false, handle };
    }
  }

  async registerPaymail(
    data: RegisterPaymailRequest,
  ): Promise<BroadcastResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/paymail/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: response.statusText }));
        throw new Error(
          error.error || `Failed to register paymail: ${response.statusText}`,
        );
      }

      return await response.json();
    } catch (error) {
      console.error("Error registering paymail:", error);
      return {
        txid: "",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

// Export singleton instance
export const api = new BitPicAPI();
