/**
 * Resolve a list of game-internal passive ids into our `PassiveSkill.id`s.
 *
 * Returns the mapped ids plus the unmapped raw ids so the parser can surface
 * them in the diagnostics panel. Capped at 4 mapped ids to match the in-game
 * limit.
 */

import { mapRawPassiveIdToPassiveId } from "../mappings/passive-ids";

export interface ResolvedPassives {
  mapped: string[];
  unmapped: string[];
}

export function resolvePassives(rawIds: ReadonlyArray<string>): ResolvedPassives {
  const mapped: string[] = [];
  const unmapped: string[] = [];
  const seen = new Set<string>();
  for (const raw of rawIds) {
    const id = mapRawPassiveIdToPassiveId(raw);
    if (id === null) {
      unmapped.push(raw);
      continue;
    }
    if (seen.has(id)) continue;
    seen.add(id);
    mapped.push(id);
    if (mapped.length === 4) break;
  }
  return { mapped, unmapped };
}
