/**
 * Passive-skill inheritance math.
 *
 * Given two parents' passive sets and a desired child set, compute the
 * probability the child rolls those passives, plus the expected number of
 * eggs to hatch one.
 *
 * Pure functions — no React, no Next, no I/O.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * MODEL (community best-effort, NOT official):
 *
 *   1. Inheritance count K is sampled from `countDistribution`. Index 0 is
 *      P(K=1), index 1 is P(K=2), etc. The actual count is min(K, |pool|).
 *   2. The pool is the (deduplicated) union of both parents' passives.
 *   3. K passives are drawn uniformly *without replacement* from the pool.
 *   4. For each remaining slot up to `maxPassives`:
 *        - With probability `wildPassiveChance`, draw a uniformly random
 *          passive from the global passive list (not duplicating ones already
 *          on the child).
 *        - Otherwise the slot stays empty.
 *
 * The numeric constants here are PLACEHOLDERS based on community estimates
 * circa Phase 2 launch. If Pocketpair publishes official numbers — or the
 * community refines these — this is the only block that needs to change.
 * Source notes: see data/README.md.
 * ──────────────────────────────────────────────────────────────────────────
 */

import type { PassiveSkill } from "@/types/pal";

/* -------------------------------------------------------------------------- */
/*  Tunable constants — edit this block to update the model.                  */
/* -------------------------------------------------------------------------- */

export const PASSIVE_INHERITANCE = {
  /** P(K=1), P(K=2), P(K=3), P(K=4) — must sum to 1. */
  countDistribution: [0.4, 0.3, 0.2, 0.1],
  /** Per-slot probability that an empty slot rolls a wild passive. */
  wildPassiveChance: 0.1,
  /** Hard cap on passives a Pal can have. */
  maxPassives: 4,
  /**
   * Default size of the global passive pool (used for "this specific wild
   * passive" math). Override per call via `options.globalPassiveCount` —
   * loaders pass the real count from `data/passives.json`.
   */
  defaultGlobalPassiveCount: 50,
} as const;

/* -------------------------------------------------------------------------- */
/*  Combinatorics helpers — small ints, exact integer math via BigInt-free.   */
/* -------------------------------------------------------------------------- */

/** Binomial coefficient C(n, k). Returns 0 for invalid inputs. */
export function binomial(n: number, k: number): number {
  if (k < 0 || k > n || n < 0) return 0;
  if (k === 0 || k === n) return 1;
  // Symmetry — keeps loop short.
  if (k > n - k) k = n - k;
  let result = 1;
  for (let i = 0; i < k; i++) {
    // Multiply then divide each step to keep magnitudes small.
    result = (result * (n - i)) / (i + 1);
  }
  return Math.round(result);
}

/* -------------------------------------------------------------------------- */
/*  Internal: dedupe passives by id, treat parents as multisets-of-sets.      */
/* -------------------------------------------------------------------------- */

function uniqueIds(passives: ReadonlyArray<PassiveSkill>): string[] {
  return [...new Set(passives.map((p) => p.id))];
}

function unionIds(a: ReadonlyArray<PassiveSkill>, b: ReadonlyArray<PassiveSkill>): string[] {
  return [...new Set([...uniqueIds(a), ...uniqueIds(b)])];
}

function intersectionCount(desiredIds: string[], poolIds: string[]): number {
  const set = new Set(poolIds);
  let n = 0;
  for (const id of desiredIds) if (set.has(id)) n++;
  return n;
}

interface MathOptions {
  /** Override the global passive pool size used for wild-rolls. */
  globalPassiveCount?: number;
}

/* -------------------------------------------------------------------------- */
/*  Wild-passive coverage — closed-form.                                       */
/* -------------------------------------------------------------------------- */

