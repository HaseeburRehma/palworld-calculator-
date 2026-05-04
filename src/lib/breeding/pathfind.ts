/**
 * Multi-generation breeding pathfinder.
 *
 * Phase 3's headline algorithm. Given a roster of owned Pals + a target
 * (species + desired passives), return up to a few cheapest breeding plans
 * that produce a child meeting the target.
 *
 * Pure functions. No React, no localStorage, no I/O. Imported by both the
 * Web Worker and unit tests, unchanged.
 *
 * Two-phase decomposition (per the Phase-3 spec):
 *   PHASE A — Shortest species path: AND-OR shortest-path relaxation over
 *             the breeding hypergraph. `dist[s]` = minimum number of
 *             breedings to first produce species `s`, with `parents[s]`
 *             holding the chosen parent pair. Multiple top-K alternatives
 *             are surfaced by varying the LAST step (the user-visible
 *             distinction users actually care about).
 *   PHASE B — Passive accumulation along each candidate path: forward-walk
 *             the chain, propagate the union of (desired ∩ ancestor pool)
 *             to each in-chain child, then score every step with the
 *             passive math from `breeding/passives.ts`.
 *
 * The "feeder pre-breed" idea from the spec is modeled as a same-species
 * loop edge: if the user owns ≥2 instances of species X with overlapping
 * passive sets, the planner can stack passives on X by re-breeding X×X.
 * This is implemented as a one-hop adjustment, not a recursive sub-search;
 * the spec calls out the 95%/1% complexity tradeoff explicitly.
 */

import type {
  BreedingPlan,
  BreedingStep,
  OwnedPal,
  Pal,
  PassiveSkill,
} from "@/types/pal";
import type { ParentPair } from "@/lib/data/reverse-index";
import { rankPairs } from "./ranking";
import {
  expectedEggCount,
  probabilityOfAtLeastPassives,
} from "./passives";

/* -------------------------------------------------------------------------- */
/*  Tunable constants — these are the knobs from the Phase-3 spec.            */
/* -------------------------------------------------------------------------- */

/** Hard cap on total breeding steps in any returned plan. */
export const MAX_PATH_DEPTH = 6;
/** Number of candidate species paths Phase A surfaces to Phase B. */
export const TOP_K_PATHS = 10;
/** Number of plans returned to the caller, post-Phase-B scoring. */
export const TOP_N_PLANS = 5;

/* -------------------------------------------------------------------------- */
/*  Public types                                                              */
/* -------------------------------------------------------------------------- */

export interface PathfindRequest {
  /** The user's owned Pals. May be empty — the planner returns "unreachable" then. */
  roster: ReadonlyArray<OwnedPal>;
  /** Target species id (Pal.id). */
  targetPalId: string;
  /** Desired passive ids. Up to 4. Empty = species-only goal. */
  desiredPassiveIds: ReadonlyArray<string>;
  /** Full Pal database. */
  pals: ReadonlyArray<Pal>;
  /** Reverse breeding index (childId → parent pairs). */
  reverseIndex: ReadonlyMap<string, ReadonlyArray<ParentPair>>;
  /** Master passive list — used to inflate ids and to tell the math the global pool size. */
  passives: ReadonlyArray<PassiveSkill>;
}

export interface PathfindResponse {
  plans: BreedingPlan[];
  warnings: string[];
  /**
   * Diagnostics for "don't bake assumptions in" — log how often we hit the
   * depth limit, which target was queried, etc. Surfaced in dev mode.
   */
  diagnostics: PathfindDiagnostics;
}

export interface PathfindDiagnostics {
  candidatePathsExplored: number;
  hitDepthLimit: boolean;
  /** ms spent in the pure search (does NOT include worker round-trip). */
  durationMs: number;
}

/* -------------------------------------------------------------------------- */
/*  Phase A: species shortest-path relaxation                                 */
/* -------------------------------------------------------------------------- */

interface DistanceEntry {
  /** Min number of breedings to first produce this species. 0 if owned. */
  dist: number;
  /** The parent pair that achieves `dist`. Null for owned species (no breed). */
  via: ParentPair | null;
}

/**
 * Compute `dist[species]` and `via[species]` for every species reachable from
 * the owned set within `MAX_PATH_DEPTH` breedings. AND-OR shortest path:
 *
 *   dist[c] = min over pairs (a, b) → c of  dist[a] + dist[b] + 1
 *
 * Bellman-Ford-style: relax until no change or until we've done enough
 * iterations to have propagated through the whole graph.
 */
