import type { BreedingCombo, Pal } from "@/types/pal";

/**
 * Context passed to the breeding engine. The engine is pure: it never reads
 * from disk or the network — callers supply the Pal/combo tables explicitly.
 *
 * This is what lets the same engine run in:
 *   - the Next.js client bundle (Phase 1 calculator),
 *   - server routes (future API),
 *   - Web Workers (future multi-gen pathfinding),
 *   - unit tests (with hand-built fixtures).
 */
export interface BreedingContext {
  pals: Pal[];
  combos: BreedingCombo[];
}

/** Result of a breeding lookup. `source` makes the path traceable for the UI. */
export interface BreedingResult {
  child: Pal;
  source: "special-combo" | "power-value";
}
