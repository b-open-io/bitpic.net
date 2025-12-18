export async function GET() {
  const host = "bitpic.net";

  return Response.json({
    bsvalias: "1.0",
    capabilities: {
      // PKI - Public Key Infrastructure (standard name)
      pki: `https://${host}/api/paymail/{alias}@{domain.tld}/id`,
      // Payment Destination (standard name)
      paymentDestination: `https://${host}/api/paymail/{alias}@{domain.tld}/payment-destination`,
      // Verify Public Key Owner - BRFC a9f510c16bde
      a9f510c16bde: `https://${host}/api/paymail/{alias}@{domain.tld}/verify-pubkey/{pubkey}`,
      // Public Profile - BRFC f12f968c92d6
      f12f968c92d6: `https://${host}/api/paymail/{alias}@{domain.tld}/public-profile`,
    },
  });
}
