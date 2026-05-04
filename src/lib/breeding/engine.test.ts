import { describe, expect, it } from "vitest";

import { fixtureCombos, fixturePals } from "@tests/fixtures/pals";
import { allCombos } from "@/lib/data/combos";
import { allPals } from "@/lib/data/pals";
import { getParentPairsFor } from "@/lib/data/reverse-index";
import {
  breed,
  breedDetailed,
  computeTargetPower,
  findCombo,
  pickClosestByPower,
} from "./engine";
import type { BreedingContext } from "./types";

const ctx: BreedingContext = {
  pals: fixturePals,
  combos: fixtureCombos,
};

const palById = (id: string) => {
  const p = fixturePals.find((x) => x.id === id);
  if (!p) throw new Error(`fixture missing: ${id}`);
  return p;
};

describe("computeTargetPower", () => {
  it("uses floor((a + b + 1) / 2)", () => {
    expect(computeTargetPower(10, 30)).toBe(20); // floor((10+30+1)/2) = 20
    expect(computeTargetPower(11, 12)).toBe(12); // floor((11+12+1)/2) = 12
    expect(computeTargetPower(0, 0)).toBe(0); // floor(1/2) = 0
  });

  it("is symmetric in its arguments", () => {
    expect(computeTargetPower(13, 41)).toBe(computeTargetPower(41, 13));
  });
});

describe("findCombo (symmetric lookup)", () => {
  it("finds (A, B)", () => {
    expect(findCombo("alpha", "bravo", fixtureCombos)?.child).toBe("juliet");
  });

  it("finds (B, A) too — order does not matter", () => {
    expect(findCombo("bravo", "alpha", fixtureCombos)?.child).toBe("juliet");
  });

  it("returns undefined for non-special pairings", () => {
    expect(findCombo("charlie", "delta", fixtureCombos)).toBeUndefined();
  });
});

describe("pickClosestByPower", () => {
  it("returns the closest breedable Pal", () => {
    // target 20: candidates with diffs alpha=10, bravo=10, charlie=30, ...
    // Tie between alpha (paldex 1) and bravo (paldex 2) — alpha wins.
    expect(pickClosestByPower(20, fixturePals)?.id).toBe("alpha");
  });

  it("excludes non-breedable Pals from the candidate pool", () => {
    // india-variant has powerValue 20 (a perfect match) but breedable=false.
    // The picker must skip it and fall back to the closest breedable Pal.
    const result = pickClosestByPower(20, fixturePals);
    expect(result?.id).not.toBe("india-variant");
  });

  it("returns undefined when no breedable Pals exist", () => {
    const noneBreedable = fixturePals.map((p) => ({ ...p, breedable: false }));
    expect(pickClosestByPower(50, noneBreedable)).toBeUndefined();
  });
});

describe("breed — special combo override", () => {
  it("returns the combo child even when power-value math would say otherwise", () => {
    const result = breedDetailed(palById("alpha"), palById("bravo"), ctx);
    expect(result.child.id).toBe("juliet");
    expect(result.source).toBe("special-combo");
  });

  it("matches the combo regardless of parent order", () => {
    const ab = breed(palById("alpha"), palById("bravo"), ctx);
    const ba = breed(palById("bravo"), palById("alpha"), ctx);
    expect(ab.id).toBe(ba.id);
    expect(ab.id).toBe("juliet");
  });
});

describe("breed — power-value math", () => {
  it("returns the closest breedable Pal by powerValue", () => {
    // charlie(50) + delta(70) -> floor((50+70+1)/2) = 60.
    // closest breedable: charlie(50, diff 10) and delta(70, diff 10) tie;
    // tie-breaker: lower paldexNo -> charlie (paldex 3).
    const result = breedDetailed(palById("charlie"), palById("delta"), ctx);
    expect(result.source).toBe("power-value");
    expect(result.child.id).toBe("charlie");
  });

  it("breaks ties by lower paldexNo", () => {
    // golf and hotel share powerValue=40. Any target equally close to both
    // forces the tie-breaker, which prefers the lower paldexNo (golf, #7).
    //
    // bravo(30) + charlie(50): target = floor((30+50+1)/2) = 40.
    //   - golf  (power 40, paldex 7) -> diff 0
    //   - hotel (power 40, paldex 8) -> diff 0
    //   tie => golf wins.
    const tieResult = breedDetailed(palById("bravo"), palById("charlie"), ctx);
    expect(tieResult.source).toBe("power-value");
    expect(tieResult.child.id).toBe("golf");
  });

  it("breeding two power-40 Pals also resolves through the tie-breaker", () => {
    // golf(40) + hotel(40): target = floor((40+40+1)/2) = 40. Both tie at diff 0;
    // golf wins by paldexNo. (Confirms the tie-breaker doesn't depend on parent
    // order — it's a property of the candidate pool ordering.)
    const result = breedDetailed(palById("golf"), palById("hotel"), ctx);
    expect(result.source).toBe("power-value");
    expect(result.child.id).toBe("golf");
  });
});

describe("breed — same-species", () => {
  it("Pal × same Pal returns the same Pal", () => {
    const result = breedDetailed(palById("delta"), palById("delta"), ctx);
    expect(result.child.id).toBe("delta");
  });
});

describe("reverse-index round-trip (catches drift between engine and index)", () => {
  // For a sampled set of (parentA, parentB) entries from the index, calling
  // breed() on those parents must produce the indexed child. If this ever
  // fails, the index is stale — re-run `pnpm build:reverse-index`.
  const realCtx: BreedingContext = { pals: [...allPals], combos: [...allCombos] };

  it("every parent pair in the index breeds back to its indexed child", () => {
    let checked = 0;
    for (const child of allPals) {
      for (const pair of getParentPairsFor(child.id)) {
        const a = allPals.find((p) => p.id === pair.parentA);
        const b = allPals.find((p) => p.id === pair.parentB);
        expect(a, `unknown parent ${pair.parentA}`).toBeDefined();
        expect(b, `unknown parent ${pair.parentB}`).toBeDefined();
        const result = breed(a!, b!, realCtx);
        expect(
          result.id,
          `index says ${pair.parentA} × ${pair.parentB} = ${child.id} but engine returned ${result.id}`,
        ).toBe(child.id);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0); // sanity: index isn't empty
  });
});

describe("breed — error handling", () => {
  it("throws if a special combo references a missing child id", () => {
    const brokenCtx: BreedingContext = {
      pals: fixturePals,
      combos: [{ parentA: "alpha", parentB: "bravo", child: "does-not-exist" }],
    };
    expect(() => breed(palById("alpha"), palById("bravo"), brokenCtx)).toThrow(
      /unknown child id/,
    );
  });

  it("throws if no breedable Pals exist in the context", () => {
    const emptyCtx: BreedingContext = {
      pals: fixturePals.map((p) => ({ ...p, breedable: false })),
      combos: [],
    };
    expect(() => breed(palById("charlie"), palById("delta"), emptyCtx)).toThrow(
      /empty pool/,
    );
  });
});
