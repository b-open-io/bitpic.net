"use client";

import {
  createContext as createOneSatContext,
  getOrdinals,
  getProfile,
  type OneSatContext,
  type WalletOutput,
} from "@1sat/actions";
import { OneSatServices } from "@1sat/client";
import { useWallet as useOneSatWallet } from "@1sat/react";
import { PublicKey, type WalletInterface } from "@bsv/sdk";
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

// Single shared services instance for backend lookups (ORDFS, overlay, etc.)
const services = new OneSatServices("main");

export interface SocialProfile {
  displayName?: string;
  avatar?: string;
}

// Normalized ordinal structure for our app and SDK compatibility.
// Built from BRC-100 WalletOutput tags (origin, type:<mime>, name, ...).
export interface Ordinal {
  origin: string;
  outpoint: string;
  satoshis: number;
  script: string;
  spend: string;
  height: number;
  idx: number;
  // Raw BRC-100 output tags, kept verbatim for callers that need to match
  // multi-segment tags like `registry:style:Name@1.0.0` (theme detection).
  tags: string[];
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

// Parse BRC-100 output tags ("key:value") into a flat record.
function parseTags(tags?: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  if (!tags) return map;
  for (const tag of tags) {
    const sep = tag.indexOf(":");
    if (sep > 0) {
      map[tag.slice(0, sep)] = tag.slice(sep + 1);
    } else {
      map[tag] = "";
    }
  }
  return map;
}

// BRC-100 uses txid.vout outpoints; ordfs, the theme registry, and the
// BitPic protocol all expect txid_vout. Normalize to the underscore form.
function toUnderscoreOutpoint(outpoint: string): string {
  const dot = outpoint.lastIndexOf(".");
  return dot > 0
    ? `${outpoint.slice(0, dot)}_${outpoint.slice(dot + 1)}`
    : outpoint;
}

// Transform BRC-100 WalletOutputs into our normalized Ordinal shape.
function normalizeOrdinals(outputs: WalletOutput[]): Ordinal[] {
  return outputs.map((output) => {
    const rawTags = output.tags ?? [];
    const map = parseTags(rawTags);
    const mimeType = map.type;
    return {
      origin: toUnderscoreOutpoint(map.origin || output.outpoint),
      outpoint: toUnderscoreOutpoint(output.outpoint),
      satoshis: output.satoshis,
      script: output.lockingScript || "",
      spend: "",
      height: 0,
      idx: 0,
      tags: rawTags,
      map,
      data: mimeType ? { insc: { file: { type: mimeType } } } : undefined,
    };
  });
}

// Derive a wallet-controlled address (bsv payment / ord) under the wallet
// protocol. Matches the @1sat reference wallet-actions derivation.
async function deriveAddress(
  wallet: WalletInterface,
  keyID: "bsv" | "ord",
): Promise<string> {
  const { publicKey } = await wallet.getPublicKey({
    protocolID: [2, "wallet"],
    keyID,
    counterparty: "self",
  });
  return PublicKey.fromString(publicKey).toAddress();
}

// Convert a profile image reference (e.g. "1sat://<outpoint>") to a fetchable URL.
function resolveProfileImage(image?: string): string | undefined {
  if (!image) return undefined;
  if (image.startsWith("1sat://")) {
    return `https://ordfs.network/content/${image.slice("1sat://".length)}`;
  }
  return image;
}

export interface WalletState {
  ctx: OneSatContext | null;
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
  const {
    wallet,
    status,
    identityKey,
    connect: connectWallet,
    disconnect: disconnectWallet,
  } = useOneSatWallet();

  const [address, setAddress] = useState<string | null>(null);
  const [ordAddress, setOrdAddress] = useState<string | null>(null);
  const [identityAddress, setIdentityAddress] = useState<string | null>(null);
  const [socialProfile, setSocialProfile] = useState<SocialProfile | null>(
    null,
  );
  const [ordinals, setOrdinals] = useState<Ordinal[]>([]);

  const isConnected = status === "connected";

  // Build the opaque action context once the wallet is connected.
  const ctx = useMemo<OneSatContext | null>(() => {
    if (status !== "connected" || !wallet) return null;
    return createOneSatContext(wallet, { chain: "main", services });
  }, [wallet, status]);

  const resetState = useCallback(() => {
    setAddress(null);
    setOrdAddress(null);
    setIdentityAddress(null);
    setSocialProfile(null);
    setOrdinals([]);
  }, []);

  const refreshOrdinals = useCallback(async () => {
    if (!ctx) return;
    try {
      const result = await getOrdinals.execute(ctx, {});
      setOrdinals(normalizeOrdinals(result.outputs || []));
    } catch (err) {
      console.error("Failed to fetch ordinals:", err);
    }
  }, [ctx]);

  // Hydrate derived account data (addresses, profile, ordinals) on connect.
  const hydrate = useCallback(async () => {
    if (!ctx || !wallet) return;

    const [bsvResult, ordResult, profileResult, ordinalsResult] =
      await Promise.allSettled([
        deriveAddress(wallet, "bsv"),
        deriveAddress(wallet, "ord"),
        getProfile.execute(ctx, {}),
        getOrdinals.execute(ctx, {}),
      ]);

    if (bsvResult.status === "fulfilled") setAddress(bsvResult.value);
    if (ordResult.status === "fulfilled") setOrdAddress(ordResult.value);

    // Identity address is derived from the identity public key.
    if (identityKey) {
      try {
        setIdentityAddress(PublicKey.fromString(identityKey).toAddress());
      } catch {
        setIdentityAddress(null);
      }
    }

    if (profileResult.status === "fulfilled" && !profileResult.value.error) {
      // BAP profiles use a schema.org Person shape: { name, alternateName, image }.
      const profile = profileResult.value.profile as
        | Record<string, unknown>
        | undefined;
      const displayName =
        typeof profile?.name === "string"
          ? profile.name
          : typeof profile?.alternateName === "string"
            ? profile.alternateName
            : undefined;
      const avatar = resolveProfileImage(
        typeof profile?.image === "string" ? profile.image : undefined,
      );
      setSocialProfile(displayName || avatar ? { displayName, avatar } : null);
    }

    if (ordinalsResult.status === "fulfilled") {
      setOrdinals(normalizeOrdinals(ordinalsResult.value.outputs || []));
    }
  }, [ctx, wallet, identityKey]);

  useEffect(() => {
    if (ctx) {
      hydrate();
    } else {
      resetState();
    }
  }, [ctx, hydrate, resetState]);

  const connect = useCallback(async (): Promise<string | undefined> => {
    try {
      await connectWallet();
      return identityKey ?? undefined;
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      throw error;
    }
  }, [connectWallet, identityKey]);

  const disconnect = useCallback(() => {
    disconnectWallet();
    resetState();
  }, [disconnectWallet, resetState]);

  const value = useMemo(
    () => ({
      ctx,
      isConnected,
      address,
      pubKey: identityKey,
      ordAddress,
      identityAddress,
      socialProfile,
      ordinals,
      connect,
      disconnect,
      refreshOrdinals,
    }),
    [
      ctx,
      isConnected,
      address,
      identityKey,
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
