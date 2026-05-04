import { describe, expect, it } from "vitest";

import type { PassiveSkill } from "@/types/pal";
import {
  binomial,
  expectedEggCount,
  PASSIVE_INHERITANCE,
  probabilityOfAtLeastPassives,
  probabilityOfExactPassives,
} from "./passives";

const mkPassive = (id: string): PassiveSkill => ({
  id,
  name: id,
  tier: "positive",
  rank: 1,
  effect: id,
});

const p1 = mkPassive("p1");
const p2 = mkPassive("p2");
const p3 = mkPassive("p3");
const p4 = mkPassive("p4");
const x = mkPassive("x"); // some unrelated passive

const G = 50; // global passive pool — tests pin this down for determinism

describe("binomial", () => {
  it("matches known values", () => {
    expect(binomial(0, 0)).toBe(1);
    expect(binomial(5, 0)).toBe(1);
    expect(binomial(5, 5)).toBe(1);
    expect(binomial(5, 2)).toBe(10);
    expect(binomial(10, 3)).toBe(120);
  });

  it("returns 0 for invalid inputs", () => {
    expect(binomial(3, 5)).toBe(0);
    expect(binomial(3, -1)).toBe(0);
    expect(binomial(-1, 0)).toBe(0);
  });
});

describe("PASSIVE_INHERITANCE constants", () => {
  it("countDistribution sums to 1", () => {
    const sum = PASSIVE_INHERITANCE.countDistribution.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 6);
  });

  it("countDistribution length matches maxPassives", () => {
    expect(PASSIVE_INHERITANCE.countDistribution.length).toBe(
      PASSIVE_INHERITANCE.maxPassives,
    );
  });
});

