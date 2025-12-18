"use client";

import { AvatarCard } from "@/components/avatar-card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

interface AvatarData {
  paymail: string;
  imageUrl: string;
  timestamp: string;
}

interface FeedProps {
  confirmed: AvatarData[];
  unconfirmed?: AvatarData[];
}

export function Feed({ confirmed, unconfirmed = [] }: FeedProps) {
  return (
    <section className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      {/* Unconfirmed/Mempool Section */}
      {unconfirmed.length > 0 ? (
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <h2 className="text-sm font-medium font-mono text-muted-foreground">
              Mempool
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {unconfirmed.map((item, idx) => (
              <div key={`unconfirmed-${idx}`} className="relative">
                <AvatarCard {...item} />
                <div className="absolute inset-0 bg-background/20 backdrop-blur-[1px] pointer-events-none rounded-sm" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <div className="h-2 w-2 rounded-full bg-muted" />
            <h2 className="text-sm font-medium font-mono text-muted-foreground">
              Mempool
            </h2>
          </div>
          <p className="text-sm text-muted-foreground italic">
            No pending uploads
          </p>
        </div>
      )}

      <Separator className="my-12" />

      {/* Confirmed/Immutable Section */}
      <div>
        <div className="flex items-center gap-2 mb-6">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          <h2 className="text-sm font-medium font-mono text-muted-foreground">
            Immutable
          </h2>
        </div>
        {confirmed.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {confirmed.map((item, idx) => (
              <AvatarCard key={`confirmed-${idx}`} {...item} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, idx) => (
              <div key={`skeleton-${idx}`} className="space-y-3">
                <Skeleton className="aspect-square w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
