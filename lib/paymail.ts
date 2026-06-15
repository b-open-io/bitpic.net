import { P2PKH } from "@bsv/sdk";

const PAYMAIL_DOMAIN = "bitpic.net";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export interface PaymailData {
  handle?: string;
  paymentAddress?: string;
  ordAddress?: string;
  identityPubkey?: string;
}

/** Fetch a registered paymail's stored record from the Go backend. */
export async function fetchPaymailData(
  handle: string,
): Promise<PaymailData | null> {
  const res = await fetch(`${API_URL}/api/paymail/${handle}`);
  if (!res.ok) return null;
  return (await res.json()) as PaymailData;
}

/** Convert a base58check P2PKH address to its locking script hex. */
export function addressToP2PKHScript(address: string): string {
  return new P2PKH().lock(address).toHex();
}

/**
 * Extract handle from a paymail address
 * e.g., "satchmo@bitpic.net" -> "satchmo"
 * or just "satchmo" -> "satchmo"
 */
export function extractHandle(paymailOrHandle: string): string {
  const value = paymailOrHandle.trim();
  if (!value) return "";

  const atIndex = value.indexOf("@");
  if (atIndex > 0) {
    const handle = value.substring(0, atIndex).trim();
    const domain = value
      .substring(atIndex + 1)
      .trim()
      .toLowerCase();
    if (!handle || domain !== PAYMAIL_DOMAIN) {
      return "";
    }
    return handle;
  }

  return value;
}
