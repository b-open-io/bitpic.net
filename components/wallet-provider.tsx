"use client";

import { YoursProvider } from "yours-wallet-provider";
import type { ReactNode } from "react";

interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  return <YoursProvider>{children}</YoursProvider>;
}
