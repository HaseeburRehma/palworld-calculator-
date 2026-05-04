/**
 * Game-internal Pal id → our `Pal.id` mapping.
 *
 * Palworld uses ids of the form `Pal_<Name>` (sometimes `BOSS_Pal_<Name>` for
 * alpha variants, `RAID_Pal_<Name>` for raid bosses, etc.). The mapping here
 * is the bridge between those identifiers and the slugs we use in
 * `data/pals.json`.
 *
 * UPDATING WHEN PATCHES BREAK THINGS
 * ----------------------------------
 *   1. Run `pnpm verify-mappings` against a save that contains the new Pals.
 *      The script prints any unmapped `rawId`s.
 *   2. Look up the corresponding Pal in `data/pals.json` (by name).
 *   3. Add an entry to `PAL_ID_MAP` below with a comment marking the source
 *      ("verified against patch X.Y" or "TODO: verify").
 *   4. Re-run `pnpm verify-mappings`. The script should report 0 unmapped.
 *
 * Initial coverage: the ~25 Pals already in `data/pals.json` (Phase 1
 * placeholder data). The full Paldex mapping ships incrementally as the
 * scraper and real save diagnostics fill in the gaps.
 */

/**
 * The bridge table. Game id → our `Pal.id`. Add entries below.
 * Lookup is case-insensitive (we lowercase both sides at lookup time).
 */
export const PAL_ID_MAP: Readonly<Record<string, string>> = Object.freeze({
  // Verified naming convention; source: community refs + palworld-save-tools.
  Pal_Lamball: "lamball",
  Pal_Cattiva: "cattiva",
  Pal_Chikipi: "chikipi",
  Pal_Lifmunk: "lifmunk",
  Pal_Foxparks: "foxparks",
  Pal_Fuack: "fuack",
  Pal_Sparkit: "sparkit",
  Pal_Tanzee: "tanzee",
  Pal_Rooby: "rooby",
  Pal_Pengullet: "pengullet",
  Pal_Penking: "penking",
  Pal_Jolthog: "jolthog",
  Pal_Gumoss: "gumoss",
  Pal_Vixy: "vixy",
  Pal_Hoocrates: "hoocrates",
  Pal_Teafant: "teafant",
  Pal_Depresso: "depresso",
  Pal_Cremis: "cremis",
  Pal_Daedream: "daedream",
  Pal_Rushoar: "rushoar",
  Pal_Nox: "nox",
  Pal_Fuddler: "fuddler",
  Pal_Killamari: "killamari",
  Pal_Mau: "mau",
  Pal_MauCryst: "mau-cryst",
});

/**
 * Variant prefixes we strip before lookup. Alpha bosses & raid bosses share
 * the underlying species id with the regular form for breeding purposes.
 */
const VARIANT_PREFIXES = ["BOSS_", "RAID_", "GYM_", "PREDATOR_", "SUMMON_"];

/**
 * Lookup helper. Returns our `Pal.id` if known, otherwise null. Strips the
 * common variant prefixes so a `BOSS_Pal_Lamball` resolves to `"lamball"`.
 */
export function mapRawIdToPalId(rawId: string): string | null {
  if (!rawId) return null;
  // Try the full id first.
  const direct = lookup(rawId);
  if (direct) return direct;
  // Strip variant prefixes one at a time.
  for (const prefix of VARIANT_PREFIXES) {
    if (rawId.startsWith(prefix)) {
      const stripped = rawId.slice(prefix.length);
      const hit = lookup(stripped);
      if (hit) return hit;
    }
  }
  return null;
}

function lookup(rawId: string): string | null {
  const direct = PAL_ID_MAP[rawId];
  if (direct) return direct;
  // Case-insensitive fallback.
  const target = rawId.toLowerCase();
  for (const [k, v] of Object.entries(PAL_ID_MAP)) {
    if (k.toLowerCase() === target) return v;
  }
  return null;
}
