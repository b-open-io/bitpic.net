import { randomBytes } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import {
  addressToP2PKHScript,
  extractHandle,
  fetchPaymailData,
} from "@/lib/paymail";

// BRFC 2a40af698840 — P2P Payment Destination.
// Returns output script(s) + a reference. Because BitPic paymails use the
// wallet's static P1SAT deposit address (already wallet-owned), we return a
// plain P2PKH output to that address rather than a BRC-29 derived one.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
) {
  try {
    const { handle: rawHandle } = await params;
    const handle = extractHandle(rawHandle).toLowerCase();
    if (!handle) {
      return NextResponse.json(
        { error: "Invalid paymail handle or domain" },
        { status: 400 },
      );
    }

    let satoshis = 0;
    try {
      const body = await request.json();
      satoshis = Number(body?.satoshis) || 0;
    } catch {
      // No/!invalid body — sender may negotiate amount later; default to 0.
    }

    const data = await fetchPaymailData(handle);
    if (!data?.paymentAddress) {
      return NextResponse.json({ error: "Paymail not found" }, { status: 404 });
    }

    const script = addressToP2PKHScript(data.paymentAddress);
    const reference = randomBytes(16).toString("hex");

    return NextResponse.json({
      reference,
      outputs: [{ satoshis, script }],
    });
  } catch (error) {
    console.error("p2p-payment-destination error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
