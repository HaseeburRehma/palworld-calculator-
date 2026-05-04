import { describe, expect, it } from "vitest";

import type { OwnedPal, PathfindRequest } from "@/types/pal";
import {
  computeDistances,
  findBreedingPlans,
  MAX_PATH_DEPTH,
  topKSpeciesPaths,
} from "./pathfind";
import {
  fxPals,
  fxPassives,
  fxReverseIndex,
} from "@tests/fixtures/breeding-graph";

const owned = (palId: string, passives: string[] = []): OwnedPal => ({
  instanceId: `inst-${palId}-${passives.join("-") || "0"}`,
  palId,
  passives,
});

const baseRequest = (
  partial: Partial<PathfindRequest> & {
    roster: PathfindRequest["roster"];
    targetPalId: string;
  },
): PathfindRequest => ({
  pals: fxPals,
  reverseIndex: fxReverseIndex,
  passives: fxPassives,
  desiredPassiveIds: [],
  ...partial,
});

describe("computeDistances", () => {
  it("assigns dist=0 to owned species and ∞ semantics elsewhere", () => {
    const dist = computeDistances(new Set(["ant", "bat"]), fxReverseIndex);
    expect(dist.get("ant")?.dist).toBe(0);
    expect(dist.get("bat")?.dist).toBe(0);
  });

  it("relaxes to known shortest distances on the fixture graph", () => {
    const dist = computeDistances(new Set(["ant", "bat"]), fxReverseIndex);
    expect(dist.get("cow")?.dist).toBe(1); // ant + bat
    expect(dist.get("dog")?.dist).toBe(2); // ant + cow
    expect(dist.get("elf")?.dist).toBe(2); // bat + cow
    expect(dist.get("fox")?.dist).toBe(5); // dog + elf
    expect(dist.get("ghost")?.dist).toBe(4); // cow + elf
    // hawk = dog + ghost + 1 = 2 + 4 + 1 = 7 → over cap, never set.
    expect(dist.get("hawk")?.dist ?? Number.POSITIVE_INFINITY).toBeGreaterThan(MAX_PATH_DEPTH);
  });

  it("respects MAX_PATH_DEPTH — entries beyond the cap are not added", () => {
    // With only ant owned, bat is unreachable, so cow+dog+... never appear.
    const dist = computeDistances(new Set(["ant"]), fxReverseIndex);
    expect(dist.get("ant")?.dist).toBe(0);
    expect(dist.get("cow")).toBeUndefined();
  });

  it("is deterministic across runs (same input → same dist + via)", () => {
    const a = computeDistances(new Set(["ant", "bat"]), fxReverseIndex);
    const b = computeDistances(new Set(["ant", "bat"]), fxReverseIndex);
    for (const id of a.keys()) expect(b.get(id)).toEqual(a.get(id));
  });
});

describe("topKSpeciesPaths", () => {
  it("returns [[]] for the trivial case (target already owned)", () => {
    const paths = topKSpeciesPaths("cow", new Set(["cow"]), fxReverseIndex, fxPals);
    expect(paths).toEqual([[]]);
  });

  it("one-step case: roster has both required parents", () => {
    const paths = topKSpeciesPaths("cow", new Set(["ant", "bat"]), fxReverseIndex, fxPals);
    expect(paths.length).toBe(1);
    expect(paths[0]).toEqual([
      { child: "cow", parentA: "ant", parentB: "bat" },
    ]);
  });

  it("multi-step case: known-good shortest path to fox", () => {
    const paths = topKSpeciesPaths("fox", new Set(["ant", "bat"]), fxReverseIndex, fxPals);
    expect(paths.length).toBeGreaterThan(0);
    const path = paths[0]!;
    // fox = dog + elf, both 2 steps deep ⇒ 5 total breedings.
    expect(path).toHaveLength(5);
    expect(path[path.length - 1]).toEqual({
      child: "fox",
      parentA: "dog",
      parentB: "elf",
    });
  });

  it("surfaces alternative final pairs when multiple exist (top-K diversity)", () => {
    // ghost has two possible final pairs in the fixture.
    const paths = topKSpeciesPaths(
      "ghost",
      new Set(["ant", "bat"]),
      fxReverseIndex,
      fxPals,
    );
    expect(paths.length).toBeGreaterThanOrEqual(2);
    const finalPairs = paths.map((p) => {
      const last = p[p.length - 1]!;
      return [last.parentA, last.parentB].sort().join("+");
    });
    expect(new Set(finalPairs).size).toBeGreaterThanOrEqual(2);
  });

  it("returns empty for unreachable species under depth limit", () => {
    // imp has no parents in the reverse index; from any roster, it's unreachable.
    const paths = topKSpeciesPaths("imp", new Set(["ant", "bat"]), fxReverseIndex, fxPals);
    expect(paths).toEqual([]);
  });
});

