export async function GET() {
  const host = "bitpic.net";

  return Response.json({
    bsvalias: "1.0",
    capabilities: {
      pki: `https://${host}/api/paymail/{alias}@{domain.tld}/id`,
      paymentDestination: `https://${host}/api/paymail/{alias}@{domain.tld}/payment-destination`,
      verifyPublicKeyOwner: `https://${host}/api/paymail/{alias}@{domain.tld}/verify-pubkey/{pubkey}`,
    },
  });
}
