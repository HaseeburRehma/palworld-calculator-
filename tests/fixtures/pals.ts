/**
 * Hand-built Pal fixtures for unit tests.
 *
 * These are NOT the real game numbers. They're designed to give the engine
 * tests known, predictable answers — small integer powerValues spaced so that
 * the closest-match logic is unambiguous.
 *
 * If you change a number here, expect engine tests to break.
 */

import type { BreedingCombo, Pal } from "@/types/pal";

export const fixturePals: Pal[] = [
  {
    id: "alpha",
    paldexNo: 1,
    name: "Alpha",
    slug: "alpha",
    elements: ["Neutral"],
    powerValue: 10,
    breedable: true,
  },
  {
    id: "bravo",
    paldexNo: 2,
    name: "Bravo",
    slug: "bravo",
    elements: ["Fire"],
    powerValue: 30,
    breedable: true,
  },
  {
    id: "charlie",
    paldexNo: 3,
    name: "Charlie",
    slug: "charlie",
    elements: ["Water"],
    powerValue: 50,
    breedable: true,
  },
  {
    id: "delta",
    paldexNo: 4,
    name: "Delta",
    slug: "delta",
    elements: ["Grass"],
    powerValue: 70,
    breedable: true,
  },
  {
    id: "echo",
    paldexNo: 5,
    name: "Echo",
    slug: "echo",
    elements: ["Electric"],
    powerValue: 90,
    breedable: true,
  },
  {
    id: "foxtrot",
    paldexNo: 6,
    name: "Foxtrot",
    slug: "foxtrot",
    elements: ["Ice"],
    powerValue: 110,
    breedable: true,
  },
  // Two Pals with identical powerValue — tie-breaker territory.
  // Lower paldexNo (golf) should win.
  {
    id: "golf",
    paldexNo: 7,
    name: "Golf",
    slug: "golf",
    elements: ["Ground"],
    powerValue: 40,
    breedable: true,
  },
  {
    id: "hotel",
    paldexNo: 8,
    name: "Hotel",
    slug: "hotel",
    elements: ["Dark"],
    powerValue: 40,
    breedable: true,
  },
  // A non-breedable variant — must NEVER be picked as a breeding outcome.
  {
    id: "india-variant",
    paldexNo: 9,
    name: "India Variant",
    slug: "india-variant",
    elements: ["Dragon"],
    powerValue: 20, // numerically attractive — proves filtering works
    breedable: false,
  },
  // A special-combo-only Pal (must exist in the table to be returnable).
  {
    id: "juliet",
    paldexNo: 10,
    name: "Juliet",
    slug: "juliet",
    elements: ["Dragon"],
    powerValue: 200,
    breedable: false,
  },
];

export const fixtureCombos: BreedingCombo[] = [
  // alpha + bravo = juliet (overrides any power-value math)
  { parentA: "alpha", parentB: "bravo", child: "juliet" },
];
