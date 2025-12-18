import { type NextRequest, NextResponse } from "next/server";
import { extractHandle } from "@/lib/paymail";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export async function POST(
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

    if (!data.paymentAddress) {
      return NextResponse.json(
        { error: "Payment address not configured" },
        { status: 400 },
      );
    }

    // Convert P2PKH address to output script hex
    // P2PKH script: OP_DUP OP_HASH160 <pubkeyhash> OP_EQUALVERIFY OP_CHECKSIG
    // For BRC-29, we return a simple P2PKH script hex
    // The actual script generation should use the address's pubkey hash
    // For now, we'll return the address and let the backend handle script generation
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

// Convert Bitcoin address to P2PKH script hex
function addressToP2PKHScript(address: string): string {
  try {
    // Decode base58 address to get pubkey hash
    const decoded = base58Decode(address);
    // Remove version byte (first byte) and checksum (last 4 bytes)
    const pubkeyHash = decoded.slice(1, -4);
    const pubkeyHashHex = Buffer.from(pubkeyHash).toString("hex");

    // Build P2PKH script: OP_DUP OP_HASH160 <pubkeyhash> OP_EQUALVERIFY OP_CHECKSIG
    const script = `76a914${pubkeyHashHex}88ac`;
    return script;
  } catch (error) {
    console.error("Failed to convert address to script:", error);
    throw new Error("Invalid address format");
  }
}

// Base58 decode function
function base58Decode(str: string): Uint8Array {
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const base = BigInt(58);
  let num = BigInt(0);

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const digit = ALPHABET.indexOf(char);
    if (digit < 0) {
      throw new Error(`Invalid base58 character: ${char}`);
    }
    num = num * base + BigInt(digit);
  }

  // Convert to bytes
  const bytes: number[] = [];
  while (num > 0n) {
    bytes.unshift(Number(num % 256n));
    num = num / 256n;
  }

  // Add leading zero bytes for leading '1's in the string
  for (let i = 0; i < str.length && str[i] === "1"; i++) {
    bytes.unshift(0);
  }

  return new Uint8Array(bytes);
}
