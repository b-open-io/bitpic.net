export async function GET() {
  return Response.json({
    bsvalias: "1.0",
    capabilities: {
      pki: "https://bitpic.net/api/paymail/{alias}@{domain.tld}/id",
      paymentDestination:
        "https://bitpic.net/api/paymail/{alias}@{domain.tld}/payment-destination",
      verifyPublicKeyOwner:
        "https://bitpic.net/api/paymail/{alias}@{domain.tld}/verify-pubkey/{pubkey}",
      "5f1323cddf31":
        "https://bitpic.net/api/paymail/{alias}@{domain.tld}/ordinals",
    },
  });
}
