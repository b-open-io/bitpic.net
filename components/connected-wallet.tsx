"use client";

import { Wallet } from "lucide-react";
import { useWallet } from "@/lib/use-wallet";
import { cn } from "@/lib/utils";

function shortKey(key: string): string {
  return key.length > 12 ? `${key.slice(0, 6)}…${key.slice(-4)}` : key;
}

interface ConnectedWalletProps {
  className?: string;
  avatarSize?: number;
}

/**
 * Connected-wallet indicator backed by the wallet's BAP profile.
 * Shows the profile avatar + display name when published, otherwise a generic
 * wallet glyph and a shortened identity key. Never shows a receive address.
 */
export function ConnectedWallet({
  className,
  avatarSize = 20,
}: ConnectedWalletProps) {
  const { socialProfile, pubKey } = useWallet();

  const label =
    socialProfile?.displayName || (pubKey ? shortKey(pubKey) : "Connected");
  const avatar = socialProfile?.avatar;

  return (
    <span className={cn("flex items-center gap-2 min-w-0", className)}>
      {avatar ? (
        // Profile images come from arbitrary on-chain/ORDFS hosts, so a plain
        // img avoids next/image remote-pattern constraints.
        // biome-ignore lint/performance/noImgElement: arbitrary avatar host
        <img
          src={avatar}
          alt={label}
          width={avatarSize}
          height={avatarSize}
          style={{ width: avatarSize, height: avatarSize }}
          className="rounded-full object-cover shrink-0"
        />
      ) : (
        <span
          style={{ width: avatarSize, height: avatarSize }}
          className="flex items-center justify-center rounded-full bg-primary/15 shrink-0"
        >
          <Wallet className="h-3 w-3 text-primary" />
        </span>
      )}
      <span className="truncate text-sm">{label}</span>
    </span>
  );
}
