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

    if (!handle) {
      return NextResponse.json(
        { error: "Handle is required" },
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
    const paymail = `${handle}@bitpic.net`;

    // Check if user has a BitPic avatar
    const avatarResponse = await fetch(
      `${API_URL}/api/avatar/${encodeURIComponent(paymail)}`,
    );

    let avatar: string | undefined;
    if (avatarResponse.ok) {
      const avatarData = await avatarResponse.json();
      if (avatarData.url) {
        avatar = avatarData.url;
      }
    }

    // If no BitPic avatar, use a default or let client handle it
    if (!avatar) {
      // Return without avatar - client can fall back to default
      avatar = `https://bitpic.net/u/${paymail}`;
    }

    return NextResponse.json({
      name: data.handle || handle,
      avatar,
    });
  } catch (error) {
    console.error("Public profile endpoint error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
