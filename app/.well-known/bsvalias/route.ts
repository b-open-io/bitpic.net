export async function GET() {
  // Get host from request or use default
  const host = "bitpic.net";

  return Response.json({
    bsvalias: "1.0",
    capabilities: {
      // BRC-29: Public Key Infrastructure
      pki: `https://${host}/api/paymail/{alias}@{domain.tld}/id`,
      // BRC-29: Payment Destination (returns P2PKH script)
      paymentDestination: `https://${host}/api/paymail/{alias}@{domain.tld}/payment-destination`,
      // BRC-29: Verify Public Key Owner
      verifyPublicKeyOwner: `https://${host}/api/paymail/{alias}@{domain.tld}/verify-pubkey/{pubkey}`,
      // Ordinals receive address (custom capability - no standard BRFC yet)
      receiveOrdinals: `https://${host}/api/paymail/{alias}@{domain.tld}/ordinals`,
    },
  });
}
