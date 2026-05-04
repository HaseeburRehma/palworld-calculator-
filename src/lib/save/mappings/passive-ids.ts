/**
 * Game-internal passive id → our `PassiveSkill.id` mapping.
 *
 * Palworld serializes passives by their internal id (e.g. `PAL_ALL_ATK_up1`,
 * `Trait_Lucky`). The mapping below covers the common positives + a placeholder
 * for negatives. Anything missing comes through as an unmapped diagnostic so
 * the user can flag it for an update.
 *
 * UPDATING: see ./README.md.
 */

export const PASSIVE_ID_MAP: Readonly<Record<string, string>> = Object.freeze({
  // Positive — community-stable internal names.
  Trait_Lucky: "lucky",
  Trait_Swift: "swift",
  Trait_Ferocious: "ferocious",
  Trait_Musclehead: "musclehead",
  Trait_Brave: "brave",
  Trait_Noble: "noble",
  Trait_Artisan: "artisan",
  Trait_DaintyEater: "dainty-eater",
  Trait_Aggressive: "aggressive",
  Trait_MineForeman: "mine-foreman",

  // Stat-tier conventions used in some save versions:
  //   PAL_ALL_ATK_up1 = +Attack rank 1, etc.
  //   These are placeholder mappings — verify against your data/passives.json
  //   ids before relying on them.
  PAL_ALL_ATK_up1: "ferocious",
  PAL_ALL_DEF_up1: "musclehead",
  PAL_ALL_MOVESPEED_up1: "swift",
});

export function mapRawPassiveIdToPassiveId(rawId: string): string | null {
  if (!rawId) return null;
  const direct = PASSIVE_ID_MAP[rawId];
  if (direct) return direct;
  const target = rawId.toLowerCase();
  for (const [k, v] of Object.entries(PASSIVE_ID_MAP)) {
    if (k.toLowerCase() === target) return v;
  }
  return null;
}
