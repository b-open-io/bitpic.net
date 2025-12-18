import { Feed } from "@/components/feed";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { Hero } from "@/components/hero";
import { formatRelativeTime, getAvatarUrl } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

interface FeedItem {
  paymail: string;
  url: string;
  txid: string;
  timestamp: number;
  confirmed: boolean;
}

interface FeedResponse {
  items: FeedItem[];
  total: number;
  offset: number;
  limit: number;
}

async function getFeed(): Promise<FeedResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/feed?limit=50`, {
      next: { revalidate: 10 },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch feed: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching feed:", error);
    return { items: [], total: 0, offset: 0, limit: 50 };
  }
}

export default async function Home() {
  const feed = await getFeed();

  const confirmed = feed.items
    .filter((item) => item.confirmed !== false)
    .map((item) => ({
      paymail: item.paymail,
      imageUrl: item.url || getAvatarUrl(item.paymail),
      timestamp: formatRelativeTime(item.timestamp),
    }));

  const unconfirmed = feed.items
    .filter((item) => item.confirmed === false)
    .map((item) => ({
      paymail: item.paymail,
      imageUrl: item.url || getAvatarUrl(item.paymail),
      timestamp: "pending",
    }));

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <Hero />
        <Feed confirmed={confirmed} unconfirmed={unconfirmed} />
      </main>
      <Footer />
    </div>
  );
}
