import { useQuery } from "@tanstack/react-query";
import type { FeedResponse, AvatarData } from "@/lib/types";
import { formatRelativeTime, getAvatarUrl } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
if (!API_URL) {
  throw new Error("NEXT_PUBLIC_API_URL environment variable is required");
}

async function fetchFeed(limit = 50): Promise<FeedResponse> {
  const response = await fetch(`${API_URL}/api/feed?limit=${limit}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch feed: ${response.statusText}`);
  }
  return response.json();
}

interface UseFeedResult {
  confirmed: AvatarData[];
  unconfirmed: AvatarData[];
}

export function useFeed() {
  return useQuery({
    queryKey: ["feed"],
    queryFn: () => fetchFeed(50),
    refetchInterval: 10000,
    select: (data): UseFeedResult => {
      const confirmed = data.items
        .filter((item) => item.confirmed !== false)
        .map((item) => ({
          paymail: item.paymail,
          imageUrl: item.url || getAvatarUrl(item.paymail),
          timestamp: formatRelativeTime(item.timestamp),
        }));

      const unconfirmed = data.items
        .filter((item) => item.confirmed === false)
        .map((item) => ({
          paymail: item.paymail,
          imageUrl: item.url || getAvatarUrl(item.paymail),
          timestamp: "pending",
        }));

      return { confirmed, unconfirmed };
    },
  });
}
