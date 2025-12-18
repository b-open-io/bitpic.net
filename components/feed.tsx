"use client";

import { AvatarCard } from "@/components/avatar-card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useFeed } from "@/hooks/use-feed";

export function Feed() {
  const { data, isLoading, isError } = useFeed();

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

  const { confirmed = [], unconfirmed = [] } = data || {};

  return (
    <section className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      {/* Mempool / Unconfirmed */}
      <div className="mb-12">
        <div className="flex items-center gap-2 mb-6">
          <div
            className={`h-2 w-2 rounded-full ${unconfirmed.length > 0 ? "bg-primary animate-pulse" : "bg-muted"}`}
          />
          <h2 className="text-sm font-medium font-mono text-muted-foreground">
            Mempool
          </h2>
        </div>

        {unconfirmed.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {unconfirmed.map((item) => (
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
        <div className="flex items-center gap-2 mb-6">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          <h2 className="text-sm font-medium font-mono text-muted-foreground">
            Immutable
          </h2>
        </div>

        {confirmed.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {confirmed.map((item) => (
              <AvatarCard key={item.txid} {...item} />
            ))}
          </div>
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
