/**
 * Bundled reverse-breeding index.
 *
 * Maps `childId → Array<{ parentA, parentB }>`: every unordered parent pair
 * that produces that child. Built at scrape-time by
 * `scripts/build-reverse-index.ts` so the app can do reverse lookup in O(1).
 *
 * Canonical pair ordering: parentA's paldexNo ≤ parentB's paldexNo. This means
 * (Lamball, Cattiva) and (Cattiva, Lamball) collapse to a single entry.
 */

import reverseIndexJson from "@data/reverse-index.json";

export interface ParentPair {
  parentA: string;
  parentB: string;
}

function isParentPair(v: unknown): v is ParentPair {
  if (typeof v !== "object" || v === null) return false;
  const p = v as Record<string, unknown>;
  return typeof p.parentA === "string" && typeof p.parentB === "string";
}

const raw = reverseIndexJson as unknown;
if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
  throw new Error("data/reverse-index.json is not an object");
}

const map = new Map<string, ReadonlyArray<ParentPair>>();
for (const [childId, pairs] of Object.entries(raw)) {
  if (!Array.isArray(pairs)) {
    throw new Error(`reverse-index entry for "${childId}" is not an array`);
  }
  pairs.forEach((p, i) => {
    if (!isParentPair(p)) {
      throw new Error(`reverse-index["${childId}"][${i}] is not a ParentPair`);
    }
  });
  map.set(childId, Object.freeze([...pairs]));
}

/** Get every parent pair that produces a child, or `[]` if none. */
export function getParentPairsFor(childId: string): ReadonlyArray<ParentPair> {
  return map.get(childId) ?? [];
}

/** Total number of indexed (childId, pair) entries — useful for diagnostics. */
export function reverseIndexSize(): number {
  let total = 0;
  for (const list of map.values()) total += list.length;
  return total;
}
