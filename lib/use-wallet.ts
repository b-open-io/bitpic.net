"use client";

import {
  createContext,
  createElement,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useYoursWallet } from "yours-wallet-provider";

export interface SocialProfile {
  displayName?: string;
  avatar?: string;
}

// Raw ordinal structure from Yours Wallet
interface RawOrdinal {
  outpoint: string;
  satoshis: number;
  script: string;
  spend: string;
  height: number;
  idx: number;
  origin?: {
    outpoint?: string;
    data?: {
      map?: Record<string, string>;
      insc?: {
        file?: {
          type?: string;
          size?: number;
        };
      };
    };
  };
}

// Normalized ordinal structure for our app and SDK compatibility
export interface Ordinal {
  origin: string;
  outpoint: string;
  satoshis: number;
  script: string;
  spend: string;
  height: number;
  idx: number;
  map?: Record<string, string>;
  data?: {
    insc?: {
      file?: {
        type?: string;
        size?: number;
      };
    };
  };
}

// Transform raw wallet ordinals to normalized format
function normalizeOrdinals(rawOrdinals: RawOrdinal[]): Ordinal[] {
  return rawOrdinals.map((raw) => ({
    origin: raw.origin?.outpoint || raw.outpoint,
    outpoint: raw.outpoint,
    satoshis: raw.satoshis,
    script: raw.script,
    spend: raw.spend,
    height: raw.height,
    idx: raw.idx,
    map: raw.origin?.data?.map,
    data: raw.origin?.data ? { insc: raw.origin.data.insc } : undefined,
  }));
}

export interface WalletState {
  wallet: ReturnType<typeof useYoursWallet> | null;
  isConnected: boolean;
  address: string | null;
  pubKey: string | null;
  ordAddress: string | null;
  identityAddress: string | null;
  socialProfile: SocialProfile | null;
  ordinals: Ordinal[];
  connect: () => Promise<string | undefined>;
  disconnect: () => void;
  refreshOrdinals: () => Promise<void>;
}

const WalletContext = createContext<WalletState | null>(null);

export function WalletStateProvider({ children }: { children: ReactNode }) {
  const wallet = useYoursWallet();
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [pubKey, setPubKey] = useState<string | null>(null);
  const [ordAddress, setOrdAddress] = useState<string | null>(null);
  const [identityAddress, setIdentityAddress] = useState<string | null>(null);
  const [socialProfile, setSocialProfile] = useState<SocialProfile | null>(
    null,
  );
  const [ordinals, setOrdinals] = useState<Ordinal[]>([]);

  const resetState = useCallback(() => {
    setIsConnected(false);
    setAddress(null);
    setPubKey(null);
    setOrdAddress(null);
    setIdentityAddress(null);
    setSocialProfile(null);
    setOrdinals([]);
  }, []);

  const refreshOrdinals = useCallback(async () => {
    if (!wallet) return;
    try {
      const result = await wallet.getOrdinals();
      let rawOrdinals: RawOrdinal[] = [];
      if (Array.isArray(result)) {
        rawOrdinals = result as RawOrdinal[];
      } else if (result && "data" in result) {
        rawOrdinals = (result.data || []) as RawOrdinal[];
      }
      setOrdinals(normalizeOrdinals(rawOrdinals));
    } catch (err) {
      console.error("Failed to fetch ordinals:", err);
    }
  }, [wallet]);

  useEffect(() => {
    if (!wallet) return;

    const walletWithEvents = wallet as {
      on?: (event: string, handler: () => void) => void;
      removeListener?: (event: string, handler: () => void) => void;
    };

    const handleSignedOut = () => {
      resetState();
    };

    const handleSwitchAccount = () => {
      resetState();
    };

    try {
      walletWithEvents.on?.("signedOut", handleSignedOut);
      walletWithEvents.on?.("switchAccount", handleSwitchAccount);
    } catch {
      // Events may not be supported
    }

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

      const [profileResult, ordinalsResult] = await Promise.allSettled([
        wallet.getSocialProfile(),
        wallet.getOrdinals(),
      ]);

      if (profileResult.status === "fulfilled" && profileResult.value) {
        setSocialProfile({
          displayName: profileResult.value.displayName,
          avatar: profileResult.value.avatar,
        });
      }

      if (ordinalsResult.status === "fulfilled") {
        const result = ordinalsResult.value;
        let rawOrdinals: RawOrdinal[] = [];
        if (Array.isArray(result)) {
          rawOrdinals = result as RawOrdinal[];
        } else if (result && "data" in result) {
          rawOrdinals = (result.data || []) as RawOrdinal[];
        }
        setOrdinals(normalizeOrdinals(rawOrdinals));
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

  const value = useMemo(
    () => ({
      wallet,
      isConnected,
      address,
      pubKey,
      ordAddress,
      identityAddress,
      socialProfile,
      ordinals,
      connect,
      disconnect,
      refreshOrdinals,
    }),
    [
      wallet,
      isConnected,
      address,
      pubKey,
      ordAddress,
      identityAddress,
      socialProfile,
      ordinals,
      connect,
      disconnect,
      refreshOrdinals,
    ],
  );

  return createElement(WalletContext.Provider, { value }, children);
}

export function useWallet(): WalletState {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within WalletProvider");
  }
  return context;
}
