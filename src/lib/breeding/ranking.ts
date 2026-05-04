/**
 * Parent-pair ranking by *obtainability*.
 *
 * The reverse index produces every pair that breeds into a target Pal — often
 * 50+ pairs for popular results. This module scores those pairs so we can
 * surface the easiest-to-acquire ones first.
 *
 * The heuristic is JUDGMENT, not science. Lower score = better. Tune freely.
 *
 *   - Lower combined Paldex number → easier to find early in the game.
 *   - Same primary element → easier to locate (matching biome).
 *   - Breed-only parents → heavily penalized (you'd have to breed them first).
 *
 * Pure functions only. No React, no Next, no I/O.
 */

import type { Pal } from "@/types/pal";

/* -------------------------------------------------------------------------- */
/*  Tunable weights. Edit these when refining the heuristic.                  */
/* -------------------------------------------------------------------------- */

export const RANKING_WEIGHTS = {
  /** Score added per Paldex number, summed across both parents. Lower paldex = easier. */
  paldexPenalty: 0.5,
  /** Bonus (negative) when the parents share their primary element. */
  sameElementBonus: -50,
  /** Penalty per breed-only parent. Stacks for both parents. */
  breedOnlyPenalty: 1000,
  /** Penalty per non-breedable-result parent (variants used as a parent are awkward). */
  variantParentPenalty: 200,
} as const;

/* -------------------------------------------------------------------------- */
/*  Public API                                                                */
/* -------------------------------------------------------------------------- */

export interface RankedPair<T> {
  parentA: T;
  parentB: T;
  /** Lower is better. Score is the sum of the contributions below. */
  score: number;
  breakdown: ScoreBreakdown;
}

export interface ScoreBreakdown {
  paldex: number;
  sameElement: number;
  breedOnly: number;
  variant: number;
}

/**
 * Score a single parent pair. Lower is better.
 */
export function scorePair(parentA: Pal, parentB: Pal): RankedPair<Pal>["breakdown"] & {
  total: number;
} {
  const paldex = (parentA.paldexNo + parentB.paldexNo) * RANKING_WEIGHTS.paldexPenalty;

  const sameElement =
    parentA.elements[0] !== undefined && parentA.elements[0] === parentB.elements[0]
      ? RANKING_WEIGHTS.sameElementBonus
      : 0;

  const breedOnly =
    (parentA.breedOnly ? RANKING_WEIGHTS.breedOnlyPenalty : 0) +
    (parentB.breedOnly ? RANKING_WEIGHTS.breedOnlyPenalty : 0);

  const variant =
    (parentA.breedable ? 0 : RANKING_WEIGHTS.variantParentPenalty) +
    (parentB.breedable ? 0 : RANKING_WEIGHTS.variantParentPenalty);

  return {
    paldex,
    sameElement,
    breedOnly,
    variant,
    total: paldex + sameElement + breedOnly + variant,
  };
}

/**
 * Sort an array of parent pairs ascending by obtainability score.
 * Returns a new array; the input is not mutated.
 *
 * Pairs with equal scores fall back to (parentA.paldexNo, parentB.paldexNo)
 * for a stable, deterministic order.
 */
export function rankPairs(
  pairs: ReadonlyArray<{ parentA: Pal; parentB: Pal }>,
): Array<RankedPair<Pal>> {
  return pairs
    .map((pair) => {
      const { total, ...breakdown } = scorePair(pair.parentA, pair.parentB);
      return { ...pair, score: total, breakdown };
    })
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      if (a.parentA.paldexNo !== b.parentA.paldexNo) {
        return a.parentA.paldexNo - b.parentA.paldexNo;
      }
      return a.parentB.paldexNo - b.parentB.paldexNo;
    });
}
