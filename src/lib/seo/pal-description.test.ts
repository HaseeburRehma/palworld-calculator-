import { describe, expect, it } from "vitest";
import { allPals } from "@/lib/data/pals";
import { generatePalDescription, getDescriptionFor } from "./pal-description";

const wordCount = (s: string) => s.trim().split(/\s+/).length;

describe("generatePalDescription", () => {
  it("returns ≥ 80 words for every Pal in the bundled data", () => {
    for (const pal of allPals) {
      const desc = generatePalDescription(pal);
      const wc = wordCount(desc);
      expect(wc, `Pal ${pal.id} got ${wc} words: "${desc}"`).toBeGreaterThanOrEqual(80);
    }
  });

  it("is deterministic — same Pal always yields the same paragraph", () => {
    for (const pal of allPals) {
      expect(generatePalDescription(pal)).toBe(generatePalDescription(pal));
    }
  });

  it("produces structurally distinct paragraphs across the corpus", () => {
    // The same opener for every Pal would mean the templates collapsed.
    const openers = new Set(
      allPals.map((p) => generatePalDescription(p).split(/[.!?]\s/)[0]),
    );
    expect(openers.size).toBeGreaterThan(Math.min(allPals.length, 3));
  });

  it("variant Pals reference their base form's name", () => {
    const variant = allPals.find((p) => p.slug === "mau-cryst");
    if (!variant) return; // fixture-dependent
    const desc = generatePalDescription(variant);
    expect(desc.toLowerCase()).toMatch(/\bmau\b/);
  });
});

describe("getDescriptionFor", () => {
  it("falls through to the generator when no override exists", () => {
    const pal = allPals[0]!;
    expect(getDescriptionFor(pal)).toBe(generatePalDescription(pal));
  });
});
