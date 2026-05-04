/**
 * Tiny UUID-v4 generator. Inlined to avoid a `uuid` runtime dep — Phase 3's
 * dep budget is two new packages and we'd rather spend them on `zod` and
 * `lz-string`.
 *
 * Falls back to a Math.random based generator on platforms without
 * `crypto.randomUUID` (older Safari, server-side rendering paths). The
 * fallback isn't cryptographically strong; that's fine — these ids are local
 * collection keys, not security tokens.
 */
export function newUuid(): string {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  // RFC4122-ish v4 fallback. Not crypto-grade.
  const hex = "0123456789abcdef";
  let s = "";
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      s += "-";
    } else if (i === 14) {
      s += "4";
    } else if (i === 19) {
      s += hex[(Math.random() * 4) | (8 & 0x3)];
    } else {
      s += hex[(Math.random() * 16) | 0];
    }
  }
  return s;
}
