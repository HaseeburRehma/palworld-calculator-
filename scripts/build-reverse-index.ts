/**
 * Build the reverse breeding index.
 *
 * Iterates every unordered pair of Pals (including same-species pairs),
 * calls the canonical `breed()` function from the engine, and emits
 * `data/reverse-index.json` mapping `childId → Array<{ parentA, parentB }>`.
 *
 * Run order:   pnpm scrape:pals → pnpm scrape:combos → pnpm scrape:passives
 *              → pnpm build:reverse-index
 * (`pnpm scrape` runs all four in sequence.)
 *
 * The engine is the single source of truth — this script must NEVER reimplement
 * breeding math. The round-trip test in `engine.test.ts` would catch drift.
 */

import { writeFile } from "node:fs/promises";
import path from "node:path";

import { breed } from "@/lib/breeding/engine";
import { allCombos } from "@/lib/data/combos";
import { allPals } from "@/lib/data/pals";
import type { ParentPair } from "@/lib/data/reverse-index";

const OUTPUT = path.resolve(process.cwd(), "data/reverse-index.json");

async function main(): Promise<void> {
  const pals = [...allPals];
  const combos = [...allCombos];
  const ctx = { pals, combos };

  const index: Record<string, ParentPair[]> = {};
  let pairCount = 0;

  for (let i = 0; i < pals.length; i++) {
    for (let j = i; j < pals.length; j++) {
      const a = pals[i]!;
      const b = pals[j]!;
      let child;
      try {
        child = breed(a, b, ctx);
      } catch (err) {
        console.warn(`[build-reverse-index] skipping ${a.id} × ${b.id}:`, err);
        continue;
      }

      // Canonicalize parent order: lower paldexNo first. Makes the JSON stable
      // and means UI doesn't need to deduplicate (a, b) vs (b, a).
      const [parentA, parentB] =
        a.paldexNo <= b.paldexNo ? [a.id, b.id] : [b.id, a.id];

      const list = index[child.id] ?? (index[child.id] = []);
      list.push({ parentA, parentB });
      pairCount++;
    }
  }

  // Deterministic ordering inside each child's list.
  for (const childId of Object.keys(index)) {
    index[childId]!.sort((x, y) =>
      `${x.parentA}|${x.parentB}`.localeCompare(`${y.parentA}|${y.parentB}`),
    );
  }

  await writeFile(OUTPUT, JSON.stringify(index, null, 2) + "\n", "utf8");
  console.log(
    `[build-reverse-index] evaluated ${pairCount} pairs across ${pals.length} Pals`,
  );
  console.log(
    `[build-reverse-index] indexed ${Object.keys(index).length} children → ${OUTPUT}`,
  );
}

main().catch((err) => {
  console.error("[build-reverse-index] FAILED:", err);
  process.exit(1);
});
