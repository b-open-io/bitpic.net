/**
 * BitPic Transaction Builder
 *
 * Builds the BitPic OP_RETURN as two Bitcom protocols separated by a pipe:
 *
 *   OP_FALSE OP_RETURN
 *     19Hxig… (B)       <file|uri>  <media-type>  <encoding>
 *     |
 *     18pAq…  (BitPic)  <paymail>   <pubkey>      <signature>
 *
 * Two content modes carried in the B tape:
 *   - embed:     raw image bytes, media type image/*, encoding binary
 *   - reference: a text/uri-list pointing at ord://<txid>_<vout> (ordinals) or
 *                b://<txid>_<vout> (B records). Resolved via ORDFS at serve time.
 */

import { BitCom, type Protocol } from "@1sat/templates";
import { Script, Utils } from "@bsv/sdk";

const BITPIC_PREFIX = "18pAqbYqhzErT6Zk3a5dwxHtB9icv8jH2p";
const B_PREFIX = "19HxigV4QyBv3tHpQVcUEQyq1pzZVdoAut";

export interface BitPicTransactionData {
  paymail: string;
  publicKey: string;
  signature: string;
  imageBytes: number[];
  mimeType: "image/png" | "image/jpeg";
}

export interface BitPicRefTransactionData {
  paymail: string;
  publicKey: string;
  signature: string;
  /** Reference URI, e.g. "ord://<txid>_<vout>" or "b://<txid>_<vout>". */
  uri: string;
}

// Push each field as its own pushdata chunk, returning the raw segment bytes.
function segment(fields: Array<string | number[]>): number[] {
  const script = new Script();
  for (const field of fields) {
    script.writeBin(
      typeof field === "string" ? Utils.toArray(field, "utf8") : field,
    );
  }
  return script.toBinary();
}

// Compose [B | BitPic] and prepend OP_FALSE for the safe OP_FALSE OP_RETURN form.
function bitpicScript(
  bSegment: number[],
  paymail: string,
  publicKey: string,
  signature: string,
): string {
  const protocols: Protocol[] = [
    { protocol: B_PREFIX, script: bSegment, pos: 0 },
    {
      protocol: BITPIC_PREFIX,
      script: segment([paymail, publicKey, signature]),
      pos: 0,
    },
  ];
  return `00${new BitCom(protocols).lock().toHex()}`;
}

/** Build the locking script hex for an embedded-image BitPic. */
export function buildBitPicScript(data: BitPicTransactionData): string {
  const bSegment = segment([data.imageBytes, data.mimeType, "binary"]);
  return bitpicScript(bSegment, data.paymail, data.publicKey, data.signature);
}

/** Build the locking script hex for a reference (uri-list) BitPic. */
export function buildBitPicRefScript(data: BitPicRefTransactionData): string {
  const bSegment = segment([data.uri, "text/uri-list", "utf-8"]);
  return bitpicScript(bSegment, data.paymail, data.publicKey, data.signature);
}

/** Normalize an outpoint to txid_vout (underscore) form. */
export function normalizeOutpoint(outpoint: string): string {
  const dot = outpoint.lastIndexOf(".");
  return dot > 0
    ? `${outpoint.slice(0, dot)}_${outpoint.slice(dot + 1)}`
    : outpoint;
}

/** Validate a txid_vout outpoint. */
export function isValidOutpoint(outpoint: string): boolean {
  const parts = outpoint.split("_");
  if (parts.length !== 2) return false;
  const [txid, vout] = parts;
  return /^[a-fA-F0-9]{64}$/.test(txid) && /^\d+$/.test(vout);
}

/** Build an ord:// reference URI from an ordinal origin/outpoint. */
export function ordUri(origin: string): string {
  return `ord://${normalizeOutpoint(origin)}`;
}

/** Decode a base64 (or data-URL) image to raw bytes. */
export function imageToBytes(base64OrDataUrl: string): number[] {
  const base64 = base64OrDataUrl.replace(/^data:image\/\w+;base64,/, "");
  return Utils.toArray(base64, "base64");
}

/** SHA-256 hex of the given bytes (browser SubtleCrypto). */
export async function sha256Hex(bytes: number[]): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface ImageValidation {
  valid: boolean;
  error?: string;
  mimeType?: "image/png" | "image/jpeg";
  sizeBytes?: number;
}

export function validateImage(
  base64Data: string,
  maxSizeMB = 10,
): ImageValidation {
  const mimeMatch = base64Data.match(/^data:(image\/(?:png|jpeg));base64,/);
  if (!mimeMatch) {
    return {
      valid: false,
      error: "Invalid image format. Only PNG and JPEG are supported.",
    };
  }
  const mimeType = mimeMatch[1] as "image/png" | "image/jpeg";
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
  return { valid: true, mimeType, sizeBytes };
}

export function isValidPaymail(paymail: string): boolean {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(paymail);
}
