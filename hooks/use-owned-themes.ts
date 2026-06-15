"use client";

import { fetchPublishedThemes, type PublishedTheme } from "@theme-token/sdk";
import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@/lib/use-wallet";

export interface OwnedTheme {
  origin: string;
  name: string;
  author?: string;
}

/**
 * Resolve the theme tokens a connected wallet owns.
 *
 * BRC-100 `getOrdinals` only exposes content-type/origin/name tags, not the
 * MAP `type`/`app` attributes the theme SDK filters on. Instead of relying on
 * MAP metadata, we fetch the published theme registry once and intersect it
 * with the wallet's ordinal origins — authoritative and a single request.
 */
export function useOwnedThemes(): { themes: OwnedTheme[]; isLoading: boolean } {
  const { ordinals, isConnected } = useWallet();
  const [published, setPublished] = useState<PublishedTheme[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const origins = useMemo(
    () => new Set(ordinals.map((o) => o.origin)),
    [ordinals],
  );

  useEffect(() => {
    if (!isConnected || origins.size === 0) {
      setPublished(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    fetchPublishedThemes()
      .then((all) => {
        if (!cancelled) setPublished(all);
      })
      .catch((err) => {
        console.error("Failed to fetch published themes:", err);
        if (!cancelled) setPublished([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isConnected, origins]);

  const themes = useMemo<OwnedTheme[]>(() => {
    if (!published) return [];
    return published
      .filter((pt) => origins.has(pt.origin))
      .map((pt) => ({
        origin: pt.origin,
        name: pt.theme.name,
        author: pt.theme.author,
      }));
  }, [published, origins]);

  return { themes, isLoading };
}
