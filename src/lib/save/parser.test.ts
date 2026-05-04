import { describe, expect, it } from "vitest";

import { parseSaveFile } from "./parser";
import { buildSyntheticSave } from "@tests/fixtures/gvas-builder";

describe("parseSaveFile — happy path", () => {
  it("parses a minimal synthetic save with one Pal", async () => {
    const buf = buildSyntheticSave([
      {
        characterId: "Pal_Lamball",
        level: 12,
        passives: ["Trait_Lucky", "Trait_Swift"],
        gender: "male",
        nickname: "Cloud",
      },
    ]);
    const result = await parseSaveFile(buf);
    expect(result.errors.filter((e) => e.fatal)).toHaveLength(0);
    expect(result.pals).toHaveLength(1);
    const pal = result.pals[0]!;
    expect(pal.rawId).toBe("Pal_Lamball");
    expect(pal.palId).toBe("lamball");
    expect(pal.passives).toEqual(["lucky", "swift"]);
    expect(pal.level).toBe(12);
    expect(pal.gender).toBe("male");
    expect(pal.nickname).toBe("Cloud");
    expect(pal.isPlayerOwned).toBe(true);
  });

  it("collects multiple Pals and reports their order stably", async () => {
    const buf = buildSyntheticSave([
      { characterId: "Pal_Lamball", level: 1, passives: [] },
      { characterId: "Pal_Cattiva", level: 5, passives: ["Trait_Lucky"] },
      { characterId: "Pal_Foxparks", level: 10, passives: [] },
    ]);
    const result = await parseSaveFile(buf);
    expect(result.pals.map((p) => p.rawId)).toEqual([
      "Pal_Lamball",
      "Pal_Cattiva",
      "Pal_Foxparks",
    ]);
  });

  it("flags unmapped Pal ids without dropping them", async () => {
    const buf = buildSyntheticSave([
      { characterId: "Pal_Lamball", level: 1, passives: [] },
      { characterId: "Pal_NotInOurDb_v9000", level: 1, passives: [] },
    ]);
    const result = await parseSaveFile(buf);
    expect(result.pals).toHaveLength(2);
    expect(result.pals[1]!.palId).toBeNull();
    expect(result.unmappedPalIds).toContain("Pal_NotInOurDb_v9000");
  });

  it("flags unmapped passive ids and continues", async () => {
    const buf = buildSyntheticSave([
      {
        characterId: "Pal_Lamball",
        level: 1,
        passives: ["Trait_Lucky", "Trait_PatchedNewPassive"],
      },
    ]);
    const result = await parseSaveFile(buf);
    expect(result.pals[0]!.passives).toEqual(["lucky"]);
    expect(result.unmappedPassiveIds).toContain("Trait_PatchedNewPassive");
    expect(result.pals[0]!.unmappedPassiveCount).toBe(1);
  });

  it("excludes the player-avatar entry (IsPlayer=true)", async () => {
    const buf = buildSyntheticSave([
      { characterId: "Pal_Lamball", level: 1, passives: [] },
      { characterId: "PlayerCharacter", level: 1, passives: [], isPlayer: true },
    ]);
    const result = await parseSaveFile(buf);
    const ownedPalsOnly = result.pals.filter((p) => p.isPlayerOwned);
    expect(ownedPalsOnly.map((p) => p.rawId)).toEqual(["Pal_Lamball"]);
  });

  it("excludes wild Pals (no OwnerPlayerUId)", async () => {
    const buf = buildSyntheticSave([
      { characterId: "Pal_Lamball", level: 1, passives: [], ownerGuidZero: true },
      { characterId: "Pal_Cattiva", level: 1, passives: [], ownerGuidZero: false },
    ]);
    const result = await parseSaveFile(buf);
    const owned = result.pals.filter((p) => p.isPlayerOwned).map((p) => p.rawId);
    expect(owned).toEqual(["Pal_Lamball"]);
  });
});

describe("parseSaveFile — error paths (errors as values, never throws)", () => {
  it("returns a fatal BAD_MAGIC error for non-Palworld input", async () => {
    const result = await parseSaveFile(new TextEncoder().encode("hello world").buffer);
    expect(result.errors.some((e) => e.code === "BAD_MAGIC" && e.fatal)).toBe(true);
    expect(result.pals).toEqual([]);
  });

  it("returns TOO_SHORT for a stub buffer", async () => {
    const result = await parseSaveFile(new Uint8Array([1, 2, 3]).buffer);
    expect(result.errors.some((e) => e.code === "TOO_SHORT")).toBe(true);
  });

  it("never throws on random binary input (fuzz)", async () => {
    const seedRng = mulberry32(0xc0ffee);
    for (let trial = 0; trial < 100; trial++) {
      const size = Math.floor(seedRng() * 4096) + 1;
      const buf = new Uint8Array(size);
      for (let i = 0; i < size; i++) buf[i] = Math.floor(seedRng() * 256);
      // Don't await all in parallel — keep memory bounded.
      // The contract: parseSaveFile resolves with a ParseResult, never rejects.
      // If anything throws, this test fails.
      // eslint-disable-next-line no-await-in-loop
      const r = await parseSaveFile(buf.buffer);
      expect(Array.isArray(r.pals)).toBe(true);
      expect(Array.isArray(r.errors)).toBe(true);
    }
  });

  it("never throws when the PlZ header is intact but payload is junk (decompression fuzz)", async () => {
    const rng = mulberry32(42);
    for (let trial = 0; trial < 50; trial++) {
      const payloadSize = Math.floor(rng() * 1024) + 1;
      const compressedJunk = new Uint8Array(payloadSize);
      for (let i = 0; i < payloadSize; i++) compressedJunk[i] = Math.floor(rng() * 256);
      const wrapped = new Uint8Array(12 + payloadSize);
      const dv = new DataView(wrapped.buffer);
      dv.setUint32(0, 1024, true);
      dv.setUint32(4, payloadSize, true);
      wrapped[8] = 0x50;
      wrapped[9] = 0x4c;
      wrapped[10] = 0x5a;
      wrapped[11] = 0;
      wrapped.set(compressedJunk, 12);
      // eslint-disable-next-line no-await-in-loop
      const r = await parseSaveFile(wrapped.buffer);
      expect(r.errors.length).toBeGreaterThan(0);
      expect(r.errors.some((e) => e.code === "ZLIB_FAILED" || e.code === "GVAS_PARSE_FAILED")).toBe(true);
    }
  });
});

describe("parseSaveFile — diagnostics", () => {
  it("exposes saveVersion and detectedGameVersion strings", async () => {
    const buf = buildSyntheticSave([
      { characterId: "Pal_Lamball", level: 1, passives: [] },
    ]);
    const result = await parseSaveFile(buf);
    expect(result.saveVersion).toMatch(/^gvas v/);
    expect(result.detectedGameVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("emits progress events for each phase", async () => {
    const buf = buildSyntheticSave([
      { characterId: "Pal_Lamball", level: 1, passives: [] },
    ]);
    const phases: string[] = [];
    await parseSaveFile(buf, {
      onProgress: (p) => phases.push(p.phase),
    });
    expect(phases).toContain("decompress");
    expect(phases).toContain("parse");
    expect(phases).toContain("extract");
  });
});

/* -------------------------------------------------------------------------- */
/*  Tiny deterministic RNG so fuzz tests never flake.                         */
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
