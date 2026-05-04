import { describe, expect, it } from "vitest";

import type { Pal } from "@/types/pal";
import { RANKING_WEIGHTS, rankPairs, scorePair } from "./ranking";

const mkPal = (overrides: Partial<Pal> & Pick<Pal, "id" | "paldexNo">): Pal => ({
  name: overrides.id,
  slug: overrides.id,
  elements: ["Neutral"],
  powerValue: 1000,
  breedable: true,
  ...overrides,
});

describe("scorePair", () => {
  it("sums paldex numbers weighted by paldexPenalty", () => {
    const a = mkPal({ id: "a", paldexNo: 4 });
    const b = mkPal({ id: "b", paldexNo: 6 });
    const s = scorePair(a, b);
    expect(s.paldex).toBe((4 + 6) * RANKING_WEIGHTS.paldexPenalty);
  });

  it("applies same-element bonus only when primary elements match", () => {
    const fireA = mkPal({ id: "a", paldexNo: 1, elements: ["Fire"] });
    const fireB = mkPal({ id: "b", paldexNo: 2, elements: ["Fire"] });
    const water = mkPal({ id: "c", paldexNo: 3, elements: ["Water"] });

    expect(scorePair(fireA, fireB).sameElement).toBe(RANKING_WEIGHTS.sameElementBonus);
    expect(scorePair(fireA, water).sameElement).toBe(0);
  });

  it("penalizes breed-only parents per parent (stacks)", () => {
    const normal = mkPal({ id: "a", paldexNo: 1 });
    const bo1 = mkPal({ id: "b", paldexNo: 2, breedOnly: true });
    const bo2 = mkPal({ id: "c", paldexNo: 3, breedOnly: true });

    expect(scorePair(normal, normal).breedOnly).toBe(0);
    expect(scorePair(normal, bo1).breedOnly).toBe(RANKING_WEIGHTS.breedOnlyPenalty);
    expect(scorePair(bo1, bo2).breedOnly).toBe(RANKING_WEIGHTS.breedOnlyPenalty * 2);
  });

  it("penalizes non-breedable parents", () => {
    const normal = mkPal({ id: "a", paldexNo: 1 });
    const variant = mkPal({ id: "b", paldexNo: 2, breedable: false });
    expect(scorePair(normal, variant).variant).toBe(RANKING_WEIGHTS.variantParentPenalty);
    expect(scorePair(variant, variant).variant).toBe(
      RANKING_WEIGHTS.variantParentPenalty * 2,
    );
  });

  it("totals all contributions into a single score", () => {
    const a = mkPal({ id: "a", paldexNo: 5, elements: ["Fire"] });
    const b = mkPal({ id: "b", paldexNo: 7, elements: ["Fire"] });
    const s = scorePair(a, b);
    expect(s.total).toBe(s.paldex + s.sameElement + s.breedOnly + s.variant);
  });
});

describe("rankPairs", () => {
  const easy = mkPal({ id: "easy", paldexNo: 2, elements: ["Fire"] });
  const easyMatch = mkPal({ id: "easy-match", paldexNo: 4, elements: ["Fire"] });
  const lateGame = mkPal({ id: "late", paldexNo: 100, elements: ["Water"] });
  const breedOnly = mkPal({
    id: "breed-only",
    paldexNo: 50,
    breedable: false,
    breedOnly: true,
  });

  it("ranks easy + same-element pair above late-game pair", () => {
    const ranked = rankPairs([
      { parentA: lateGame, parentB: lateGame },
      { parentA: easy, parentB: easyMatch },
    ]);
    expect(ranked[0]?.parentA.id).toBe("easy");
  });

  it("ranks breed-only pair last", () => {
    const ranked = rankPairs([
      { parentA: breedOnly, parentB: breedOnly },
      { parentA: easy, parentB: easyMatch },
      { parentA: lateGame, parentB: easy },
    ]);
    expect(ranked[ranked.length - 1]?.parentA.id).toBe("breed-only");
  });

  it("does not mutate the input array", () => {
    const input = [
      { parentA: lateGame, parentB: lateGame },
      { parentA: easy, parentB: easy },
    ];
    const before = [...input];
    rankPairs(input);
    expect(input).toEqual(before);
  });

  it("returns deterministic order for equal scores via paldex tiebreaker", () => {
    const a1 = mkPal({ id: "a1", paldexNo: 1 });
    const b1 = mkPal({ id: "b1", paldexNo: 9 });
    const a2 = mkPal({ id: "a2", paldexNo: 2 });
    const b2 = mkPal({ id: "b2", paldexNo: 8 });
    // both pairs sum to paldex 10 → same total score → tiebreaker by parentA.paldexNo
    const ranked = rankPairs([
      { parentA: a2, parentB: b2 },
      { parentA: a1, parentB: b1 },
    ]);
    expect(ranked[0]?.parentA.id).toBe("a1");
    expect(ranked[1]?.parentA.id).toBe("a2");
  });
});
