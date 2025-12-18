"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { AvatarCard } from "@/components/avatar-card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  transformFeedItem,
  useInfiniteFeed,
  useMempool,
} from "@/hooks/use-feed";

export function Feed() {
  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteFeed();
  const { data: mempoolItems = [] } = useMempool();

  // Intersection observer for infinite scroll
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage],
  );

  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(handleObserver, {
      threshold: 0.1,
      rootMargin: "100px",
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [handleObserver]);

  if (isError) {
    return (
      <section className="container mx-auto max-w-7xl px-4 py-12 text-center">
        <p className="text-muted-foreground">Failed to load feed.</p>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="container mx-auto max-w-7xl px-4 py-12">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-square w-full rounded-md" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  // Flatten all pages and filter confirmed items only (mempool shown separately)
  const confirmedItems =
    data?.pages
      .flatMap((page) => page.items)
      .filter((item) => item.confirmed !== false)
      .map(transformFeedItem) ?? [];

  const unconfirmedItems = mempoolItems.map(transformFeedItem);

  return (
    <section className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      {/* Mempool / Unconfirmed */}
      <div className="mb-12">
        <div className="flex items-center gap-2 mb-6">
          <div
            className={`h-2 w-2 rounded-full ${unconfirmedItems.length > 0 ? "bg-primary animate-pulse" : "bg-muted"}`}
          />
          <h2 className="text-sm font-medium font-mono text-muted-foreground">
            Mempool
          </h2>
        </div>

        {unconfirmedItems.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {unconfirmedItems.map((item) => (
              <div key={item.txid} className="relative group">
                <AvatarCard {...item} />
                <div className="absolute inset-0 bg-background/20 backdrop-blur-[1px] pointer-events-none rounded-sm border border-primary/20" />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground/60 italic pl-1">
            No pending uploads
          </p>
        )}
      </div>

      <Separator className="my-12 opacity-50" />

      {/* Immutable / Confirmed */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <h2 className="text-sm font-medium font-mono text-muted-foreground">
              Immutable
            </h2>
          </div>
          {data?.pages[0]?.total && (
            <span className="text-xs text-muted-foreground">
              {data.pages[0].total.toLocaleString()} total
            </span>
          )}
        </div>

        {confirmedItems.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {confirmedItems.map((item) => (
                <AvatarCard key={item.txid} {...item} />
              ))}
            </div>

            {/* Infinite scroll trigger */}
            <div ref={loadMoreRef} className="mt-8 flex justify-center">
              {isFetchingNextPage && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Loading more...</span>
                </div>
              )}
              {!hasNextPage && confirmedItems.length > 0 && (
                <p className="text-sm text-muted-foreground/60">End of feed</p>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-16 border border-dashed border-border rounded-lg">
            <p className="text-muted-foreground mb-2">No avatars yet</p>
            <p className="text-sm text-muted-foreground/60">
              Be the first to upload your avatar to the blockchain
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
