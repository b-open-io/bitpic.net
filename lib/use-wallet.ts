"use client";

import {
  createContext as createOneSatContext,
  deriveDepositAddresses,
  getOrdinals,
  getProfile,
  type OneSatContext,
  type WalletOutput,
} from "@1sat/actions";
import { OneSatServices } from "@1sat/client";
import { useWallet as useOneSatWallet } from "@1sat/react";
import { PublicKey } from "@bsv/sdk";
import { parse } from "bitcoin-image";
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
import { api } from "./api";

// Single shared services instance for backend lookups (ORDFS, overlay, etc.)
const services = new OneSatServices("main");

export interface SocialProfile {
  displayName?: string;
  avatar?: string;
  /** Outpoint (txid_vout) of the profile image ordinal, if on-chain. */
  imageOutpoint?: string;
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

// 1sat:// is an ordinal-scheme alias bitcoin-image doesn't recognize; map it to
// ord:// so its parser/renderer handle it.
function normalizeImageRef(image?: string): string | undefined {
  if (!image) return undefined;
  return image.startsWith("1sat://")
    ? `ord://${image.slice("1sat://".length)}`
    : image;
}

// Extract a txid_vout outpoint from an image reference using bitcoin-image.
function imageOutpointFrom(ref?: string): string | undefined {
  if (!ref) return undefined;
  const parsed = parse(ref);
  return parsed.isValid && parsed.txid
    ? `${parsed.txid}_${parsed.vout ?? 0}`
    : undefined;
}

export interface WalletState {
  ctx: OneSatContext | null;
  isConnected: boolean;
  address: string | null;
  pubKey: string | null;
  ordAddress: string | null;
  identityAddress: string | null;
  socialProfile: SocialProfile | null;
  // The BitPic paymail registered to this wallet's identity key, if any.
  paymail: string | null;
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
  const [paymail, setPaymail] = useState<string | null>(null);
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
    setPaymail(null);
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
    if (!ctx) return;

    const [depositResult, profileResult, ordinalsResult, paymailResult] =
      await Promise.allSettled([
        deriveDepositAddresses.execute(ctx, { startIndex: 0, count: 1 }),
        getProfile.execute(ctx, {}),
        getOrdinals.execute(ctx, {}),
        identityKey
          ? api.lookupPaymailByPubkey(identityKey)
          : Promise.resolve(null),
      ]);

    if (depositResult.status === "fulfilled") {
      // 1Sat wallets receive BSV, ordinals, and tokens at the same P1SAT
      // deposit address (primary = index 0) — the address the wallet shows.
      const deposit = depositResult.value.derivations?.[0]?.address ?? null;
      setAddress(deposit);
      setOrdAddress(deposit);
    }

    if (paymailResult.status === "fulfilled" && paymailResult.value?.found) {
      setPaymail(paymailResult.value.paymail ?? null);
    }

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
      const imageRef = normalizeImageRef(
        typeof profile?.image === "string" ? profile.image : undefined,
      );
      const imageOutpoint = imageOutpointFrom(imageRef);
      setSocialProfile(
        displayName || imageRef
          ? { displayName, avatar: imageRef, imageOutpoint }
          : null,
      );
    }

    if (ordinalsResult.status === "fulfilled") {
      setOrdinals(normalizeOrdinals(ordinalsResult.value.outputs || []));
    }
  }, [ctx, identityKey]);

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
      paymail,
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
      paymail,
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
