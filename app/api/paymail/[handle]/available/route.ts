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

    // Check if paymail handle exists in Go backend
    const response = await fetch(`${API_URL}/api/paymail/${handle}`);

    // If we get a 404, the handle is available
    // If we get a 200, the handle is taken
    const available = response.status === 404;

    return NextResponse.json({
      available,
      handle,
    });
  } catch (error) {
    console.error("Check availability endpoint error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
