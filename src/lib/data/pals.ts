/**
 * Bundled Pal data.
 *
 * The JSON file under `data/pals.json` is committed to the repo and imported
 * statically here so it ends up in the client bundle. The app must NEVER fetch
 * Pal data at runtime — that's a build-time concern handled by the scraper.
 */

import palsJson from "@data/pals.json";
import { isPal, type Pal } from "@/types/pal";

const raw = palsJson as unknown;

if (!Array.isArray(raw)) {
  throw new Error("data/pals.json is not an array");
}

const pals: Pal[] = raw.map((p, i) => {
  if (!isPal(p)) {
    throw new Error(`data/pals.json[${i}] does not match the Pal shape`);
  }
  return p;
});

// Ensure ids are unique. Catches scraper bugs early.
const seen = new Set<string>();
for (const p of pals) {
  if (seen.has(p.id)) throw new Error(`Duplicate Pal id in data: ${p.id}`);
  seen.add(p.id);
}

export const allPals: ReadonlyArray<Pal> = Object.freeze(
  [...pals].sort((a, b) => a.paldexNo - b.paldexNo),
);

export function getPalById(id: string): Pal | undefined {
  return allPals.find((p) => p.id === id);
}

export function getPalBySlug(slug: string): Pal | undefined {
  return allPals.find((p) => p.slug === slug);
}