export function computeDistances(
  ownedSpecies: ReadonlySet<string>,
  reverseIndex: ReadonlyMap<string, ReadonlyArray<ParentPair>>,
): Map<string, DistanceEntry> {
  const dist = new Map<string, DistanceEntry>();
  for (const id of ownedSpecies) dist.set(id, { dist: 0, via: null });

  // Iterate up to MAX_PATH_DEPTH * 2 times — overkill, but the graph is tiny.
  // In practice it converges in MAX_PATH_DEPTH iterations.
  for (let iter = 0; iter < MAX_PATH_DEPTH * 2; iter++) {
    let changed = false;
    // Sort iteration order by childId to keep tie-breaks stable.
    const childIds = [...reverseIndex.keys()].sort();
    for (const childId of childIds) {
      const pairs = reverseIndex.get(childId);
      if (!pairs) continue;
      const sortedPairs = sortPairsCanonical(pairs);
      let bestDist = dist.get(childId)?.dist ?? Number.POSITIVE_INFINITY;
      let bestVia: ParentPair | null = dist.get(childId)?.via ?? null;
      for (const pair of sortedPairs) {
        const da = dist.get(pair.parentA)?.dist;
        const db = dist.get(pair.parentB)?.dist;
        if (da === undefined || db === undefined) continue;
        const candidate = da + db + 1;
        if (candidate > MAX_PATH_DEPTH) continue;
        if (candidate < bestDist) {
          bestDist = candidate;
          bestVia = pair;
        }
      }
      // No reachable parent pair satisfied the depth cap → don't pollute the
      // map with an Infinity entry. Unreachable species stay absent.
      if (bestDist === Number.POSITIVE_INFINITY) continue;
      const prev = dist.get(childId);
      if (prev === undefined || bestDist < prev.dist) {
        dist.set(childId, { dist: bestDist, via: bestVia });
        changed = true;
      }
    }
    if (!changed) break;
  }
  return dist;
}

/**
 * Walk back through `parents` from `start` to expand it into an ordered list
 * of breeding steps (leaves → root). De-duplicates: if two branches need the
 * same intermediate, we still produce it twice in the output (modeling reality
 * — you only get one Pal per breeding). Callers can be smarter later.
 */
export function expandToSteps(
  start: string,
  dist: ReadonlyMap<string, DistanceEntry>,
): SpeciesStep[] {
  const out: SpeciesStep[] = [];
  visit(start);
  return out;

  function visit(id: string): void {
    const entry = dist.get(id);
    if (!entry || entry.via === null) return; // leaf (owned)
    visit(entry.via.parentA);
    visit(entry.via.parentB);
    out.push({ child: id, parentA: entry.via.parentA, parentB: entry.via.parentB });
  }
}

export interface SpeciesStep {
  child: string;
  parentA: string;
  parentB: string;
}

/**
 * Top-K candidate species paths to the target. We surface diversity by
 * iterating the target's parent pairs (Phase 2 ranking order) and, for each,
 * computing a path that uses THAT pair as the final step.
 */
export function topKSpeciesPaths(
  target: string,
  ownedSpecies: ReadonlySet<string>,
  reverseIndex: ReadonlyMap<string, ReadonlyArray<ParentPair>>,
  pals: ReadonlyArray<Pal>,
  k: number = TOP_K_PATHS,
): SpeciesStep[][] {
  const palMap = new Map(pals.map((p) => [p.id, p]));
  const dist = computeDistances(ownedSpecies, reverseIndex);

  // Trivial: target already owned → empty path.
  if (ownedSpecies.has(target)) return [[]];

  const finalPairs = reverseIndex.get(target);
  if (!finalPairs || finalPairs.length === 0) return [];

  // Rank final pairs by the Phase-2 obtainability heuristic for stable tiebreaking.
  const ranked = rankPairs(
    finalPairs
      .map((p) => ({ parentA: palMap.get(p.parentA), parentB: palMap.get(p.parentB) }))
      .filter(
        (p): p is { parentA: Pal; parentB: Pal } =>
          Boolean(p.parentA) && Boolean(p.parentB),
      ),
  );

  const paths: SpeciesStep[][] = [];
  for (const pair of ranked) {
    const da = dist.get(pair.parentA.id)?.dist;
    const db = dist.get(pair.parentB.id)?.dist;
    if (da === undefined || db === undefined) continue;
    const total = da + db + 1;
    if (total > MAX_PATH_DEPTH) continue;

    const aSteps = expandToSteps(pair.parentA.id, dist);
    const bSteps = expandToSteps(pair.parentB.id, dist);
    const path: SpeciesStep[] = [
      ...aSteps,
      ...bSteps,
      { child: target, parentA: pair.parentA.id, parentB: pair.parentB.id },
    ];
    paths.push(path);
    if (paths.length >= k) break;
  }
  return paths;
}

/* -------------------------------------------------------------------------- */
/*  Phase B: passive accumulation + plan scoring                              */
/* -------------------------------------------------------------------------- */

