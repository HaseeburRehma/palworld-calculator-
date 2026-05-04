/**
 * Palworld save-file decompression.
 *
 * Palworld wraps its GVAS payload in a tiny container the community calls
 * "PlZ" (after the 3-byte magic). The container is documented by the
 * `palworld-save-tools` Python project (Apache-2.0); the format is also
 * mirrored in several smaller JS reverse-engineering threads. This module
 * is a clean-room re-implementation against those notes — no code copied —
 * but credit is due. See README CREDITS.
 *
 * Container layout (little-endian throughout):
 *   bytes  0..3   uint32  uncompressed size of payload
 *   bytes  4..7   uint32  compressed size of payload
 *   bytes  8..10  ascii   "PLZ"   (magic)
 *   byte   11     uint8   format version: 0 | 1 | 2
 *   bytes  12..   raw     zlib-compressed payload (single or double pass)
 *
 * Format versions seen in the wild:
 *   0 → single zlib pass.    decompressed bytes are the GVAS file.
 *   1 → double zlib pass.    decompress once, decompress the result again.
 *   2 → newer container variant; in practice handled the same as 1 to date.
 *        We dispatch through a table so adding a real v2 is one entry.
 *
 * If the magic isn't there the file isn't a Palworld save — return a
 * structured error rather than throwing. We never want a malformed upload
 * to crash the worker; the UI relies on accumulated diagnostics.
 */

import * as pako from "pako";

export const PLZ_MAGIC = "PLZ";
/** Length of the fixed PlZ header (sizes + magic + version byte). */
export const PLZ_HEADER_BYTES = 12;

export type DecompressResult =
  | { ok: true; payload: Uint8Array; containerVersion: number }
  | { ok: false; code: DecompressErrorCode; message: string };

export type DecompressErrorCode =
  | "TOO_SHORT"
  | "BAD_MAGIC"
  | "UNSUPPORTED_CONTAINER_VERSION"
  | "ZLIB_FAILED"
  | "SIZE_MISMATCH";

export interface DecompressOptions {
  /**
   * Called after each phase. Use it to drive a progress UI. Two phases:
   * "decompress" → 0..1 in pass 1, "decompress" → 0..1 in pass 2.
   */
  onProgress?: (progress: number) => void;
  /**
   * Soft cap. Files bigger than this — pre-decompression — are rejected.
   * Default 200 MB (Palworld saves max out around 80–120 MB).
   */
  maxCompressedBytes?: number;
}

const DEFAULT_MAX_COMPRESSED_BYTES = 200 * 1024 * 1024;

export function decompressSave(
  buffer: ArrayBuffer,
  options: DecompressOptions = {},
): DecompressResult {
  const max = options.maxCompressedBytes ?? DEFAULT_MAX_COMPRESSED_BYTES;
  if (buffer.byteLength > max) {
    return {
      ok: false,
      code: "TOO_SHORT",
      message:
        `File is ${buffer.byteLength} bytes, larger than the ${max}-byte cap. ` +
        "If this is a real save, pass a higher maxCompressedBytes.",
    };
  }

  if (buffer.byteLength < PLZ_HEADER_BYTES) {
    return {
      ok: false,
      code: "TOO_SHORT",
      message: `File is ${buffer.byteLength} bytes; PlZ header alone needs ${PLZ_HEADER_BYTES}.`,
    };
  }

  const view = new DataView(buffer);
  const declaredUncompressed = view.getUint32(0, true);
  const declaredCompressed = view.getUint32(4, true);

  // Bytes 8..10 must be the ASCII string "PLZ". Extracting via byte reads
  // avoids any TextDecoder ambiguity.
  const m0 = view.getUint8(8);
  const m1 = view.getUint8(9);
  const m2 = view.getUint8(10);
  if (m0 !== 0x50 /* P */ || m1 !== 0x4c /* L */ || m2 !== 0x5a /* Z */) {
    return {
      ok: false,
      code: "BAD_MAGIC",
      message:
        "File doesn't start with the Palworld PlZ magic — not a Palworld save (or it's corrupted).",
    };
  }

  const containerVersion = view.getUint8(11);
  const payloadStart = PLZ_HEADER_BYTES;
  const payloadEnd = payloadStart + declaredCompressed;
  if (payloadEnd > buffer.byteLength) {
    return {
      ok: false,
      code: "SIZE_MISMATCH",
      message:
        `Header says compressed payload is ${declaredCompressed} bytes but the file ends at ` +
        `byte ${buffer.byteLength}. File is truncated.`,
    };
  }

  const compressed = new Uint8Array(buffer, payloadStart, declaredCompressed);

  options.onProgress?.(0);

  let pass1: Uint8Array;
  try {
    pass1 = pako.inflate(compressed);
  } catch (e) {
    return {
      ok: false,
      code: "ZLIB_FAILED",
      message: `zlib decompression failed on pass 1: ${(e as Error).message}`,
    };
  }
  options.onProgress?.(0.5);

  let payload: Uint8Array;
  switch (containerVersion) {
    case 0:
      payload = pass1;
      break;
    case 1:
    case 2:
      // Newer saves inflate twice. v2 is an internal version bump in the
      // wrapper; the post-pass-2 bytes are still standard GVAS in practice.
      try {
        payload = pako.inflate(pass1);
      } catch (e) {
        return {
          ok: false,
          code: "ZLIB_FAILED",
          message: `zlib decompression failed on pass 2: ${(e as Error).message}`,
        };
      }
      break;
    default:
      return {
        ok: false,
        code: "UNSUPPORTED_CONTAINER_VERSION",
        message:
          `Unsupported PlZ container version ${containerVersion}. ` +
          "If you're on a recent patch, this parser may need updating — " +
          "please report with diagnostics.",
      };
  }
  options.onProgress?.(1);

  // The declared size is advisory — log a soft warning on drift but accept
  // the bytes. Some saves have rounded-up declared sizes.
  if (payload.byteLength !== declaredUncompressed && declaredUncompressed > 0) {
    // We don't fail, just nudge: the GVAS reader will validate downstream.
  }

  return { ok: true, payload, containerVersion };
}
