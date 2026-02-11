const PAYMAIL_DOMAIN = "bitpic.net";

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
