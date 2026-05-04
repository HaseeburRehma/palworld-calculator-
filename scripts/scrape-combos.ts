/**
 * Entry point: scrape special breeding combos from the configured source and
 * write `data/combos.json`.
 *
 * Phase 1: skeleton — same approach as scrape-pals.ts.
 *
 * Usage:
 *   PAL_DATA_SOURCE=https://example.com pnpm scrape:combos
 */

import { writeFile } from "node:fs/promises";
import path from "node:path";

import type { BreedingCombo } from "@/types/pal";
import { getDataSourceBaseUrl, politeFetchText } from "./lib/fetcher";
import { parseCombos } from "./lib/parsers";

const OUTPUT = path.resolve(process.cwd(), "data/combos.json");

async function main(): Promise<void> {
  const base = getDataSourceBaseUrl();
  console.log(`[scrape-combos] source: ${base}`);

  // TODO(phase-1-scraper): adjust the path for the chosen source.
  const html = await politeFetchText(`${base}/breeding`);
  const combos: BreedingCombo[] = parseCombos(html);

  if (combos.length === 0) {
    console.warn("[scrape-combos] no combos parsed — writing empty array");
  }

  // Sort for deterministic diffs.
  combos.sort((a, b) => {
    const ka = `${a.parentA}|${a.parentB}`;
    const kb = `${b.parentA}|${b.parentB}`;
    return ka.localeCompare(kb);
  });

  await writeFile(OUTPUT, JSON.stringify(combos, null, 2) + "\n", "utf8");
  console.log(`[scrape-combos] wrote ${combos.length} combos to ${OUTPUT}`);
}

main().catch((err) => {
  console.error("[scrape-combos] FAILED:", err);
  process.exit(1);
});
