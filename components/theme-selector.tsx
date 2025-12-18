"use client";

import { fetchThemeByOrigin } from "@theme-token/sdk";
import { useThemeToken } from "@theme-token/sdk/react";
import { Check, Moon, Palette, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useWallet } from "@/lib/use-wallet";
import { cn } from "@/lib/utils";

interface ThemeMetadata {
  origin: string;
  name: string;
  author?: string;
}

export function ThemeSelector() {
  const { ordinals, isConnected } = useWallet();
  const { resolvedTheme, setTheme } = useTheme();
  const {
    themeTokens,
    activeOrigin,
    activeTheme,
    loadTheme,
    resetTheme,
    isLoading,
  } = useThemeToken(ordinals);

  const [themesMetadata, setThemesMetadata] = useState<ThemeMetadata[]>([]);
  const [loadingMetadata, setLoadingMetadata] = useState(false);

  // Fetch metadata for all theme tokens
  const fetchMetadata = useCallback(async () => {
    if (themeTokens.length === 0) return;

    setLoadingMetadata(true);
    const metadata: ThemeMetadata[] = [];

    for (const token of themeTokens) {
      try {
        const published = await fetchThemeByOrigin(token.origin);
        if (published) {
          metadata.push({
            origin: token.origin,
            name: published.theme.name,
            author: published.theme.author,
          });
        } else {
          metadata.push({
            origin: token.origin,
            name: `Theme ${token.origin.slice(0, 6)}...`,
          });
        }
      } catch {
        metadata.push({
          origin: token.origin,
          name: `Theme ${token.origin.slice(0, 6)}...`,
        });
      }
    }

    setThemesMetadata(metadata);
    setLoadingMetadata(false);
  }, [themeTokens]);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  const hasThemeTokens = isConnected && themeTokens.length > 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-8 w-8 relative", activeOrigin && "text-primary")}
        >
          {activeOrigin ? (
            <Palette className="h-4 w-4" />
          ) : resolvedTheme === "dark" ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Sun className="h-4 w-4" />
          )}
          {activeOrigin && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-primary rounded-full" />
          )}
          <span className="sr-only">Theme settings</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-0">
        {/* Mode Section */}
        <div className="p-3 border-b border-border">
          <p className="text-xs font-medium text-muted-foreground mb-2">Mode</p>
          <div className="flex gap-1">
            <Button
              variant={resolvedTheme === "light" ? "default" : "outline"}
              size="sm"
              className="flex-1 h-8 gap-1.5"
              onClick={() => setTheme("light")}
            >
              <Sun className="h-3.5 w-3.5" />
              Light
            </Button>
            <Button
              variant={resolvedTheme === "dark" ? "default" : "outline"}
              size="sm"
              className="flex-1 h-8 gap-1.5"
              onClick={() => setTheme("dark")}
            >
              <Moon className="h-3.5 w-3.5" />
              Dark
            </Button>
          </div>
        </div>

        {/* Theme Tokens Section */}
        {hasThemeTokens && (
          <div className="p-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Your Theme Tokens
            </p>
            {loadingMetadata ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <ScrollArea className={themesMetadata.length > 4 ? "h-40" : ""}>
                <div className="space-y-1">
                  {themesMetadata.map((theme) => (
                    <button
                      key={theme.origin}
                      type="button"
                      onClick={() => loadTheme(theme.origin)}
                      disabled={isLoading}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-2 rounded-md text-left transition-colors",
                        "hover:bg-muted",
                        theme.origin === activeOrigin && "bg-primary/10",
                        isLoading && "opacity-50 cursor-not-allowed",
                      )}
                    >
                      <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                        {theme.origin === activeOrigin && (
                          <Check className="h-3 w-3 text-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            "text-sm font-medium truncate",
                            theme.origin === activeOrigin && "text-primary",
                          )}
                        >
                          {theme.name}
                        </p>
                        {theme.author && (
                          <p className="text-xs text-muted-foreground truncate">
                            by {theme.author}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}

            {activeOrigin && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2 h-8 text-xs text-muted-foreground"
                onClick={resetTheme}
                disabled={isLoading}
              >
                Reset to default
              </Button>
            )}
          </div>
        )}

        {/* Active Theme Info */}
        {activeTheme && (
          <div className="px-3 pb-3 pt-0">
            <div className="p-2 rounded-md bg-muted/50 border border-border">
              <p className="text-xs text-muted-foreground">Active theme</p>
              <p className="text-sm font-medium truncate">{activeTheme.name}</p>
            </div>
          </div>
        )}

        {/* Not Connected State */}
        {!isConnected && (
          <div className="p-3 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              Connect wallet to use theme tokens
            </p>
          </div>
        )}

        {/* Connected but no tokens */}
        {isConnected && themeTokens.length === 0 && (
          <div className="p-3 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              No theme tokens in wallet
            </p>
            <a
              href="https://themetoken.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline block text-center mt-1"
            >
              Get a theme token
            </a>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
