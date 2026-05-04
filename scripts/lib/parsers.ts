/**
 * Source-specific parsing logic for the scraper.
 *
 * Phase 1 status: STUBBED.
 *
 * Once a single source is picked (see data/README.md), implement these
 * functions against that source's HTML/JSON. Until then they throw helpful
 * errors so `pnpm scrape` runs end-to-end without producing garbage data.
 *
 * Design notes:
 *   - Keep parsing pure: take a string in, return typed records out.
 *   - Do NOT call `politeFetchText` from here — fetchers and parsers are
 *     orthogonal so we can unit-test parsers against fixture HTML files.
 *   - When you implement these, add fixture HTML/JSON snippets under
 *     tests/fixtures/scraper/ and write parser unit tests.
 */

import type { BreedingCombo, Pal, PassiveSkill } from "@/types/pal";

/* -------------------------------------------------------------------------- */
/*  Index parsing — finds the list of Pals to deep-fetch                      */
/* -------------------------------------------------------------------------- */

/**
 * Parse the Pal index page and return slugs / detail-page URLs to follow.
 * TODO(phase-1-scraper): implement against chosen source.
 */
export function parsePalIndex(_html: string, _baseUrl: string): string[] {
  throw new Error(
    "parsePalIndex is not implemented. Pick a data source, then implement " +
      "this against its index page format. See data/README.md.",
  );
}

/* -------------------------------------------------------------------------- */
/*  Detail parsing — turns one Pal page into a Pal record                     */
/* -------------------------------------------------------------------------- */

/**
 * Parse a single Pal detail page into a `Pal` record.
 * TODO(phase-1-scraper): implement against chosen source.
 */
export function parsePalDetail(_html: string, _detailUrl: string): Pal {
  throw new Error(
    "parsePalDetail is not implemented. Pick a data source, then implement " +
      "this against its Pal-detail page format. See data/README.md.",
  );
}

/* -------------------------------------------------------------------------- */
/*  Combo parsing                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Parse the special-breeding-combos page into BreedingCombo records.
 * TODO(phase-1-scraper): implement against chosen source.
 */
export function parseCombos(_html: string): BreedingCombo[] {
  throw new Error(
    "parseCombos is not implemented. Pick a data source, then implement this " +
      "against its breeding-combos page format. See data/README.md.",
  );
}

/* -------------------------------------------------------------------------- */
/*  Passive-list parsing                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Parse the global passive-skill catalog into PassiveSkill records.
 * TODO(phase-2-scraper): implement against chosen source.
 */
export function parsePassives(_html: string): PassiveSkill[] {
  throw new Error(
    "parsePassives is not implemented. Pick a data source, then implement this " +
      "against its passive-list page format. See data/README.md.",
  );
}
