import { type NextRequest, NextResponse } from "next/server";
import { extractHandle } from "@/lib/paymail";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
) {
  try {
    const { handle: rawHandle } = await params;
    const handle = extractHandle(rawHandle);

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

    // Return full paymail address in handle field per BRC-29
    const fullPaymail = `${handle}@bitpic.net`;

    return NextResponse.json({
      bsvalias: "1.0",
      handle: fullPaymail,
      pubkey: data.identityPubkey,
    });
  } catch (error) {
    console.error("PKI endpoint error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
