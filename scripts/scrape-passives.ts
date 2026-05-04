/**
 * Entry point: scrape the master Palworld passive list and write
 * `data/passives.json`.
 *
 * Phase 2 status: skeleton — the source-specific parser is stubbed in
 * `scripts/lib/parsers.ts`. The hand-curated `data/passives.json` is what
 * ships until you wire up a real source.
 *
 * Note: Passives in Palworld are mostly per-instance random rolls, not fixed
 * to specific Pals. So this scrapes the global passive *catalog* — names,
 * tiers, ranks, effects — not per-Pal data.
 *
 * Usage:
 *   PAL_DATA_SOURCE=https://example.com pnpm scrape:passives
 */

import { writeFile } from "node:fs/promises";
import path from "node:path";

import { isPassiveSkill, type PassiveSkill } from "@/types/pal";
import { getDataSourceBaseUrl, politeFetchText } from "./lib/fetcher";
import { parsePassives } from "./lib/parsers";

const OUTPUT = path.resolve(process.cwd(), "data/passives.json");

async function main(): Promise<void> {
  const base = getDataSourceBaseUrl();
  console.log(`[scrape-passives] source: ${base}`);

  // TODO(phase-2-scraper): adjust the path for the chosen source.
  const html = await politeFetchText(`${base}/passives`);
  const passives: PassiveSkill[] = parsePassives(html);

  // Validate every entry — better to fail loud than silently ship garbage.
  for (let i = 0; i < passives.length; i++) {
    if (!isPassiveSkill(passives[i])) {
      throw new Error(`[scrape-passives] entry ${i} is not a PassiveSkill`);
    }
  }
  if (passives.length === 0) {
    console.warn("[scrape-passives] no passives parsed — writing empty array");
  }

  passives.sort((a, b) => a.name.localeCompare(b.name));

  await writeFile(OUTPUT, JSON.stringify(passives, null, 2) + "\n", "utf8");
  console.log(`[scrape-passives] wrote ${passives.length} passives to ${OUTPUT}`);
}

main().catch((err) => {
  console.error("[scrape-passives] FAILED:", err);
  process.exit(1);
});
