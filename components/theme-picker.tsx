"use client";

import { Palette } from "lucide-react";
import { useThemeToken } from "@theme-token/sdk/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWallet } from "@/lib/use-wallet";
import { cn } from "@/lib/utils";

export function ThemePicker() {
  const { ordinals, isConnected } = useWallet();
  const { themeTokens, activeOrigin, loadTheme, resetTheme, isLoading } =
    useThemeToken(ordinals);

  // Don't show if not connected or no theme tokens
  if (!isConnected || themeTokens.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-8 w-8", activeOrigin && "text-primary")}
          disabled={isLoading}
        >
          <Palette className="h-4 w-4" />
          <span className="sr-only">Theme tokens</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-xs">Theme Tokens</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {themeTokens.map((token) => (
          <DropdownMenuItem
            key={token.origin}
            onClick={() => loadTheme(token.origin)}
            className={cn(
              "font-mono text-xs cursor-pointer",
              token.origin === activeOrigin && "bg-primary/10 text-primary",
            )}
          >
            {token.origin === activeOrigin && (
              <span className="mr-1.5">&#10003;</span>
            )}
            {token.origin.slice(0, 8)}...
          </DropdownMenuItem>
        ))}
        {activeOrigin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={resetTheme}
              className="text-xs cursor-pointer text-muted-foreground"
            >
              Reset to default
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
