// Paymail registration configuration
export const PAYMAIL_FEE_USD = Number(
  process.env.NEXT_PUBLIC_PAYMAIL_FEE_USD || "1",
);

export const PAYMAIL_FEE_ADDRESS =
  process.env.NEXT_PUBLIC_PAYMAIL_FEE_ADDRESS || "";

// Approximate satoshis per dollar (updated periodically)
// This is a rough estimate - actual conversion should use live rates
export const SATS_PER_USD = 20000;

export function formatFeeUSD(amount: number = PAYMAIL_FEE_USD): string {
  return `$${amount.toFixed(2)}`;
}

export function estimateFeeSatoshis(
  usdAmount: number = PAYMAIL_FEE_USD,
): number {
  return Math.ceil(usdAmount * SATS_PER_USD);
}
