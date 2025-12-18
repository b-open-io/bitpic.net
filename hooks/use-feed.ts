import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { FeedItem, FeedResponse } from "@/lib/types";
import { formatRelativeTime, getAvatarUrl } from "@/lib/utils";

const PAGE_SIZE = 24;

async function fetchFeedPage(offset: number): Promise<FeedResponse> {
  // Use relative URL - Next.js rewrites /api/feed to the backend
  const response = await fetch(`/api/feed?offset=${offset}&limit=${PAGE_SIZE}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch feed: ${response.statusText}`);
  }
  return response.json();
}

// Separate query for mempool items (always first page, unconfirmed only)
async function fetchMempool(): Promise<FeedItem[]> {
  const response = await fetch("/api/feed?offset=0&limit=50");
  if (!response.ok) {
    throw new Error(`Failed to fetch mempool: ${response.statusText}`);
  }
  const data: FeedResponse = await response.json();
  return data.items.filter((item) => item.confirmed === false);
}

export function useMempool() {
  return useQuery({
    queryKey: ["mempool"],
    queryFn: fetchMempool,
    refetchInterval: 5000, // Check mempool more frequently
  });
}

export function useInfiniteFeed() {
  return useInfiniteQuery({
    queryKey: ["feed"],
    queryFn: ({ pageParam = 0 }) => fetchFeedPage(pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const nextOffset = lastPage.offset + lastPage.limit;
      // Only return next page if there are more items
      if (nextOffset < lastPage.total) {
        return nextOffset;
      }
      return undefined;
    },
    refetchInterval: 30000, // Refresh less often for confirmed items
  });
}

// Transform feed items into display format
export function transformFeedItem(item: FeedItem) {
  return {
    paymail: item.paymail,
    imageUrl: item.url || getAvatarUrl(item.paymail),
    timestamp: item.confirmed ? formatRelativeTime(item.timestamp) : "pending",
    txid: item.txid,
    confirmed: item.confirmed,
  };
}
