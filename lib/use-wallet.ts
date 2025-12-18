"use client";

import { useCallback, useEffect, useState } from "react";
import { useYoursWallet } from "yours-wallet-provider";

export interface SocialProfile {
  displayName?: string;
  avatar?: string;
}

export interface WalletState {
  wallet: ReturnType<typeof useYoursWallet> | null;
  isConnected: boolean;
  address: string | null;
  pubKey: string | null;
  ordAddress: string | null;
  identityAddress: string | null;
  socialProfile: SocialProfile | null;
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
  const [socialProfile, setSocialProfile] = useState<SocialProfile | null>(
    null,
  );

  const resetState = useCallback(() => {
    setIsConnected(false);
    setAddress(null);
    setPubKey(null);
    setOrdAddress(null);
    setIdentityAddress(null);
    setSocialProfile(null);
  }, []);

  useEffect(() => {
    if (!wallet) return;

    const walletWithEvents = wallet as {
      on?: (event: string, handler: () => void) => void;
      removeListener?: (event: string, handler: () => void) => void;
    };

    // Set up event listeners for wallet state changes
    const handleSignedOut = () => {
      console.log("Wallet signed out");
      resetState();
    };

    const handleSwitchAccount = () => {
      console.log("Wallet account switched");
      resetState();
    };

    try {
      walletWithEvents.on?.("signedOut", handleSignedOut);
      walletWithEvents.on?.("switchAccount", handleSwitchAccount);
    } catch {
      // Events may not be supported
    }

    // Cleanup listeners on unmount
    return () => {
      try {
        walletWithEvents.removeListener?.("signedOut", handleSignedOut);
        walletWithEvents.removeListener?.("switchAccount", handleSwitchAccount);
      } catch {
        // Cleanup may not be supported
      }
    };
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

      // Fetch social profile from wallet
      try {
        const profile = await wallet.getSocialProfile();
        if (profile) {
          setSocialProfile({
            displayName: profile.displayName,
            avatar: profile.avatar,
          });
        }
      } catch {
        // Social profile may not be available
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
    socialProfile,
    connect,
    disconnect,
  };
}