describe("probabilityOfAtLeastPassives", () => {
  it("returns 1 for an empty desired set (vacuously satisfied)", () => {
    expect(
      probabilityOfAtLeastPassives([p1, p2], [p3], [], { globalPassiveCount: G }),
    ).toBe(1);
  });

  it("throws when desired exceeds maxPassives", () => {
    const tooMany = [p1, p2, p3, p4, mkPassive("p5")];
    expect(() =>
      probabilityOfAtLeastPassives([p1], [p2], tooMany, { globalPassiveCount: G }),
    ).toThrow(/desired set has 5 passives/);
  });

  it("gives high probability when 2 desired are present in both parents", () => {
    // pool = {p1,p2}, P=2, d=2, q=2.
    // The K=2/3/4 branches all collapse to k=2 (capped) and inherit the whole
    // pool — guaranteed coverage. Only K=1 misses one and needs a wild roll.
    // Expected ≈ P(K≥2 effectively) = 0.6 + tiny wild contribution.
    const p = probabilityOfAtLeastPassives([p1, p2], [p1, p2], [p1, p2], {
      globalPassiveCount: G,
    });
    expect(p).toBeGreaterThan(0.55);
    expect(p).toBeLessThan(0.65);
  });

  it("gives all-4 case ≈ P(K=4) since K=4 alone guarantees coverage", () => {
    // pool = {p1..p4}, P=4, d=4, q=4. Only the K=4 branch fully covers via
    // inheritance; lower K need increasingly improbable wild rolls.
    const p = probabilityOfAtLeastPassives([p1, p2, p3, p4], [p1, p2, p3, p4], [p1, p2, p3, p4], {
      globalPassiveCount: G,
    });
    // P(K=4) = 0.1 baseline + a tiny bit from K=3 + wild.
    expect(p).toBeGreaterThan(0.099);
    expect(p).toBeLessThan(0.12);
  });

  it("gives near-zero probability when zero desired are in either parent", () => {
    // parents have unrelated passive x; desired needs 2 specific wild rolls.
    const p = probabilityOfAtLeastPassives([x], [x], [p1, p2], {
      globalPassiveCount: G,
    });
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThan(0.01);
  });

  it("partial coverage: half desired in pool gives intermediate probability", () => {
    // pool = {p1, p2, x}; desired = {p1, p2, p3, p4}; q=2, r=2.
    // Need wild to cover at least p3 and p4 → multi-wild rolls — quite low.
    const p = probabilityOfAtLeastPassives([p1, x], [p2, x], [p1, p2, p3, p4], {
      globalPassiveCount: G,
    });
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThan(0.01);
  });

  it("is always in [0, 1] for a sweep of random inputs (property test)", () => {
    const all = [p1, p2, p3, p4, x, mkPassive("y"), mkPassive("z")];
    const rng = mulberry32(42);
    const sample = (n: number) => {
      const shuffled = [...all].sort(() => rng() - 0.5);
      return shuffled.slice(0, n);
    };
    for (let trial = 0; trial < 100; trial++) {
      const a = sample(Math.floor(rng() * 5));
      const b = sample(Math.floor(rng() * 5));
      const desiredCount = Math.floor(rng() * 5); // 0..4
      const desired = sample(desiredCount);
      const p = probabilityOfAtLeastPassives(a, b, desired, { globalPassiveCount: G });
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });
});

describe("probabilityOfExactPassives", () => {
  it("throws when desired exceeds maxPassives", () => {
    const tooMany = [p1, p2, p3, p4, mkPassive("p5")];
    expect(() =>
      probabilityOfExactPassives([p1], [p2], tooMany, { globalPassiveCount: G }),
    ).toThrow(/max is 4/);
  });

  it("is in [0, 1] for a sweep of random inputs (property test)", () => {
    const all = [p1, p2, p3, p4, x, mkPassive("y"), mkPassive("z")];
    const rng = mulberry32(7);
    const sample = (n: number) => {
      const shuffled = [...all].sort(() => rng() - 0.5);
      return shuffled.slice(0, n);
    };
    for (let trial = 0; trial < 100; trial++) {
      const a = sample(Math.floor(rng() * 5));
      const b = sample(Math.floor(rng() * 5));
      const desired = sample(Math.floor(rng() * 5));
      const p = probabilityOfExactPassives(a, b, desired, { globalPassiveCount: G });
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });
});

describe("at-least vs exact relationship", () => {
  it("P(at least D) >= P(exactly D) for arbitrary inputs", () => {
    // "Exactly D" is a strict subset of the "at least D" event, so
    // P(exact) ≤ P(at least). Verify across a few hand-picked cases.
    const cases: Array<[PassiveSkill[], PassiveSkill[], PassiveSkill[]]> = [
      [[p1, p2], [p1, p2], [p1, p2]],
      [[p1], [p2], [p1, p2]],
      [[p1, p2, p3], [p4, x], [p1, p4]],
      [[x], [x], [p1]],
      [[], [], [p1]],
      [[p1, p2, p3, p4], [p1, p2, p3, p4], [p1, p2, p3, p4]],
    ];
    for (const [a, b, d] of cases) {
      const at = probabilityOfAtLeastPassives(a, b, d, { globalPassiveCount: G });
      const ex = probabilityOfExactPassives(a, b, d, { globalPassiveCount: G });
      expect(at).toBeGreaterThanOrEqual(ex - 1e-9);
    }
  });
});

describe("expectedEggCount", () => {
  it("equals 1 / probabilityOfAtLeastPassives", () => {
    const a = [p1, p2, p3, p4];
    const opts = { globalPassiveCount: G };
    const p = probabilityOfAtLeastPassives(a, a, [p1, p2], opts);
    const eggs = expectedEggCount(a, a, [p1, p2], opts);
    expect(eggs).toBeCloseTo(1 / p, 6);
  });

  it("returns Infinity when probability is zero", () => {
    // 4 desired, none in either parent (pool only has x), so we need 4 wild
    // rolls — but max wild slots is 4 - K_min = 3. Unreachable.
    const eggs = expectedEggCount([x], [x], [p1, p2, p3, p4], {
      globalPassiveCount: G,
    });
    expect(eggs).toBe(Number.POSITIVE_INFINITY);
  });

  it("is small when desired is fully present in pool and small", () => {
    const eggs = expectedEggCount([p1, p2], [p1, p2], [p1, p2], {
      globalPassiveCount: G,
    });
    expect(eggs).toBeGreaterThan(1);
    expect(eggs).toBeLessThan(2);
  });
});

/* -------------------------------------------------------------------------- */
/*  Tiny deterministic RNG so the property tests never flake.                 */
/* -------------------------------------------------------------------------- */
function mulberry32(seed: number) {
  let t = seed;
  return function () {
    t |= 0;
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
