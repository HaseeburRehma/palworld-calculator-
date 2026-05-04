import { describe, expect, it } from "vitest";
import { mergeImport } from "./merge";
import { addPal, emptyRoster } from "./store";
import type { ParsedPal } from "@/lib/save";

const NOW = new Date("2026-05-04T12:00:00.000Z");

const parsed = (
  rawId: string,
  palId: string | null,
  passives: string[] = [],
  isPlayerOwned = true,
): ParsedPal => ({
  rawId,
  palId,
  passives,
  unmappedPassiveCount: 0,
  level: 1,
  isPlayerOwned,
});

describe("mergeImport — replace mode", () => {
  it("clears existing pals and writes only mapped imports", () => {
    const start = addPal(emptyRoster(NOW), { palId: "anubis", passives: ["lucky"] }, NOW);
    const result = mergeImport(
      start,
      [parsed("Pal_Lamball", "lamball"), parsed("Pal_Mystery", null)],
      { mode: "replace", now: NOW },
    );
    expect(result.roster.pals).toHaveLength(1);
    expect(result.roster.pals[0]!.palId).toBe("lamball");
    expect(result.stats.added).toBe(1);
    expect(result.stats.skippedUnmapped).toBe(1);
  });

  it("excludes wild Pals (isPlayerOwned=false)", () => {
    const result = mergeImport(
      emptyRoster(NOW),
      [parsed("Pal_Lamball", "lamball", [], false)],
      { mode: "replace", now: NOW },
    );
    expect(result.roster.pals).toHaveLength(0);
  });
});

describe("mergeImport — append mode", () => {
  it("adds incoming on top of existing without dedup", () => {
    const start = addPal(emptyRoster(NOW), { palId: "lamball" }, NOW);
    const result = mergeImport(
      start,
      [parsed("Pal_Lamball", "lamball"), parsed("Pal_Cattiva", "cattiva")],
      { mode: "append", now: NOW },
    );
    expect(result.roster.pals.map((p) => p.palId)).toEqual(["lamball", "lamball", "cattiva"]);
    expect(result.stats.added).toBe(2);
  });
});

describe("mergeImport — smart mode", () => {
  it("skips exact (rawId, passives) duplicates from a re-import", () => {
    // First import — lamball with lucky.
    const after1 = mergeImport(
      emptyRoster(NOW),
      [parsed("Pal_Lamball", "lamball", ["lucky"])],
      { mode: "smart", now: NOW },
    );
    expect(after1.stats.added).toBe(1);

    // Second import — same Pal again. Should skip.
    const after2 = mergeImport(
      after1.roster,
      [
        parsed("Pal_Lamball", "lamball", ["lucky"]),
        parsed("Pal_Cattiva", "cattiva"),
      ],
      { mode: "smart", now: NOW },
    );
    expect(after2.stats.added).toBe(1);
    expect(after2.stats.skippedDuplicates).toBe(1);
    expect(after2.roster.pals.map((p) => p.palId)).toEqual(["lamball", "cattiva"]);
  });

  it("treats different passives as different instances", () => {
    const after1 = mergeImport(
      emptyRoster(NOW),
      [parsed("Pal_Lamball", "lamball", ["lucky"])],
      { mode: "smart", now: NOW },
    );
    const after2 = mergeImport(
      after1.roster,
      [parsed("Pal_Lamball", "lamball", ["swift"])],
      { mode: "smart", now: NOW },
    );
    expect(after2.stats.added).toBe(1);
    expect(after2.roster.pals).toHaveLength(2);
  });

  it("keeps existing manual Pals not present in the import (no data loss)", () => {
    const start = addPal(emptyRoster(NOW), { palId: "anubis", passives: ["lucky"] }, NOW);
    // anubis is a hand-entered Pal (no rawId). After import of Lamball:
    const result = mergeImport(
      start,
      [parsed("Pal_Lamball", "lamball")],
      { mode: "smart", now: NOW },
    );
    expect(result.roster.pals).toHaveLength(2);
    expect(result.stats.keptNotInImport).toBe(1);
  });

  it("respects selectedRawIds when filtering imports", () => {
    const result = mergeImport(
      emptyRoster(NOW),
      [
        parsed("Pal_Lamball", "lamball"),
        parsed("Pal_Cattiva", "cattiva"),
        parsed("Pal_Foxparks", "foxparks"),
      ],
      {
        mode: "smart",
        now: NOW,
        selectedRawIds: new Set(["Pal_Lamball", "Pal_Foxparks"]),
      },
    );
    expect(result.roster.pals.map((p) => p.palId)).toEqual(["lamball", "foxparks"]);
  });
});

describe("mergeImport — output shape", () => {
  it("annotates imports with source='import' and importedAt", () => {
    const result = mergeImport(
      emptyRoster(NOW),
      [parsed("Pal_Lamball", "lamball")],
      { mode: "smart", now: NOW },
    );
    const p = result.roster.pals[0]!;
    expect(p.source).toBe("import");
    expect(p.importedAt).toBe(NOW.toISOString());
    expect(p.rawId).toBe("Pal_Lamball");
  });

  it("updates roster.updatedAt to the merge time", () => {
    const earlier = new Date("2026-01-01T00:00:00.000Z");
    const start = emptyRoster(earlier);
    const result = mergeImport(
      start,
      [parsed("Pal_Lamball", "lamball")],
      { mode: "smart", now: NOW },
    );
    expect(result.roster.updatedAt).toBe(NOW.toISOString());
  });
});
