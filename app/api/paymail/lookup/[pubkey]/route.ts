import { type NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ pubkey: string }> },
) {
  try {
    const { pubkey } = await params;

    if (!pubkey) {
      return NextResponse.json(
        { error: "Pubkey is required" },
        { status: 400 },
      );
    }

    // Look up paymail by identity pubkey in Go backend
    const response = await fetch(
      `${API_URL}/api/paymail/lookup/${encodeURIComponent(pubkey)}`,
    );

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: "No paymail found for this pubkey", found: false },
          { status: 404 },
        );
      }
      return NextResponse.json(
        { error: "Failed to lookup paymail" },
        { status: response.status },
      );
    }

    const data = await response.json();

    return NextResponse.json({
      found: true,
      handle: data.handle,
      paymail: data.paymail,
    });
  } catch (error) {
    console.error("Paymail lookup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
