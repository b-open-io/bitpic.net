"use client";

import { BlockchainImage } from "bitcoin-image/react";
import { Wallet } from "lucide-react";
import { useWallet } from "@/lib/use-wallet";
import { cn } from "@/lib/utils";

interface ConnectedWalletProps {
  className?: string;
  avatarSize?: number;
}

/**
 * Connected-wallet indicator backed by the wallet's identity.
 * Prefers the BAP profile display name, then the registered BitPic paymail,
 * then a neutral "Connected" label. Never shows a raw pubkey or address.
 */
export function ConnectedWallet({
  className,
  avatarSize = 20,
}: ConnectedWalletProps) {
  const { socialProfile, paymail } = useWallet();

  const label = socialProfile?.displayName || paymail || "Connected";
  const avatar = socialProfile?.avatar;

  return (
    <span className={cn("flex items-center gap-2 min-w-0", className)}>
      {avatar ? (
        <BlockchainImage
          src={avatar}
          alt={label}
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