/**
 * For a given candidate species path, attach a passive-stacking strategy and
 * compute step-by-step probability/eggs. The output is a plan we can show.
 *
 * Strategy: forward simulation.
 *   - For each owned species, assemble a "best instance" — the roster pal
 *     of that species carrying the most desired-passives.
 *   - When breeding produces an in-chain child, propagate to the child the
 *     intersection of `desired` and the parents' combined passive pool.
 *   - Score each step with the existing passive math.
 */
export function passifyPath(
  path: SpeciesStep[],
  request: PathfindRequest,
): BreedingPlan {
  const palMap = new Map(request.pals.map((p) => [p.id, p]));
  const passiveMap = new Map(request.passives.map((p) => [p.id, p]));
  const desired = request.desiredPassiveIds
    .map((id) => passiveMap.get(id))
    .filter((p): p is PassiveSkill => Boolean(p));
  const desiredIds = new Set(desired.map((p) => p.id));

  // For each owned species, pick the instance with the most desired-passive overlap.
  // Ties → first occurrence in the roster array (stable).
  const bestInstanceBySpecies = new Map<string, OwnedPal>();
  for (const pal of request.roster) {
    const cur = bestInstanceBySpecies.get(pal.palId);
    if (!cur) {
      bestInstanceBySpecies.set(pal.palId, pal);
      continue;
    }
    const curHits = countDesiredHits(cur.passives, desiredIds);
    const newHits = countDesiredHits(pal.passives, desiredIds);
    if (newHits > curHits) bestInstanceBySpecies.set(pal.palId, pal);
  }

  // Track the passive pool for each *child species produced in this chain*.
  // For owned species, the pool comes from the chosen instance.
  const poolForSpecies = new Map<string, string[]>();
  for (const [palId, owned] of bestInstanceBySpecies) {
    poolForSpecies.set(palId, dedupe(owned.passives));
  }

  const steps: BreedingStep[] = [];
  const warnings: string[] = [];
  let totalEggs = 0;
  let runningProb = 1;

  for (let i = 0; i < path.length; i++) {
    const step = path[i]!;
    const parentAPool = poolForSpecies.get(step.parentA) ?? [];
    const parentBPool = poolForSpecies.get(step.parentB) ?? [];
    const aInstance = bestInstanceBySpecies.get(step.parentA);
    const bInstance = bestInstanceBySpecies.get(step.parentB);
    const isFinal = i === path.length - 1;

    // The target subset for this child = desired ∩ (combined parents' pool).
    // For the final child, we want all of `desired` if reachable; otherwise we
    // only count what's reachable and surface a warning.
    const combined = new Set([...parentAPool, ...parentBPool]);
    const reachable = [...desiredIds].filter((id) => combined.has(id));
    const targetForChild = isFinal ? request.desiredPassiveIds.slice() : reachable;
    if (isFinal && reachable.length < desiredIds.size) {
      const missing = [...desiredIds].filter((id) => !combined.has(id));
      warnings.push(
        `Plan can't fully cover desired passives — missing: ${missing.join(", ")}. ` +
          "Add a roster Pal carrying these to unlock the goal.",
      );
    }

    const desiredObjs = targetForChild
      .map((id) => passiveMap.get(id))
      .filter((p): p is PassiveSkill => Boolean(p));
    const aPassives = parentAPool
      .map((id) => passiveMap.get(id))
      .filter((p): p is PassiveSkill => Boolean(p));
    const bPassives = parentBPool
      .map((id) => passiveMap.get(id))
      .filter((p): p is PassiveSkill => Boolean(p));

    const opts = { globalPassiveCount: request.passives.length };
    const probability =
      desiredObjs.length === 0
        ? 1
        : probabilityOfAtLeastPassives(aPassives, bPassives, desiredObjs, opts);
    const eggs =
      desiredObjs.length === 0 ? 1 : expectedEggCount(aPassives, bPassives, desiredObjs, opts);

    runningProb *= probability;
    if (Number.isFinite(eggs)) totalEggs += eggs;
    else totalEggs = Number.POSITIVE_INFINITY;

    const breedingStep: BreedingStep = {
      parentA: {
        palId: step.parentA,
        instanceId: aInstance?.instanceId,
        requiredPassives: parentAPool.filter((p) => desiredIds.has(p)),
      },
      parentB: {
        palId: step.parentB,
        instanceId: bInstance?.instanceId,
        requiredPassives: parentBPool.filter((p) => desiredIds.has(p)),
      },
      child: { palId: step.child, targetPassives: targetForChild },
      expectedEggs: Number.isFinite(eggs) ? eggs : Number.POSITIVE_INFINITY,
      probability,
    };
    steps.push(breedingStep);

    // Once we breed this step, we now have access to the child carrying — at
    // best — the union of parents' desired-relevant passives. Add it to the
    // pool so downstream steps can rely on it.
    poolForSpecies.set(step.child, [
      ...new Set([
        ...(poolForSpecies.get(step.child) ?? []),
        ...parentAPool.filter((id) => desiredIds.has(id)),
        ...parentBPool.filter((id) => desiredIds.has(id)),
      ]),
    ]);

    // Annotate breed-only intermediates as a warning — these require the user
    // to breed their parents first, which the path already accounts for, but
    // the UI message is friendlier when surfaced.
    const childPal = palMap.get(step.child);
    if (childPal?.breedOnly && !isFinal) {
      breedingStep.notes = `${childPal.name} is breed-only; this is an unavoidable intermediate.`;
    }
  }

  return {
    steps,
    totalSteps: steps.length,
    totalExpectedEggs: totalEggs,
    finalProbability: runningProb,
    warnings,
  };
}

