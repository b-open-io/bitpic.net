"use client";

import { Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useThemeTokens } from "@/hooks/use-theme-tokens";
import { useWallet } from "@/lib/use-wallet";
import { cn } from "@/lib/utils";

export function ThemePicker() {
  const { isConnected } = useWallet();
  const { themes, activeOrigin, loadTheme, resetTheme, isLoading } =
    useThemeTokens();

  // Don't show if not connected or no theme tokens
  if (!isConnected || themes.length === 0) {
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
        {themes.map((theme) => (
          <DropdownMenuItem
            key={theme.origin}
            onClick={() => loadTheme(theme.origin)}
            className={cn(
              "text-xs cursor-pointer",
              theme.origin === activeOrigin && "bg-primary/10 text-primary",
            )}
          >
            {theme.origin === activeOrigin && (
              <span className="mr-1.5">&#10003;</span>
            )}
            <span className="truncate">{theme.name}</span>
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
