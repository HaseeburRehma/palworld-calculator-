/**
 * Entry point: scrape Pal data from the configured source and write
 * `data/pals.json`.
 *
 * Phase 1: skeleton only. The fetcher and output writer are real; the
 * source-specific parser in `scripts/lib/parsers.ts` is stubbed.
 *
 * Usage:
 *   PAL_DATA_SOURCE=https://example.com pnpm scrape:pals
 */

import { writeFile } from "node:fs/promises";
import path from "node:path";

import { isPal, type Pal } from "@/types/pal";
import { getDataSourceBaseUrl, politeFetchText } from "./lib/fetcher";
import { parsePalDetail, parsePalIndex } from "./lib/parsers";

const OUTPUT = path.resolve(process.cwd(), "data/pals.json");

async function main(): Promise<void> {
  const base = getDataSourceBaseUrl();
  console.log(`[scrape-pals] source: ${base}`);

  // 1. Fetch the index page and extract per-Pal detail URLs.
  // TODO(phase-1-scraper): adjust the index path for the chosen source.
  const indexHtml = await politeFetchText(`${base}/pals`);
  const detailUrls = parsePalIndex(indexHtml, base);
  console.log(`[scrape-pals] discovered ${detailUrls.length} Pals`);

  // 2. Fetch each detail page (politely throttled by the fetcher) and parse.
  const pals: Pal[] = [];
  for (const url of detailUrls) {
    try {
      const html = await politeFetchText(url);
      const pal = parsePalDetail(html, url);
      if (!isPal(pal)) {
        console.warn(`[scrape-pals] parser returned a non-Pal record for ${url}`);
        continue;
      }
      pals.push(pal);
    } catch (err) {
      console.warn(`[scrape-pals] skipping ${url}:`, err);
    }
  }

  if (pals.length === 0) {
    throw new Error(
      "[scrape-pals] No Pals parsed. Check parsers.ts is implemented for the " +
        "chosen source.",
    );
  }

  // 3. Sort by paldexNo for deterministic output (better diffs).
  pals.sort((a, b) => a.paldexNo - b.paldexNo);

  // 4. Write the normalized output.
  await writeFile(OUTPUT, JSON.stringify(pals, null, 2) + "\n", "utf8");
  console.log(`[scrape-pals] wrote ${pals.length} Pals to ${OUTPUT}`);
}

main().catch((err) => {
  console.error("[scrape-pals] FAILED:", err);
  process.exit(1);
});