/**
 * P(`m` specific passives are all drawn into the wild slots), given:
 *   t       = number of wild slots (= maxPassives - inherited)
 *   k       = number of inherited passives already on the child
 *   G       = total passives in the global list
 * Wild draws sample from (G - k) passives uniformly without replacement.
 *
 * Per-slot the wild draw fires with probability `wildPassiveChance`. Sum over
 * the number of slots that fire (n), and within that compute the hypergeometric
 * probability that the chosen `n` includes our `m` specific passives.
 */
function probabilityWildCoversAll(
  m: number,
  t: number,
  k: number,
  G: number,
): number {
  if (m === 0) return 1;
  if (m > t) return 0; // can't fit m wild passives in t slots
  if (m > G - k) return 0; // fewer eligible passives than required
  const w = PASSIVE_INHERITANCE.wildPassiveChance;
  const eligible = G - k;
  let total = 0;
  for (let n = m; n <= Math.min(t, eligible); n++) {
    const slotsFire = binomial(t, n) * Math.pow(w, n) * Math.pow(1 - w, t - n);
    const allCoveredGivenN = binomial(eligible - m, n - m) / binomial(eligible, n);
    total += slotsFire * allCoveredGivenN;
  }
  return total;
}

/**
 * P(no wild passives drawn at all in `t` slots) — used by `exact` when the
 * desired set is fully covered by inheritance and we need the child to have
 * NO additional passives.
 */
function probabilityNoWild(t: number): number {
  return Math.pow(1 - PASSIVE_INHERITANCE.wildPassiveChance, t);
}

/**
 * P(exactly `wantWild` specific wild passives are drawn AND nothing else),
 * given `t` wild slots and `eligible` candidates the wild rolls draw from.
 *
 * Used by `probabilityOfExactPassives` when the desired set is partially
 * covered by inheritance — the wild step has to fill in exactly the missing
 * passives and no extras.
 */
function probabilityWildExactly(
  wantWild: number,
  t: number,
  eligible: number,
): number {
  if (wantWild < 0 || wantWild > t) return 0;
  if (wantWild > eligible) return 0;
  const w = PASSIVE_INHERITANCE.wildPassiveChance;
  // Exactly `wantWild` of the t slots must fire, and they must be exactly the
  // specific `wantWild` passives we care about (uniform over `eligible` choices).
  const slotsFire =
    binomial(t, wantWild) * Math.pow(w, wantWild) * Math.pow(1 - w, t - wantWild);
  const specificDraw = wantWild === 0 ? 1 : 1 / binomial(eligible, wantWild);
  return slotsFire * specificDraw;
}

/* -------------------------------------------------------------------------- */
/*  Public API                                                                */
/* -------------------------------------------------------------------------- */

/**
 * P(child contains every passive in `desired`). Other passives may or may not
 * be present.
 */
export function probabilityOfAtLeastPassives(
  parentAPassives: ReadonlyArray<PassiveSkill>,
  parentBPassives: ReadonlyArray<PassiveSkill>,
  desired: ReadonlyArray<PassiveSkill>,
  options: MathOptions = {},
): number {
  const desiredIds = uniqueIds(desired);
  if (desiredIds.length > PASSIVE_INHERITANCE.maxPassives) {
    throw new Error(
      `desired set has ${desiredIds.length} passives; max is ${PASSIVE_INHERITANCE.maxPassives}`,
    );
  }
  if (desiredIds.length === 0) return 1;

  const G = options.globalPassiveCount ?? PASSIVE_INHERITANCE.defaultGlobalPassiveCount;
  const pool = unionIds(parentAPassives, parentBPassives);
  const P = pool.length;
  const d = desiredIds.length;
  const q = intersectionCount(desiredIds, pool); // desired-in-pool

  // Edge case: empty pool → K = 0 always, so all desired must come from wild.
  if (P === 0) {
    return probabilityWildCoversAll(d, PASSIVE_INHERITANCE.maxPassives, 0, G);
  }

  let total = 0;
  for (let kTarget = 1; kTarget <= PASSIVE_INHERITANCE.maxPassives; kTarget++) {
    const pK = PASSIVE_INHERITANCE.countDistribution[kTarget - 1] ?? 0;
    if (pK === 0) continue;
    const k = Math.min(kTarget, P);

    // Sum over j = number of desired-in-pool that get inherited.
    const jMin = Math.max(0, k - (P - q));
    const jMax = Math.min(k, q);
    let pGivenK = 0;
    for (let j = jMin; j <= jMax; j++) {
      const inheritProb = (binomial(q, j) * binomial(P - q, k - j)) / binomial(P, k);
      const missing = d - j; // desired not yet covered → need wild
      const t = PASSIVE_INHERITANCE.maxPassives - k;
      const wildProb = probabilityWildCoversAll(missing, t, k, G);
      pGivenK += inheritProb * wildProb;
    }
    total += pK * pGivenK;
  }
  return clamp01(total);
}