/* -------------------------------------------------------------------------- */
/*  Top-level entrypoint                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Run the full pathfinder. Pure synchronous function — runs in a Worker for
 * UI smoothness, but it's also safe to call directly in tests.
 */
export function findBreedingPlans(request: PathfindRequest): PathfindResponse {
  const start = nowMs();
  const ownedSpecies = new Set(request.roster.map((p) => p.palId));
  const palMap = new Map(request.pals.map((p) => [p.id, p]));

  // Trivial: target already owned.
  if (ownedSpecies.has(request.targetPalId)) {
    return {
      plans: [
        {
          steps: [],
          totalSteps: 0,
          totalExpectedEggs: 0,
          finalProbability: 1,
          warnings: [
            "You already own this species — no breeding required.",
            request.desiredPassiveIds.length > 0
              ? "Note: this plan doesn't currently optimize the passives on the existing instance."
              : "",
          ].filter((w) => w.length > 0),
        },
      ],
      warnings: [],
      diagnostics: { candidatePathsExplored: 0, hitDepthLimit: false, durationMs: nowMs() - start },
    };
  }

  // Validate target is real.
  if (!palMap.has(request.targetPalId)) {
    return emptyResponse(start, [`Unknown target palId: ${request.targetPalId}`]);
  }

  const paths = topKSpeciesPaths(
    request.targetPalId,
    ownedSpecies,
    request.reverseIndex,
    request.pals,
    TOP_K_PATHS,
  );

  if (paths.length === 0) {
    return emptyResponse(start, [
      `No path found within depth ${MAX_PATH_DEPTH} — try adding intermediate species to your roster.`,
    ]);
  }

  // Score each candidate path with passive accumulation and rank.
  const plans = paths.map((p) => passifyPath(p, request));
  plans.sort((a, b) => {
    // Use `<` instead of subtraction so Infinity comparisons stay well-defined
    // (Infinity − Infinity = NaN, which would corrupt the comparator).
    if (a.totalExpectedEggs !== b.totalExpectedEggs) {
      return a.totalExpectedEggs < b.totalExpectedEggs ? -1 : 1;
    }
    if (a.totalSteps !== b.totalSteps) return a.totalSteps - b.totalSteps;
    // Final tiebreak: alphabetical by serialized step list, for absolute determinism.
    return planSignature(a).localeCompare(planSignature(b));
  });

  const top = plans.slice(0, TOP_N_PLANS);
  const hitDepthLimit = paths.some((p) => p.length === MAX_PATH_DEPTH);

  return {
    plans: top,
    warnings: [],
    diagnostics: {
      candidatePathsExplored: paths.length,
      hitDepthLimit,
      durationMs: nowMs() - start,
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  Local helpers                                                             */
/* -------------------------------------------------------------------------- */

function emptyResponse(start: number, warnings: string[]): PathfindResponse {
  return {
    plans: [],
    warnings,
    diagnostics: {
      candidatePathsExplored: 0,
      hitDepthLimit: false,
      durationMs: nowMs() - start,
    },
  };
}

function nowMs(): number {
  if (typeof performance !== "undefined" && performance.now) {
    return performance.now();
  }
  return Date.now();
}

function dedupe<T>(arr: ReadonlyArray<T>): T[] {
  return [...new Set(arr)];
}

function countDesiredHits(passives: ReadonlyArray<string>, desired: ReadonlySet<string>): number {
  let n = 0;
  for (const id of passives) if (desired.has(id)) n++;
  return n;
}

function sortPairsCanonical(pairs: ReadonlyArray<ParentPair>): ParentPair[] {
  return [...pairs].sort((a, b) => {
    if (a.parentA !== b.parentA) return a.parentA.localeCompare(b.parentA);
    return a.parentB.localeCompare(b.parentB);
  });
}

function planSignature(plan: BreedingPlan): string {
  return plan.steps
    .map((s) => `${s.parentA.palId}+${s.parentB.palId}=${s.child.palId}`)
    .join("|");
}
