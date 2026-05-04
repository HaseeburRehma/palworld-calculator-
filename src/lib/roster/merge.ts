/**
 * Smart-merge logic for save-file imports.
 *
 * Three modes:
 *   - "replace": clear existing roster, write the imports.
 *   - "append":  add imports unconditionally; may produce duplicates.
 *   - "smart":   add imports, skip exact duplicates by (rawId|palId, passive
 *                set). Existing manually-added Pals stay.
 *
 * Pure function over a roster value. Time-sensitive timestamps (`updatedAt`,
 * `importedAt`) are passed in so callers can pin them in tests.
 *
 * Design choice: by default, Pals already in the roster but NOT in the
 * imported set are KEPT. This avoids data loss across re-imports — users who
 * stash high-value Pals in a base mid-session shouldn't lose them just
 * because they re-imported earlier in the day. A "sync" mode that DOES
 * delete absent Pals is intentionally NOT this function — the spec says it's
 * a power-user feature behind a confirmation dialog. Implementing it is one
 * more case here when needed.
 */

import type { OwnedPal, Roster } from "@/types/pal";
import type { ParsedPal } from "@/lib/save";
import { newUuid } from "@/lib/util/uuid";

export type MergeMode = "replace" | "append" | "smart";

export interface MergeStats {
  added: number;
  skippedDuplicates: number;
  skippedUnmapped: number;
  keptNotInImport: number;
  totalAfter: number;
}

export interface MergeResult {
  roster: Roster;
  stats: MergeStats;
}

export interface MergeOptions {
  mode: MergeMode;
  /** Now used for both Roster.updatedAt and OwnedPal.importedAt. */
  now?: Date;
  /** Selection from the preview UI. Only these will be merged. */
  selectedRawIds?: Set<string>;
}

/**
 * Merge `incoming` parsed Pals into `existing` per `mode`. Pure — never
 * mutates inputs. Returns the new roster + a stats summary the UI surfaces
 * to the user.
 */
export function mergeImport(
  existing: Roster,
  incoming: ReadonlyArray<ParsedPal>,
  options: MergeOptions,
): MergeResult {
  const now = options.now ?? new Date();
  const isoNow = now.toISOString();
  const filtered = incoming.filter(
    (p) =>
      p.isPlayerOwned &&
      (options.selectedRawIds === undefined || options.selectedRawIds.has(p.rawId)),
  );

  let added = 0;
  let skippedDuplicates = 0;
  let skippedUnmapped = 0;
  const keptNotInImportInitial = existing.pals.length;

  // Track which existing entries match incoming (used by replace/sync modes
  // and for stats in any mode).
  const incomingKeys = new Set(filtered.map(parsedKey));
  const incomingRawIds = new Set(filtered.map((p) => p.rawId));

  let pals: OwnedPal[];

  switch (options.mode) {
    case "replace": {
      pals = [];
      for (const p of filtered) {
        if (p.palId === null) {
          skippedUnmapped++;
          continue;
        }
        pals.push(makeOwnedFromParsed(p, isoNow));
        added++;
      }
      break;
    }
    case "append": {
      pals = [...existing.pals];
      for (const p of filtered) {
        if (p.palId === null) {
          skippedUnmapped++;
          continue;
        }
        pals.push(makeOwnedFromParsed(p, isoNow));
        added++;
      }
      break;
    }
    case "smart": {
      pals = [...existing.pals];
      const existingKeys = new Set(pals.map(ownedKey));
      for (const p of filtered) {
        if (p.palId === null) {
          skippedUnmapped++;
          continue;
        }
        const key = parsedKey(p);
        if (existingKeys.has(key)) {
          skippedDuplicates++;
          continue;
        }
        const owned = makeOwnedFromParsed(p, isoNow);
        pals.push(owned);
        existingKeys.add(ownedKey(owned));
        added++;
      }
      break;
    }
    default: {
      const exhaustive: never = options.mode;
      void exhaustive;
      throw new Error(`Unknown merge mode: ${String(options.mode)}`);
    }
  }

  const keptNotInImport =
    options.mode === "replace"
      ? 0
      : countKeptNotInImport(existing.pals, incomingKeys, incomingRawIds);

  return {
    roster: { ...existing, pals, updatedAt: isoNow },
    stats: {
      added,
      skippedDuplicates,
      skippedUnmapped,
      keptNotInImport:
        options.mode === "replace"
          ? // For replace mode: everything we threw away is "not kept".
            -keptNotInImportInitial
          : keptNotInImport,
      totalAfter: pals.length,
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  Internals                                                                 */
/* -------------------------------------------------------------------------- */

function makeOwnedFromParsed(p: ParsedPal, importedAt: string): OwnedPal {
  // p.palId is non-null at this point — the caller filtered.
  return {
    instanceId: newUuid(),
    palId: p.palId!,
    passives: p.passives.slice(0, 4),
    nickname: p.nickname,
    gender: p.gender,
    source: "import",
    importedAt,
    rawId: p.rawId,
  };
}

/**
 * Stable dedup key for a parsed Pal. Prefer the game's internal id (rawId)
 * since it survives our mapping table changing; fall back to palId for
 * manually-added Pals that don't have a rawId.
 */
function parsedKey(p: ParsedPal): string {
  const id = p.rawId || p.palId || "";
  const passives = [...p.passives].sort().join(",");
  return `${id}|${passives}`;
}

function ownedKey(o: OwnedPal): string {
  const id = o.rawId || o.palId;
  const passives = [...o.passives].sort().join(",");
  return `${id}|${passives}`;
}

function countKeptNotInImport(
  existing: ReadonlyArray<OwnedPal>,
  incomingKeys: ReadonlySet<string>,
  incomingRawIds: ReadonlySet<string>,
): number {
  let n = 0;
  for (const e of existing) {
    if (incomingKeys.has(ownedKey(e))) continue;
    // Manual entries (no rawId) are always kept-not-in-import.
    if (!e.rawId) {
      n++;
      continue;
    }
    if (!incomingRawIds.has(e.rawId)) n++;
  }
  return n;
}
