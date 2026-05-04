/**
 * Breeding engine — pure, framework-agnostic.
 *
 * NO React, NO Next, NO file/network I/O. Callers pass the Pal table and
 * combo table in via `BreedingContext`. This is non-negotiable: future phases
 * run this in Web Workers and on the server.
 *
 * Algorithm (Phase 1):
 *   1. Look up (parentA, parentB) symmetrically in the special combos table.
 *      If found, return that child.
 *   2. Otherwise compute target = floor((A.powerValue + B.powerValue + 1) / 2).
 *   3. From breedable Pals (excluding variants), find the one whose powerValue
 *      is closest to `target`. Ties are broken by lower paldexNo (placeholder
 *      rule — see TIE_BREAKER below for the swap point).
 *   4. Same-species breeding (A.id === B.id) returns A. This is checked first
 *      because the candidate-pool search would otherwise pick the same Pal
 *      anyway, but the explicit branch makes intent obvious.
 */

import type { BreedingCombo, Pal } from "@/types/pal";
import type { BreedingContext, BreedingResult } from "./types";

/* -------------------------------------------------------------------------- */
/*  Public API                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Compute the child Pal of two parents.
 * Returns the resulting Pal — convenience wrapper around `breedDetailed`.
 */
export function breed(parentA: Pal, parentB: Pal, ctx: BreedingContext): Pal {
  return breedDetailed(parentA, parentB, ctx).child;
}

/**
 * Same as `breed` but returns the source of the result (special-combo vs
 * power-value). Useful for UI hints and debugging.
 */
export function breedDetailed(
  parentA: Pal,
  parentB: Pal,
  ctx: BreedingContext,
): BreedingResult {
  // 1. Same-species short-circuit.
  if (parentA.id === parentB.id) {
    return { child: parentA, source: "power-value" };
  }

  // 2. Special combo lookup (symmetric).
  const combo = findCombo(parentA.id, parentB.id, ctx.combos);
  if (combo) {
    const child = ctx.pals.find((p) => p.id === combo.child);
    if (!child) {
      throw new Error(
        `Special combo references unknown child id "${combo.child}" ` +
          `(parents: ${combo.parentA}, ${combo.parentB})`,
      );
    }
    return { child, source: "special-combo" };
  }

  // 3. Power-value math.
  const target = computeTargetPower(parentA.powerValue, parentB.powerValue);
  const child = pickClosestByPower(target, ctx.pals);
  if (!child) {
    throw new Error("No breedable Pals available in context — empty pool");
  }
  return { child, source: "power-value" };
}

/**
 * Symmetric combo lookup. Exported so it's testable on its own.
 */
export function findCombo(
  aId: string,
  bId: string,
  combos: BreedingCombo[],
): BreedingCombo | undefined {
  return combos.find(
    (c) =>
      (c.parentA === aId && c.parentB === bId) ||
      (c.parentA === bId && c.parentB === aId),
  );
}

/**
 * The breeding-target formula. Extracted so it can be unit-tested directly
 * and swapped out if the community-accepted formula changes.
 */
export function computeTargetPower(a: number, b: number): number {
  return Math.floor((a + b + 1) / 2);
}

/**
 * Pick the breedable Pal whose powerValue is closest to `target`.
 * Tie-breaker: lower paldexNo wins. See TIE_BREAKER comment below.
 */
export function pickClosestByPower(target: number, pals: Pal[]): Pal | undefined {
  const pool = pals.filter((p) => p.breedable);
  if (pool.length === 0) return undefined;

  // TIE_BREAKER: Phase 1 uses lower paldexNo — this is a documented placeholder.
  // The community-accepted rule is more nuanced (it depends on the parents'
  // genders/order in some sources). Phase 2 should make this strategy injectable
  // via BreedingContext, e.g. ctx.tieBreaker = (a, b) => number.
  let best: Pal | undefined;
  let bestDiff = Infinity;
  let bestPaldex = Infinity;

  for (const pal of pool) {
    const diff = Math.abs(pal.powerValue - target);
    if (diff < bestDiff || (diff === bestDiff && pal.paldexNo < bestPaldex)) {
      best = pal;
      bestDiff = diff;
      bestPaldex = pal.paldexNo;
    }
  }
  return best;
}
