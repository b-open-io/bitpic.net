/**
 * Extract handle from a paymail address
 * e.g., "satchmo@bitpic.net" -> "satchmo"
 * or just "satchmo" -> "satchmo"
 */
export function extractHandle(paymailOrHandle: string): string {
  const atIndex = paymailOrHandle.indexOf("@");
  return atIndex > 0 ? paymailOrHandle.substring(0, atIndex) : paymailOrHandle;
}
