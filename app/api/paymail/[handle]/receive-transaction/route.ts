import { Transaction } from "@bsv/sdk";
import { type NextRequest, NextResponse } from "next/server";
import {
  addressToP2PKHScript,
  extractHandle,
  fetchPaymailData,
} from "@/lib/paymail";

// 1sat-stack broadcast endpoint: broadcasts via arcade with the stack's own
// callback token, so the tx is ingested into the 1sat index immediately — which
// is what lets the recipient's wallet see the payment before it is mined.
const ONESAT_API_URL = process.env.ONESAT_API_URL || "https://api.1sat.app";

interface ReceiveTransactionRequest {
  hex?: string;
  reference?: string;
  metadata?: unknown;
}

// BRFC 5f1323cddf31 — P2P Receive Transaction.
// The sender delivers the signed raw tx here. We verify it pays this paymail's
// address, then hand it to 1sat-stack for broadcast + instant ingest.
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

    const body = (await request.json()) as ReceiveTransactionRequest;
    if (!body.hex) {
      return NextResponse.json(
        { error: "Missing transaction hex" },
        { status: 400 },
      );
    }

    const data = await fetchPaymailData(handle);
    if (!data?.paymentAddress) {
      return NextResponse.json({ error: "Paymail not found" }, { status: 404 });
    }

    let tx: Transaction;
    try {
      tx = Transaction.fromHex(body.hex);
    } catch {
      return NextResponse.json(
        { error: "Invalid transaction hex" },
        { status: 400 },
      );
    }

    // Only relay transactions that actually pay this paymail's address.
    const expectedScript = addressToP2PKHScript(data.paymentAddress);
    const paysRecipient = tx.outputs.some(
      (o) => o.lockingScript.toHex() === expectedScript,
    );
    if (!paysRecipient) {
      return NextResponse.json(
        { error: "Transaction does not pay this paymail" },
        { status: 400 },
      );
    }

    const txid = tx.id("hex");

    // Broadcast + ingest through 1sat-stack (api.1sat.app) for instant receive.
    const res = await fetch(`${ONESAT_API_URL}/1sat/tx`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawTx: body.hex }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("1sat-stack broadcast failed:", res.status, detail);
      return NextResponse.json(
        { error: "Failed to broadcast transaction" },
        { status: 502 },
      );
    }

    return NextResponse.json({
      txid,
      note: "Transaction received and broadcast",
    });
  } catch (error) {
    console.error("receive-transaction error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
