"use client";

import { WalletProvider as OneSatWalletProvider } from "@1sat/react";
import type { ReactNode } from "react";
import { WalletStateProvider } from "@/lib/use-wallet";

interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  return (
    <OneSatWalletProvider autoReconnect>
      <WalletStateProvider>{children}</WalletStateProvider>
    </OneSatWalletProvider>
  );
}
