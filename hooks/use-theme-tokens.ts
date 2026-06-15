"use client";

import {
  applyThemeModeWithAssets,
  clearTheme,
  getOrdfsUrl,
  type ThemeToken,
  validateThemeToken,
} from "@theme-token/sdk";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "@/lib/use-wallet";

const STORAGE_KEY = "bitpic-theme-token";

export interface ThemeTokenEntry {
  origin: string;
  name: string;
  author?: string;
  theme: ThemeToken;
}

// Detect a theme-token output. Theme packages are inscribed with the
// `registry:style:` MAP tag (current format); older tokens used MAP
// app=ThemeToken. We match either and hydrate content from ORDFS.
function isThemeOutput(tags: string[], map?: Record<string, string>): boolean {
  if (tags.some((t) => t.startsWith("registry:style:"))) return true;
  if (map?.app === "ThemeToken") return true;
  return false;
}

/**
 * Resolve, apply, and persist the theme tokens a connected wallet owns.
 *
 * Mirrors the @theme-token reference: detect theme outputs by MAP tag, hydrate
 * the full ThemeToken from ORDFS (`<outpoint>/theme.json`), then apply it
 * directly with the SDK (the SDK's registry-only loadTheme can't load
 * owned-but-unpublished themes). Re-applies on light/dark mode changes.
 */
export function useThemeTokens() {
  const { ordinals, isConnected } = useWallet();
  const { resolvedTheme } = useTheme();
  const [themes, setThemes] = useState<ThemeTokenEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeOrigin, setActiveOrigin] = useState<string | null>(null);
  const [activeTheme, setActiveTheme] = useState<ThemeToken | null>(null);

  const mode = resolvedTheme === "dark" ? "dark" : "light";

  const candidates = useMemo(
    () => ordinals.filter((o) => isThemeOutput(o.tags, o.map)),
    [ordinals],
  );

  // Hydrate the full theme tokens from ORDFS.
  useEffect(() => {
    if (!isConnected || candidates.length === 0) {
      setThemes([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    Promise.allSettled(
      candidates.map(async (o): Promise<ThemeTokenEntry | null> => {
        const res = await fetch(getOrdfsUrl(`${o.outpoint}/theme.json`));
        if (!res.ok) return null;
        const json = await res.json();
        const validation = validateThemeToken(json);
        if (!validation.valid) return null;
        return {
          origin: o.origin,
          name: validation.theme.name,
          author: validation.theme.author,
          theme: validation.theme,
        };
      }),
    )
      .then((results) => {
        if (cancelled) return;
        const found: ThemeTokenEntry[] = [];
        for (const r of results) {
          if (r.status === "fulfilled" && r.value) found.push(r.value);
        }
        setThemes(found);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isConnected, candidates]);

  // Restore a previously selected theme once its content is available.
  useEffect(() => {
    if (typeof window === "undefined" || themes.length === 0 || activeOrigin) {
      return;
    }
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    const entry = themes.find((t) => t.origin === saved);
    if (entry) {
      setActiveOrigin(entry.origin);
      setActiveTheme(entry.theme);
    }
  }, [themes, activeOrigin]);

  // Apply / re-apply the active theme whenever it or the mode changes.
  useEffect(() => {
    if (!activeTheme) return;
    applyThemeModeWithAssets(activeTheme, mode).catch((err) =>
      console.error("Failed to apply theme:", err),
    );
  }, [activeTheme, mode]);

  // Clear applied styles when the wallet disconnects.
  useEffect(() => {
    if (!isConnected && activeOrigin) {
      clearTheme();
      setActiveOrigin(null);
      setActiveTheme(null);
    }
  }, [isConnected, activeOrigin]);

  const loadTheme = useCallback(
    (origin: string) => {
      const entry = themes.find((t) => t.origin === origin);
      if (!entry) return;
      setActiveOrigin(origin);
      setActiveTheme(entry.theme);
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, origin);
      }
    },
    [themes],
  );

  const resetTheme = useCallback(() => {
    clearTheme();
    setActiveOrigin(null);
    setActiveTheme(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  return {
    themes,
    activeOrigin,
    activeTheme,
    loadTheme,
    resetTheme,
    isLoading,
  };
}
