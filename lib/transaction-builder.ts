/**
 * BitPic Transaction Builder
 *
 * Creates OP_RETURN transactions with:
 * - BitPic protocol prefix (18pAqbYqhzErT6Zk3a5dwxHtB9icv8jH2p)
 * - Paymail, public key, and signature
 * - B protocol for binary data
 * - Image data with mime type
 */

const BITPIC_PREFIX = "18pAqbYqhzErT6Zk3a5dwxHtB9icv8jH2p";
const B_PROTOCOL_PREFIX = "19HxigV4QyBv3tHpQVcUEQyq1pzZVdoAut";

export interface SignedMessage {
  address: string;
  pubKey: string;
  sig: string;
  message: string;
}

export interface BitPicTransactionData {
  paymail: string;
  publicKey: string;
  signature: string;
  imageData: string; // base64
  mimeType: "image/png" | "image/jpeg";
}

/**
 * Build BitPic transaction OP_RETURN data
 * Returns array of strings/buffers for Yours Wallet's sendBsv data field
 *
 * Format matches existing BitPic transactions:
 * B protocol (image) | BitPic protocol (metadata)
 */
export function buildBitPicOpReturn(data: BitPicTransactionData): string[] {
  const { paymail, publicKey, signature, imageData, mimeType } = data;

  // Convert base64 image to buffer
  const imageBuffer = base64ToBuffer(imageData);

  return [
    // B protocol tape (image data)
    B_PROTOCOL_PREFIX,
    imageBuffer,
    mimeType,
    "binary",
    "|", // Pipe separator
    // BitPic protocol tape (metadata)
    BITPIC_PREFIX,
    paymail,
    publicKey,
    signature,
  ];
}

/**
 * Convert base64 string to Buffer
 */
function base64ToBuffer(base64: string): string {
  // Remove data URL prefix if present
  const base64Data = base64.replace(/^data:image\/\w+;base64,/, "");

  // For browser environment, convert to hex string
  if (typeof window !== "undefined") {
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    // Return as hex string for wallet
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  // Node.js environment
  return Buffer.from(base64Data, "base64").toString("hex");
}

/**
 * Estimate transaction size in bytes
 * Used to calculate fees (1 sat/byte minimum)
 */
export function estimateTransactionSize(imageDataBase64: string): number {
  const imageSize = Math.ceil((imageDataBase64.length * 3) / 4); // base64 to bytes
  const metadataSize = 200; // Approximate size of metadata
  const baseTransactionSize = 250; // Base transaction overhead

  return baseTransactionSize + metadataSize + imageSize;
}

/**
 * Calculate recommended fee in satoshis
 */
export function calculateFee(
  imageSizeBytes: number,
  satoshisPerByte = 1,
): number {
  return estimateTransactionSize(imageSizeBytes.toString()) * satoshisPerByte;
}

/**
 * Validate paymail format
 */
export function isValidPaymail(paymail: string): boolean {
  const paymailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return paymailRegex.test(paymail);
}

/**
 * Validate image format and size
 */
export interface ImageValidation {
  valid: boolean;
  error?: string;
  mimeType?: "image/png" | "image/jpeg";
  sizeBytes?: number;
}

export function validateImage(
  base64Data: string,
  maxSizeMB = 1,
): ImageValidation {
  // Extract mime type from data URL
  const mimeMatch = base64Data.match(/^data:(image\/(?:png|jpeg));base64,/);

  if (!mimeMatch) {
    return {
      valid: false,
      error: "Invalid image format. Only PNG and JPEG are supported.",
    };
  }

  const mimeType = mimeMatch[1] as "image/png" | "image/jpeg";

  // Calculate size
  const base64String = base64Data.replace(/^data:image\/\w+;base64,/, "");
  const sizeBytes = Math.ceil((base64String.length * 3) / 4);
  const sizeMB = sizeBytes / (1024 * 1024);

  if (sizeMB > maxSizeMB) {
    return {
      valid: false,
      error: `Image too large. Maximum size is ${maxSizeMB}MB, got ${sizeMB.toFixed(2)}MB.`,
      sizeBytes,
    };
  }

  return {
    valid: true,
    mimeType,
    sizeBytes,
  };
}
