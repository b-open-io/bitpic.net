import { type NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ handle: string; pubkey: string }> },
) {
  try {
    const { handle, pubkey } = await params;

    // Fetch paymail data from Go backend
    const response = await fetch(`${API_URL}/api/paymail/${handle}`);

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: "Paymail handle not found" },
          { status: 404 },
        );
      }
      return NextResponse.json(
        { error: "Failed to fetch paymail data" },
        { status: response.status },
      );
    }

    const data = await response.json();

    if (!data.pubkey) {
      return NextResponse.json(
        { error: "Public key not configured" },
        { status: 400 },
      );
    }

    // Compare the provided pubkey with the registered pubkey
    const match =
      data.pubkey.toLowerCase() === pubkey.toLowerCase() ||
      data.paymentPubkey?.toLowerCase() === pubkey.toLowerCase();

    return NextResponse.json({
      match,
      handle: data.handle || handle,
    });
  } catch (error) {
    console.error("Verify pubkey endpoint error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
