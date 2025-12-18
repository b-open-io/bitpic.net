import { type NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

interface RegisterRequest {
  handle: string;
  identityPubkey: string;
  paymentAddress: string;
  ordAddress: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: RegisterRequest = await request.json();

    // Validate required fields
    if (
      !body.handle ||
      !body.identityPubkey ||
      !body.paymentAddress ||
      !body.ordAddress
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Validate handle format (alphanumeric only, 3-20 chars)
    if (!/^[a-zA-Z0-9]{3,20}$/.test(body.handle)) {
      return NextResponse.json(
        {
          error: "Handle must be 3-20 alphanumeric characters",
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

    // Store paymail record in Go backend via Redis
    const storeResponse = await fetch(`${API_URL}/api/paymail/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        handle: body.handle.toLowerCase(),
        identityPubkey: body.identityPubkey,
        paymentAddress: body.paymentAddress,
        ordAddress: body.ordAddress,
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
      paymail: `${body.handle.toLowerCase()}@bitpic.net`,
    });
  } catch (error) {
    console.error("Registration endpoint error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
