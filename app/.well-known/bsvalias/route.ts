import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const host = request.headers.get("host") || "bitpic.net";
  const proto = request.headers.get("x-forwarded-proto") || "https";
  const baseUrl = `${proto}://${host}`;

  return NextResponse.json({
    bsvalias: "1.0",
    capabilities: {
      // PKI - Public Key Infrastructure (standard name)
      pki: `${baseUrl}/api/paymail/{alias}@{domain.tld}/id`,
      // Payment Destination (standard name)
      paymentDestination: `${baseUrl}/api/paymail/{alias}@{domain.tld}/payment-destination`,
      // Verify Public Key Owner - BRFC a9f510c16bde
      a9f510c16bde: `${baseUrl}/api/paymail/{alias}@{domain.tld}/verify-pubkey/{pubkey}`,
      // Public Profile - BRFC f12f968c92d6
      f12f968c92d6: `${baseUrl}/api/paymail/{alias}@{domain.tld}/public-profile`,
    },
  });
}
