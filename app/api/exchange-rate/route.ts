import { NextResponse } from "next/server";
import { PAYMAIL_FEE_USD } from "@/lib/fees";

const WOC_RATE_URL = "https://api.whatsonchain.com/v1/bsv/main/exchangerate";

// Rate is cached briefly so bursts of registrations don't hammer WhatsOnChain.
// The quote is only used to size a $1 fee, so ~1 minute of staleness is fine.
export const revalidate = 60;

interface WocRate {
  rate?: number;
  currency?: string;
  time?: number;
}

// Returns the current USD/BSV rate and the satoshis needed for the $1 fee.
export async function GET() {
  try {
    const res = await fetch(WOC_RATE_URL, { next: { revalidate: 60 } });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Exchange rate unavailable (${res.status})` },
        { status: 502 },
      );
    }

    const data = (await res.json()) as WocRate;
    if (typeof data.rate !== "number" || data.rate <= 0) {
      return NextResponse.json(
        { error: "Invalid exchange rate response" },
        { status: 502 },
      );
    }

    const satoshis = Math.ceil((PAYMAIL_FEE_USD / data.rate) * 1e8);
    return NextResponse.json({
      usd: PAYMAIL_FEE_USD,
      rate: data.rate,
      satoshis,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch exchange rate",
      },
      { status: 502 },
    );
  }
}
