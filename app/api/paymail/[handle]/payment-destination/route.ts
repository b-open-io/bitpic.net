import { type NextRequest, NextResponse } from "next/server";
import { addressToP2PKHScript, extractHandle } from "@/lib/paymail";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export async function POST(
  _request: NextRequest,
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

    if (!data.paymentAddress) {
      return NextResponse.json(
        { error: "Payment address not configured" },
        { status: 400 },
      );
    }

    const output = addressToP2PKHScript(data.paymentAddress);

    return NextResponse.json({
      output,
    });
  } catch (error) {
    console.error("Payment destination endpoint error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