/**
 * P(child's passive set is *exactly* `desired` — no extras, nothing missing).
 */
export function probabilityOfExactPassives(
  parentAPassives: ReadonlyArray<PassiveSkill>,
  parentBPassives: ReadonlyArray<PassiveSkill>,
  desired: ReadonlyArray<PassiveSkill>,
  options: MathOptions = {},
): number {
  const desiredIds = uniqueIds(desired);
  if (desiredIds.length > PASSIVE_INHERITANCE.maxPassives) {
    throw new Error(
      `desired set has ${desiredIds.length} passives; max is ${PASSIVE_INHERITANCE.maxPassives}`,
    );
  }

  const G = options.globalPassiveCount ?? PASSIVE_INHERITANCE.defaultGlobalPassiveCount;
  const pool = unionIds(parentAPassives, parentBPassives);
  const P = pool.length;
  const d = desiredIds.length;
  const q = intersectionCount(desiredIds, pool);

  // Empty pool → K=0, so child = wild rolls only. Need exactly d wild passives,
  // and they must be exactly the desired ones.
  if (P === 0) {
    return clamp01(probabilityWildExactly(d, PASSIVE_INHERITANCE.maxPassives, G));
  }

  let total = 0;
  for (let kTarget = 1; kTarget <= PASSIVE_INHERITANCE.maxPassives; kTarget++) {
    const pK = PASSIVE_INHERITANCE.countDistribution[kTarget - 1] ?? 0;
    if (pK === 0) continue;
    const k = Math.min(kTarget, P);
    if (k > d) continue; // can't have more inherited than desired-total when child=desired

    // For child = desired exactly: inherited ⊆ desired-in-pool, |inherited| = k.
    // So we need k ≤ q.
    if (k > q) continue;
    // Number of subsets of D∩Pool of size k, divided by total k-subsets of pool.
    const inheritProb = binomial(q, k) / binomial(P, k);

    const t = PASSIVE_INHERITANCE.maxPassives - k;
    const missing = d - k; // wild must cover exactly these, and nothing else
    const eligible = G - k;
    const wildProb = probabilityWildExactly(missing, t, eligible);
    total += pK * inheritProb * wildProb;
  }
  return clamp01(total);
}

/**
 * Expected number of eggs to hatch one child whose passives include `desired`.
 *
 * Returns `Number.POSITIVE_INFINITY` when the probability is zero (e.g. desired
 * set can't physically be reached). UI layer is expected to format very large
 * values as "500+" or similar.
 */
export function expectedEggCount(
  parentAPassives: ReadonlyArray<PassiveSkill>,
  parentBPassives: ReadonlyArray<PassiveSkill>,
  desired: ReadonlyArray<PassiveSkill>,
  options: MathOptions = {},
): number {
  const p = probabilityOfAtLeastPassives(parentAPassives, parentBPassives, desired, options);
  if (p <= 0) return Number.POSITIVE_INFINITY;
  return 1 / p;
}

/* -------------------------------------------------------------------------- */

function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}
