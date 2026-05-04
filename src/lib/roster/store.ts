/**
 * Owned-Pal roster store.
 *
 * Pure functions over a `Roster` value, plus thin localStorage adapters that
 * wrap every access in try/catch. localStorage can throw in:
 *   - Safari Private Browsing (writes throw QuotaExceededError)
 *   - SSR / Web Worker contexts (no `window.localStorage` at all)
 *   - Quota exhaustion (returns null on read, throws on write)
 *
 * The store is intentionally framework-agnostic. The `/roster` page wires it
 * to React state; the worker imports nothing from here.
 */

import type { OwnedPal, Roster } from "@/types/pal";
import { newUuid } from "@/lib/util/uuid";
import { parseAnyRoster, RosterV1Schema } from "./schema";

export const STORAGE_KEY = "palworld-roster-v1";

/** A roster guaranteed to validate against the current schema version. */
export function emptyRoster(now: Date = new Date()): Roster {
  return {
    version: 1,
    pals: [],
    updatedAt: now.toISOString(),
  };
}

/* -------------------------------------------------------------------------- */
/*  Pure CRUD — operate on a Roster value, return a NEW Roster value.         */
/* -------------------------------------------------------------------------- */

export interface AddPalInput {
  palId: string;
  passives?: string[];
  nickname?: string;
  gender?: "male" | "female";
  notes?: string;
}

export function addPal(roster: Roster, input: AddPalInput, now: Date = new Date()): Roster {
  const owned: OwnedPal = {
    instanceId: newUuid(),
    palId: input.palId,
    passives: dedupePassives(input.passives ?? []),
    nickname: trimOrUndef(input.nickname),
    gender: input.gender,
    notes: trimOrUndef(input.notes),
  };
  return {
    ...roster,
    pals: [...roster.pals, owned],
    updatedAt: now.toISOString(),
  };
}

export function removePal(roster: Roster, instanceId: string, now: Date = new Date()): Roster {
  const next = roster.pals.filter((p) => p.instanceId !== instanceId);
  if (next.length === roster.pals.length) return roster; // no-op if not found
  return { ...roster, pals: next, updatedAt: now.toISOString() };
}

export type UpdatePalInput = Partial<Omit<OwnedPal, "instanceId">>;

export function updatePal(
  roster: Roster,
  instanceId: string,
  patch: UpdatePalInput,
  now: Date = new Date(),
): Roster {
  let touched = false;
  const next = roster.pals.map((p) => {
    if (p.instanceId !== instanceId) return p;
    touched = true;
    return {
      ...p,
      ...patch,
      passives: patch.passives ? dedupePassives(patch.passives) : p.passives,
      nickname: patch.nickname !== undefined ? trimOrUndef(patch.nickname) : p.nickname,
      notes: patch.notes !== undefined ? trimOrUndef(patch.notes) : p.notes,
    };
  });
  if (!touched) return roster;
  return { ...roster, pals: next, updatedAt: now.toISOString() };
}

/* -------------------------------------------------------------------------- */
/*  Import / export                                                           */
/* -------------------------------------------------------------------------- */

/** Serialize for download. The string is a stable, valid JSON document. */
export function exportRoster(roster: Roster): string {
  // Re-parse to ensure we never write malformed data; the schema is the
  // single source of truth.
  const parsed = RosterV1Schema.parse(roster);
  return JSON.stringify(parsed, null, 2);
}

export type ImportResult =
  | { ok: true; roster: Roster }
  | { ok: false; errors: string[] };

/** Parse user-supplied JSON. Always returns a tagged result; never throws. */
export function importRoster(json: string): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (e) {
    return { ok: false, errors: [`Not valid JSON: ${(e as Error).message}`] };
  }
  const result = parseAnyRoster(raw);
  if (!result.ok) return result;
  return { ok: true, roster: result.roster };
}

/* -------------------------------------------------------------------------- */
/*  localStorage adapters — every call in a try/catch.                        */
/* -------------------------------------------------------------------------- */

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Pull a roster from storage. Returns an empty roster if nothing is stored,
 * the data is malformed, or storage is unavailable. Never throws.
 */
export function loadRoster(storage: StorageLike | undefined = safeStorage()): Roster {
  if (!storage) return emptyRoster();
  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return emptyRoster();
  }
  if (raw === null) return emptyRoster();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptyRoster();
  }
  const result = parseAnyRoster(parsed);
  if (!result.ok) return emptyRoster();
  return result.roster;
}

/**
 * Persist a roster. Returns `false` when storage is unavailable or threw,
 * `true` on success. Callers can surface a "couldn't save" warning on false.
 */
export function saveRoster(
  roster: Roster,
  storage: StorageLike | undefined = safeStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(roster));
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve a usable Storage handle, or `undefined` when unavailable
 * (SSR, Worker, disabled cookies, etc.). Wrapped in try/catch because some
 * environments throw on `localStorage` access.
 */
export function safeStorage(): StorageLike | undefined {
  try {
    if (typeof globalThis === "undefined") return undefined;
    const win = globalThis as { localStorage?: StorageLike };
    return win.localStorage;
  } catch {
    return undefined;
  }
}

/* -------------------------------------------------------------------------- */
/*  Local helpers                                                             */
/* -------------------------------------------------------------------------- */

function dedupePassives(ids: ReadonlyArray<string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (id && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out.slice(0, 4);
}

function trimOrUndef(v: string | undefined): string | undefined {
  if (v === undefined) return undefined;
  const t = v.trim();
  return t.length === 0 ? undefined : t;
}
