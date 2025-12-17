"use client";

import { useYoursWallet } from "yours-wallet-provider";
import { useEffect, useState, useCallback } from "react";

export interface WalletState {
  wallet: ReturnType<typeof useYoursWallet> | null;
  isConnected: boolean;
  address: string | null;
  pubKey: string | null;
  ordAddress: string | null;
  identityAddress: string | null;
  connect: () => Promise<string | undefined>;
  disconnect: () => void;
}

export function useWallet(): WalletState {
  const wallet = useYoursWallet();
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [pubKey, setPubKey] = useState<string | null>(null);
  const [ordAddress, setOrdAddress] = useState<string | null>(null);
  const [identityAddress, setIdentityAddress] = useState<string | null>(null);

  const resetState = useCallback(() => {
    setIsConnected(false);
    setAddress(null);
    setPubKey(null);
    setOrdAddress(null);
    setIdentityAddress(null);
  }, []);

  useEffect(() => {
    if (!wallet) return;

    // Set up event listeners using type assertion since the types may not include these
    try {
      (wallet as { on?: (event: string, handler: () => void) => void }).on?.("switchAccount", resetState);
      (wallet as { on?: (event: string, handler: () => void) => void }).on?.("signedOut", resetState);
    } catch {
      // Events may not be supported
    }
  }, [wallet, resetState]);

  const connect = useCallback(async (): Promise<string | undefined> => {
    if (!wallet) {
      console.error("Wallet not initialized");
      return undefined;
    }

    try {
      const publicKey = await wallet.connect();
      const addresses = await wallet.getAddresses();

      if (publicKey) {
        setPubKey(publicKey);
      }
      if (addresses) {
        setAddress(addresses.bsvAddress);
        setOrdAddress(addresses.ordAddress);
        setIdentityAddress(addresses.identityAddress);
      }
      setIsConnected(true);

      return publicKey;
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      throw error;
    }
  }, [wallet]);

  const disconnect = useCallback(() => {
    resetState();
  }, [resetState]);

  return {
    wallet,
    isConnected,
    address,
    pubKey,
    ordAddress,
    identityAddress,
    connect,
    disconnect,
  };
}