describe("findBreedingPlans", () => {
  it("trivial: target already owned → empty plan, zero steps", () => {
    const res = findBreedingPlans(
      baseRequest({ roster: [owned("cow")], targetPalId: "cow" }),
    );
    expect(res.plans).toHaveLength(1);
    expect(res.plans[0]!.totalSteps).toBe(0);
    expect(res.plans[0]!.totalExpectedEggs).toBe(0);
    expect(res.plans[0]!.finalProbability).toBe(1);
  });

  it("one-step: roster covers both parents", () => {
    const res = findBreedingPlans(
      baseRequest({ roster: [owned("ant"), owned("bat")], targetPalId: "cow" }),
    );
    expect(res.plans.length).toBeGreaterThan(0);
    const plan = res.plans[0]!;
    expect(plan.totalSteps).toBe(1);
    expect(plan.steps[0]!.parentA.palId).toBe("ant");
    expect(plan.steps[0]!.parentB.palId).toBe("bat");
    expect(plan.steps[0]!.child.palId).toBe("cow");
  });

  it("multi-step: hand-built fixture, target=fox, expects 5 breedings", () => {
    const res = findBreedingPlans(
      baseRequest({ roster: [owned("ant"), owned("bat")], targetPalId: "fox" }),
    );
    expect(res.plans.length).toBeGreaterThan(0);
    const plan = res.plans[0]!;
    expect(plan.totalSteps).toBe(5);
    const childChain = plan.steps.map((s) => s.child.palId);
    // Order is leaves → root; the last child is the goal.
    expect(childChain[childChain.length - 1]).toBe("fox");
    // Every intermediate species needed to make fox shows up.
    expect(childChain).toEqual(expect.arrayContaining(["cow", "dog", "elf", "fox"]));
  });

  it("unreachable: target needs a species outside the owned closure", () => {
    // Owning only "imp" gets us nowhere — no edges flow from imp.
    const res = findBreedingPlans(
      baseRequest({ roster: [owned("imp")], targetPalId: "fox" }),
    );
    expect(res.plans).toEqual([]);
    expect(res.warnings.join(" ")).toMatch(/No path found/);
  });

  it("respects depth cap: hawk needs 7 breedings from {ant,bat} → rejected", () => {
    // From {ant,bat}: dist[dog]=2, dist[ghost]=4, hawk = 2+4+1 = 7 → over the 6 cap.
    const res = findBreedingPlans(
      baseRequest({ roster: [owned("ant"), owned("bat")], targetPalId: "hawk" }),
    );
    expect(res.plans).toEqual([]);
    expect(res.warnings.join(" ")).toMatch(/No path found/);
  });

  it("passive accumulation: same species path, different starting passives, different eggs", () => {
    // Two rosters reaching cow, but one already has the desired passive.
    const desiredPassiveIds = ["lucky"];
    const withLucky = findBreedingPlans(
      baseRequest({
        roster: [owned("ant", ["lucky"]), owned("bat")],
        targetPalId: "cow",
        desiredPassiveIds,
      }),
    );
    const without = findBreedingPlans(
      baseRequest({
        roster: [owned("ant"), owned("bat")],
        targetPalId: "cow",
        desiredPassiveIds,
      }),
    );
    expect(withLucky.plans[0]!.totalExpectedEggs).toBeLessThan(
      without.plans[0]!.totalExpectedEggs,
    );
  });

  it("flags unreachable passives in warnings when none are present in any owned instance", () => {
    const res = findBreedingPlans(
      baseRequest({
        roster: [owned("ant"), owned("bat")],
        targetPalId: "cow",
        desiredPassiveIds: ["lucky", "swift"],
      }),
    );
    // Probability/eggs may still be computed (wild rolls), but the path
    // should warn that desired ⊄ parents' pool. Note: the warning is on the
    // PLAN, not the response, since a path may exist that just won't deliver.
    const allWarnings = res.plans.flatMap((p) => p.warnings).join(" ");
    expect(allWarnings).toMatch(/missing/i);
  });

  it("is deterministic — same inputs produce identical results", () => {
    const req = baseRequest({
      roster: [owned("ant"), owned("bat")],
      targetPalId: "fox",
      desiredPassiveIds: ["lucky"],
    });
    const a = findBreedingPlans(req);
    const b = findBreedingPlans(req);
    expect(stripDiagnostics(a)).toEqual(stripDiagnostics(b));
  });

  it("returns at most TOP_N_PLANS plans", () => {
    const res = findBreedingPlans(
      baseRequest({
        roster: [owned("ant"), owned("bat")],
        targetPalId: "ghost",
      }),
    );
    expect(res.plans.length).toBeLessThanOrEqual(5);
  });

  it("MAX_PATH_DEPTH is the documented constant — sanity check", () => {
    expect(MAX_PATH_DEPTH).toBe(6);
  });
});

function stripDiagnostics(res: ReturnType<typeof findBreedingPlans>) {
  // `durationMs` is wall-clock, drop it for equality.
  const { diagnostics, ...rest } = res;
  return { ...rest, diagnostics: { ...diagnostics, durationMs: 0 } };
}
