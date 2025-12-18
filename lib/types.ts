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

export interface StatusResponse {
  connected: boolean;
  syncing: boolean;
  blockHeight: number;
  blockHash: string;
  timestamp: number;
}

export interface AvatarData {
  paymail: string;
  imageUrl: string;
  timestamp: string;
}
