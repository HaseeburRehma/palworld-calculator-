/**
 * Bundled master list of Palworld passive skills.
 *
 * Most Pals don't have *fixed* passives in their data — passives are mostly
 * random per-instance. This master list exists so the UI can autocomplete,
 * tier-color, and describe passives, and so the inheritance math knows the
 * total population size when computing wild-passive probabilities.
 */

import passivesJson from "@data/passives.json";
import { isPassiveSkill, type PassiveSkill } from "@/types/pal";

const raw = passivesJson as unknown;
if (!Array.isArray(raw)) {
  throw new Error("data/passives.json is not an array");
}

const passives: PassiveSkill[] = raw.map((p, i) => {
  if (!isPassiveSkill(p)) {
    throw new Error(`data/passives.json[${i}] is not a PassiveSkill`);
  }
  return p;
});

const seen = new Set<string>();
for (const p of passives) {
  if (seen.has(p.id)) throw new Error(`Duplicate passive id: ${p.id}`);
  seen.add(p.id);
}

export const allPassives: ReadonlyArray<PassiveSkill> = Object.freeze(
  [...passives].sort((a, b) => a.name.localeCompare(b.name)),
);

export function getPassiveById(id: string): PassiveSkill | undefined {
  return allPassives.find((p) => p.id === id);
}

/** Count of passives in the master list — used by the wild-passive math. */
export const totalPassiveCount = allPassives.length;
