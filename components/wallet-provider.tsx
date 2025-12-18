"use client";

import type { ReactNode } from "react";
import { YoursProvider } from "yours-wallet-provider";

interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  return <YoursProvider>{children}</YoursProvider>;
}
