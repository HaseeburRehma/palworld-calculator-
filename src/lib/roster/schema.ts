/**
 * Zod schemas for the owned-Pal roster.
 *
 * Used by:
 *   - `store.ts` to validate values read from `localStorage` (the storage may
 *     be edited by hand, by other devices/extensions, or corrupted).
 *   - The `/roster` page when importing user-supplied JSON files.
 *
 * Pure module — no I/O, no React. Safe to import from tests + the worker.
 */

import { z } from "zod";

export const OwnedPalSchema = z
  .object({
    instanceId: z.string().min(1),
    palId: z.string().min(1),
    passives: z.array(z.string().min(1)).max(4).default([]),
    nickname: z.string().max(60).optional(),
    gender: z.enum(["male", "female"]).optional(),
    notes: z.string().max(500).optional(),
    // Phase 4 fields. Optional + backward-compatible: existing v1 rosters
    // never had these and still validate.
    source: z.enum(["manual", "import"]).optional(),
    importedAt: z.string().datetime().optional(),
    rawId: z.string().min(1).max(120).optional(),
  })
  .strict();

/** Raw shape persisted to localStorage. */
export const RosterV1Schema = z
  .object({
    version: z.literal(1),
    pals: z.array(OwnedPalSchema),
    updatedAt: z.string().datetime(),
  })
  .strict();

/**
 * Anything we'll accept as INPUT. Future-proofing for v2+: when a v2 ships,
 * extend this to `union([RosterV1Schema, RosterV2Schema])` and let
 * `migrateRoster` do the lift.
 */
export const AnyRosterSchema = RosterV1Schema;

export type RosterParseResult =
  | { ok: true; roster: z.infer<typeof RosterV1Schema> }
  | { ok: false; errors: string[] };

/**
 * Parse + migrate. Centralized here so the store and the import flow share
 * exactly one validation path.
 */
export function parseAnyRoster(value: unknown): RosterParseResult {
  const result = AnyRosterSchema.safeParse(value);
  if (!result.success) {
    return { ok: false, errors: formatZodErrors(result.error) };
  }
  return { ok: true, roster: migrateRoster(result.data) };
}

/**
 * Migration step. v1 → v1 today; the function exists so when v2 lands we
 * extend this single call site instead of touching every consumer.
 */
export function migrateRoster(input: z.infer<typeof AnyRosterSchema>): z.infer<typeof RosterV1Schema> {
  // Branch on `version` once we have more than one. Today: identity.
  return input;
}

function formatZodErrors(error: z.ZodError): string[] {
  return error.issues.map((iss) => {
    const path = iss.path.join(".");
    return path ? `${path}: ${iss.message}` : iss.message;
  });
}
