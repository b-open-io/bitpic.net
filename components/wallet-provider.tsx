"use client";

import type { ReactNode } from "react";
import { YoursProvider } from "yours-wallet-provider";
import { WalletStateProvider } from "@/lib/use-wallet";

interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  return (
    <YoursProvider>
      <WalletStateProvider>{children}</WalletStateProvider>
    </YoursProvider>
  );
}
