/**
 * Tiny breeding graph for pathfinder tests.
 *
 * Species (paldex order):
 *   1. ant     (Neutral)        — leaf
 *   2. bat     (Neutral)        — leaf
 *   3. cow     (Fire)           — ant + bat
 *   4. dog     (Water)          — ant + cow
 *   5. elf     (Grass)          — bat + cow
 *   6. fox     (Electric)       — dog + elf
 *   7. ghost   (Dark)           — cow + elf, dog + elf, OR cow + fox
 *   8. hawk    (Ice, breed-only) — dog + ghost
 *
 * Distances from owned = {ant, bat} (cumulative breedings, AND-OR shortest):
 *   ant=0, bat=0, cow=1, dog=2, elf=2, fox=5, ghost=4, hawk=7
 *
 * Why fox=5? fox = dog + elf + 1 = 2 + 2 + 1.  Why ghost=4? cow + elf + 1 = 1 + 2 + 1.
 * hawk=7 is just past the 6-step depth cap → unreachable in our budget. That
 * shape lets the tests cover both reachable-deep and out-of-budget cases.
 */

import type { BreedingCombo, Pal, PassiveSkill } from "@/types/pal";
import type { ParentPair } from "@/lib/data/reverse-index";

export const fxPals: Pal[] = [
  pal("ant", 1, "Ant", ["Neutral"], 10),
  pal("bat", 2, "Bat", ["Neutral"], 30),
  pal("cow", 3, "Cow", ["Fire"], 50),
  pal("dog", 4, "Dog", ["Water"], 70),
  pal("elf", 5, "Elf", ["Grass"], 90),
  pal("fox", 6, "Fox", ["Electric"], 110),
  pal("ghost", 7, "Ghost", ["Dark"], 140),
  { ...pal("hawk", 8, "Hawk", ["Ice"], 200), breedOnly: true },
  // An unrelated species nobody can breed into anything used here. Validates
  // that the search ignores irrelevant nodes.
  pal("imp", 9, "Imp", ["Dragon"], 300),
];

export const fxCombos: BreedingCombo[] = [];

/** Reverse index — keyed `child → [{parentA, parentB}, ...]`. */
export const fxReverseIndex: ReadonlyMap<string, ReadonlyArray<ParentPair>> = new Map([
  ["cow", [{ parentA: "ant", parentB: "bat" }]],
  ["dog", [{ parentA: "ant", parentB: "cow" }]],
  ["elf", [{ parentA: "bat", parentB: "cow" }]],
  ["fox", [{ parentA: "dog", parentB: "elf" }]],
  // Three ways to make ghost — exercises the top-K branch and tie-breaking.
  // Cumulative depths from {ant,bat}:
  //   cow + elf  = 1 + 2 + 1 = 4   (best)
  //   dog + elf  = 2 + 2 + 1 = 5
  //   cow + fox  = 1 + 5 + 1 = 7   (over depth cap → filtered out)
  [
    "ghost",
    [
      { parentA: "cow", parentB: "elf" },
      { parentA: "cow", parentB: "fox" },
      { parentA: "dog", parentB: "elf" },
    ],
  ],
  ["hawk", [{ parentA: "dog", parentB: "ghost" }]],
]);

export const fxPassives: PassiveSkill[] = [
  passive("lucky", "Lucky"),
  passive("swift", "Swift"),
  passive("ferocious", "Ferocious"),
  passive("musclehead", "Musclehead"),
  passive("brave", "Brave"),
  passive("noble", "Noble"),
  passive("artisan", "Artisan"),
  passive("dainty-eater", "Dainty Eater"),
  passive("aggressive", "Aggressive"),
  passive("mine-foreman", "Mine Foreman"),
];

function pal(
  id: string,
  paldexNo: number,
  name: string,
  elements: Pal["elements"],
  powerValue: number,
): Pal {
  return { id, paldexNo, name, slug: id, elements, powerValue, breedable: true };
}

function passive(id: string, name: string): PassiveSkill {
  return { id, name, tier: "positive", rank: 1, effect: name };
}
