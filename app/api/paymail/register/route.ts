import { type NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
const WOC_API = "https://api.whatsonchain.com/v1/bsv/main";

interface RegisterRequest {
  handle: string;
  paymentTxid: string;
  paymentAddress: string;
  paymentPubkey: string;
  ordAddress: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: RegisterRequest = await request.json();

    // Validate required fields
    if (
      !body.handle ||
      !body.paymentTxid ||
      !body.paymentAddress ||
      !body.paymentPubkey ||
      !body.ordAddress
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Validate handle format (alphanumeric and hyphens only)
    if (!/^[a-zA-Z0-9-]+$/.test(body.handle)) {
      return NextResponse.json(
        {
          error: "Handle must contain only alphanumeric characters and hyphens",
        },
        { status: 400 },
      );
    }

    // Check if handle is already taken
    const availabilityResponse = await fetch(
      `${API_URL}/api/paymail/${body.handle}`,
    );
    if (availabilityResponse.ok) {
      return NextResponse.json(
        { error: "Handle already taken" },
        { status: 409 },
      );
    }

    // Verify payment transaction on-chain
    const txResponse = await fetch(`${WOC_API}/tx/${body.paymentTxid}`);
    if (!txResponse.ok) {
      return NextResponse.json(
        { error: "Payment transaction not found on-chain" },
        { status: 400 },
      );
    }

    const txData = await txResponse.json();

    // Verify transaction has confirmations
    if (!txData.confirmations || txData.confirmations < 1) {
      return NextResponse.json(
        { error: "Payment transaction not confirmed yet" },
        { status: 400 },
      );
    }

    // Store paymail record in Go backend via Redis
    const storeResponse = await fetch(`${API_URL}/api/paymail/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        handle: body.handle,
        paymentTxid: body.paymentTxid,
        paymentAddress: body.paymentAddress,
        paymentPubkey: body.paymentPubkey,
        ordAddress: body.ordAddress,
        pubkey: body.paymentPubkey, // Use payment pubkey as default pubkey
      }),
    });

    if (!storeResponse.ok) {
      const errorData = await storeResponse.json().catch(() => ({}));
      return NextResponse.json(
        {
          error: errorData.error || "Failed to register paymail",
        },
        { status: storeResponse.status },
      );
    }

    return NextResponse.json({
      success: true,
      paymail: `${body.handle}@bitpic.net`,
    });
  } catch (error) {
    console.error("Registration endpoint error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
