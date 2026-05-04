/**
 * Bundled special-breeding-combo data.
 *
 * Same rule as pals.ts — committed JSON, statically imported, never fetched.
 */

import combosJson from "@data/combos.json";
import type { BreedingCombo } from "@/types/pal";

function isCombo(v: unknown): v is BreedingCombo {
  if (typeof v !== "object" || v === null) return false;
  const c = v as Record<string, unknown>;
  return (
    typeof c.parentA === "string" &&
    typeof c.parentB === "string" &&
    typeof c.child === "string"
  );
}

const raw = combosJson as unknown;
if (!Array.isArray(raw)) {
  throw new Error("data/combos.json is not an array");
}

const combos: BreedingCombo[] = raw.map((c, i) => {
  if (!isCombo(c)) {
    throw new Error(`data/combos.json[${i}] does not match the BreedingCombo shape`);
  }
  return c;
});

export const allCombos: ReadonlyArray<BreedingCombo> = Object.freeze(combos);
