/**
 * Per-Pal narrative paragraph generator.
 *
 * Goal: a unique 80–150 word block of human-readable copy for every Pal that
 * Google won't dismiss as templated content. The bad pattern (substituting
 * nouns into the same sentence shape) is what kills programmatic SEO; we
 * avoid it by:
 *
 *   1. Categorizing each Pal by inferable structural facts (legendary,
 *      variant, breed-only, starter, …).
 *   2. Choosing a structurally different opener per category. A legendary's
 *      narrative reads differently from a starter's at the *paragraph shape*
 *      level, not just at the noun level.
 *   3. Within a category, deterministically picking 1-of-N templates from a
 *      hash of the Pal's id, so the same Pal always produces the same copy
 *      (build is reproducible) but neighbors don't read alike.
 *   4. Pulling on different fact slots based on what's notable about that
 *      specific Pal — primary element vs. dual element, power-value tier,
 *      breeding accessibility, variant relationship.
 *
 * All sentences are hand-written templates. The function is a pure compose-
 * facts step over `Pal` data; no fetching, no I/O.
 *
 * Override: a separate `data/pal-descriptions.json` lets you hand-write the
 * top 30 highest-traffic Pals over time. `getDescriptionFor(pal)` checks the
 * override first.
 */

import type { Element, Pal } from "@/types/pal";
import overrides from "@data/pal-descriptions.json";

/* -------------------------------------------------------------------------- */
/*  Category classifier                                                       */
/* -------------------------------------------------------------------------- */

type Category =
  | "legendary"
  | "variant"
  | "breed-only"
  | "starter"
  | "common-breeder"
  | "midgame"
  | "endgame";

interface PalFacts {
  pal: Pal;
  category: Category;
  variantSuffix?: string;
  primaryElement: Element;
  secondaryElement: Element | null;
  isDual: boolean;
  /** Power-value tier name shown in narratives. */
  powerTier: "low" | "modest" | "high" | "elite";
}

const VARIANT_SUFFIXES = [
  "cryst",
  "ignis",
  "noct",
  "aqua",
  "terra",
  "lux",
  "botan",
  "ryu",
  "primo",
  "gild",
] as const;

function classify(pal: Pal): PalFacts {
  const primaryElement = (pal.elements[0] ?? "Neutral") as Element;
  const secondaryElement = (pal.elements[1] ?? null) as Element | null;
  const isDual = pal.elements.length >= 2;

  const slugLower = pal.slug.toLowerCase();
  const variantSuffix = VARIANT_SUFFIXES.find((s) => slugLower.endsWith(`-${s}`));

  let category: Category;
  if (pal.powerValue >= 1900) {
    category = "legendary";
  } else if (variantSuffix) {
    category = "variant";
  } else if (pal.breedOnly) {
    category = "breed-only";
  } else if (pal.paldexNo <= 6 && pal.powerValue <= 1500) {
    // Earliest-in-Paldex commons that players meet first.
    category = "starter";
  } else if (pal.powerValue >= 1700) {
    category = "endgame";
  } else if (pal.powerValue >= 1600) {
    category = "midgame";
  } else {
    category = "common-breeder";
  }

  const powerTier: PalFacts["powerTier"] =
    pal.powerValue >= 1900
      ? "elite"
      : pal.powerValue >= 1700
        ? "high"
        : pal.powerValue >= 1500
          ? "modest"
          : "low";

  return { pal, category, variantSuffix, primaryElement, secondaryElement, isDual, powerTier };
}

/* -------------------------------------------------------------------------- */
/*  Sentence templates per category                                           */
/* -------------------------------------------------------------------------- */
/*  Each template returns an *array* of complete sentences. The generator     */
/*  joins them into a paragraph. Different templates within a category have   */
/*  different sentence counts, lead with different facts, and end on          */
/*  different angles — the goal is paragraph-shape variation.                 */
/* -------------------------------------------------------------------------- */

type Template = (f: PalFacts) => string[];

const STARTER_TEMPLATES: Template[] = [
  (f) => [
    `${f.pal.name} is one of the first Pals most players meet — a ${formatElement(f.primaryElement)}-typed creature you'll encounter in the early biomes around the spawn region.`,
    `Its low power value of ${f.pal.powerValue} makes ${f.pal.name} a flexible breeding parent in the early game; pair it with another low-power Pal and the resulting child will land somewhere predictable on the curve.`,
    `Players also tend to keep a ${f.pal.name} or two on hand for utility: it's catchable in volume, costs little to feed, and slots into early base assignments without much fuss.`,
  ],
  (f) => [
    `Encountered early in the Paldex (#${String(f.pal.paldexNo).padStart(3, "0")}), ${f.pal.name} is a ${formatElement(f.primaryElement)} type that anchors a lot of starting-area breeding chains.`,
    `Its modest combat profile belies its real value, which is as a cheap, dependable parent for power-value math: ${f.pal.powerValue} is comfortably in the range that breeds into many mid-tier targets.`,
    `Once you have a few Pals in the roster, ${f.pal.name} reliably appears on the parent side of plans rather than the target side — a sign it's earning its keep.`,
    `If you're early in a save and want a Pal that doesn't need much investment to be useful, ${f.pal.name} is a safe bet.`,
  ],
];

const COMMON_BREEDER_TEMPLATES: Template[] = [
  (f) => [
    `${f.pal.name} is a ${formatElements(f)} Pal whose breeding utility quietly outpaces its raw combat reputation.`,
    `With a power value of ${f.pal.powerValue}, it sits in the productive middle of the breeding ladder — useful as a parent for a wide range of targets without being so rare that you can't pick one up when needed.`,
    `${f.pal.breedable ? `Standard power-value breeding can also produce ${f.pal.name}, so you can replace one without needing a special combination — useful when you're stockpiling parents for passive-skill stacking.` : `${f.pal.name} can't be obtained through standard power-value breeding, so plan around the specific parent pair the special-combinations table calls for.`}`,
    `If you're working through a midgame breeding plan, expect to see ${f.pal.name} listed as a parent option more often than not.`,
  ],
  (f) => [
    `Sitting at Paldex #${String(f.pal.paldexNo).padStart(3, "0")}, ${f.pal.name} fills a niche role: a ${formatElement(f.primaryElement)} type that's neither rare enough to be a chase target nor common enough to ignore.`,
    `Its power value of ${f.pal.powerValue} is the practical reason most players engage with ${f.pal.name} — it's a reliable rung on the breeding ladder when you're climbing toward something pricier.`,
    f.isDual
      ? `The dual ${formatElement(f.primaryElement)}/${formatElement(f.secondaryElement!)} typing also widens the pool of children you can guide it into, which is unusual at this power-value tier.`
      : `Single-typed Pals like ${f.pal.name} are easier to slot into element-matched pairings, which makes the breeding math more predictable.`,
    `For most players, the question isn't whether to keep one — it's how many to breed before moving on.`,
  ],
];

const MIDGAME_TEMPLATES: Template[] = [
  (f) => [
    `${f.pal.name} is a midgame ${formatElements(f)} Pal that comes into its own once your roster has a few catches under its belt.`,
    `Its power value of ${f.pal.powerValue} is high enough to produce useful endgame children when paired with another mid-tier parent, but not so high that you're stuck waiting for a rare catch to start breeding it.`,
    `Many players treat ${f.pal.name} as a stepping-stone — bred or caught once, then used as the backbone for chains targeting more powerful Pals.`,
  ],
  (f) => [
    `As Paldex #${String(f.pal.paldexNo).padStart(3, "0")}, ${f.pal.name} represents a clear inflection point in any breeding plan.`,
    `${formatElement(f.primaryElement)} typing keeps it relevant in mid-tier biomes, and the ${f.pal.powerValue} power value means it bridges between the early roster and the endgame projects you'll eventually target.`,
    `It's one of those Pals where the right pair of parents matters more than which Pal you pick — the math does the work, and ${f.pal.name} is reliable on either side of it.`,
  ],
];

const ENDGAME_TEMPLATES: Template[] = [
  (f) => [
    `${f.pal.name} is an endgame ${formatElements(f)} Pal whose power value (${f.pal.powerValue}) places it firmly in the upper tier of the breeding curve.`,
    `Most players will meet ${f.pal.name} either as a prized catch from a late-game biome or as the deliberate output of a multi-step breeding plan.`,
    f.isDual
      ? `The dual ${formatElement(f.primaryElement)}/${formatElement(f.secondaryElement!)} typing means it slots into hybrid roles other Pals can't fill — useful when planning passive-skill stacking on a specific element coverage.`
      : `Players targeting it usually do so for combat rather than utility — ${f.pal.name} is built to fight.`,
  ],
  (f) => [
    `If you've reached ${f.pal.name} (Paldex #${String(f.pal.paldexNo).padStart(3, "0")}), you've reached the part of the game where breeding plans start spanning multiple generations.`,
    `Its ${f.pal.powerValue} power value isn't trivial to reach without intermediate steps; pair-finding is where the calculator earns its keep.`,
    `${f.pal.breedOnly ? "There's no wild source — every copy of this Pal traces back to a specific parent pair, so the planner is the only practical path." : "It's catchable in the late biomes, but breeding for the right passive set is usually faster than re-rolling captures."}`,
  ],
];

const LEGENDARY_TEMPLATES: Template[] = [
  (f) => [
    `${f.pal.name} is a legendary ${formatElement(f.primaryElement)}-typed Pal — one of the showcase creatures at the very top of the Paldex's power curve, sitting at ${f.pal.powerValue}.`,
    `Reaching ${f.pal.name} through breeding alone is a project: every parent pair that produces it requires its own multi-generation lead-up, and many players combine wild captures with selective breeding to assemble a viable roster.`,
    `Once acquired, ${f.pal.name} is typically the centerpiece of a passive-skill chase — the egg-count math gets steep, but the ceiling is correspondingly high.`,
  ],
  (f) => [
    `Few Pals carry the same weight in the lategame as ${f.pal.name}.`,
    `The combination of ${formatElement(f.primaryElement)} typing and a power value of ${f.pal.powerValue} puts it in rare company; most parent pairs that produce it sit comfortably above the everyday breeding tiers, which means assembling those parents is itself a planning exercise.`,
    `If you're using this calculator's roster mode, ${f.pal.name} is exactly the kind of target the multi-generation pathfinder was built for.`,
  ],
];

const BREED_ONLY_TEMPLATES: Template[] = [
  (f) => [
    `${f.pal.name} is a breed-only ${formatElement(f.primaryElement)} Pal — there's no wild encounter for it, so every copy in your collection traces back to a specific parent pair.`,
    `That pair is locked into the special-combination table rather than emerging from power-value math, which means generic breeding tactics won't produce ${f.pal.name} by accident.`,
    `Use the reverse lookup on this page to identify the exact parents required, and the roster planner if either of those parents is itself behind a chain.`,
  ],
  (f) => [
    `Players hunting ${f.pal.name} learn quickly that the standard breeding curve is irrelevant: this Pal exists only as the output of a fixed parent pair.`,
    `The ${formatElement(f.primaryElement)} typing and ${f.pal.powerValue} power value matter for *what you do with it afterwards* — for *getting it*, the only thing that matters is finding (or breeding) the two specific parents the special-combination rule calls for.`,
    `It's a good test case for the multi-step planner if your roster doesn't already contain both halves.`,
  ],
];

const VARIANT_TEMPLATES: Template[] = [
  (f) => {
    const base = baseFormName(f.pal);
    const variantElementName = formatElement(f.primaryElement);
    return [
      `${f.pal.name} is the ${variantElementName}-aligned variant subform of ${base}, sharing the species lineage but swapping out the primary typing.`,
      `Mechanically, the variant relationship matters most for breeding: ${f.pal.name} can show up where its base form would, and vice versa, but its ${formatElement(f.primaryElement)} typing pulls children toward different element-matched pairings.`,
      `Power value (${f.pal.powerValue}) is comparable to the base form, so chains built around one will often work for the other with a typing-aware tweak.`,
    ];
  },
  (f) => {
    const base = baseFormName(f.pal);
    return [
      `Treat ${f.pal.name} as ${base} re-skinned for a different biome.`,
      `The ${formatElement(f.primaryElement)} typing puts it into a completely different element coverage role, but the underlying breeding profile — power value ${f.pal.powerValue}, similar parent pools — overlaps heavily with the base form.`,
      `Players with one in their roster should think carefully before treating the other as redundant: passive-skill stacking can target either, and the variant typing is sometimes the deciding factor in a planned pair.`,
    ];
  },
];

const TEMPLATES: Record<Category, Template[]> = {
  starter: STARTER_TEMPLATES,
  "common-breeder": COMMON_BREEDER_TEMPLATES,
  midgame: MIDGAME_TEMPLATES,
  endgame: ENDGAME_TEMPLATES,
  legendary: LEGENDARY_TEMPLATES,
  "breed-only": BREED_ONLY_TEMPLATES,
  variant: VARIANT_TEMPLATES,
};

/* -------------------------------------------------------------------------- */
/*  Public API                                                                */
/* -------------------------------------------------------------------------- */

const overrideMap = overrides as Record<string, string>;

/**
 * Top-level: returns the manual override if present, otherwise generates a
 * narrative paragraph from the Pal's facts. Always returns ≥80 words.
 */
export function getDescriptionFor(pal: Pal): string {
  const manual = overrideMap[pal.id];
  if (manual && manual.trim().length > 0) return manual;
  return generatePalDescription(pal);
}

/** Minimum words we promise per paragraph. Test enforces this too. */
const MIN_WORDS = 80;

export function generatePalDescription(pal: Pal): string {
  const facts = classify(pal);
  const templates = TEMPLATES[facts.category];
  const idx = stringHash(pal.id) % templates.length;
  const sentences = templates[idx]!(facts);
  let body = sentences.join(" ").replace(/\s+/g, " ").trim();

  // Safety net — if a future template change drops below the minimum, append
  // a category-aware tail sentence. The same Pal will get the same tail
  // because we hash off the same id.
  if (countWords(body) < MIN_WORDS) {
    body = `${body} ${pickTailSentence(facts)}`.replace(/\s+/g, " ").trim();
  }
  return body;
}

function countWords(s: string): number {
  return s.trim().split(/\s+/).length;
}

const TAIL_SENTENCES: Record<Category, string[]> = {
  starter: [
    "It's a Pal you'll often look back on after dozens of hours and realize you bred more of than anything else.",
    "If your roster ever runs low on early-game parents, this is one of the easiest to replenish.",
  ],
  "common-breeder": [
    "Its real worth shows up in the planner — solving for a target child often suggests it as one parent of the cheapest pair.",
    "Most experienced players keep a few breeding-ready copies on hand at all times.",
  ],
  midgame: [
    "Plans built around it tend to be three to four breedings deep, which is the sweet spot for the multi-step planner.",
    "If you're learning how the breeding math actually works, mid-tier Pals like this one are the right place to start experimenting.",
  ],
  endgame: [
    "Most players approach it as a project rather than a pickup — worth the time, but not casually.",
    "Pair-building into this Pal is exactly the kind of multi-generation work the planner was built to make tractable.",
  ],
  legendary: [
    "Treat it as a long-term goal: catch what you can, breed what you can't, and let the planner handle the rest.",
    "The egg counts will climb, but every passive you stack on the way is preserved for the next attempt.",
  ],
  "breed-only": [
    "If your roster is missing both halves of the required pair, the multi-step planner is the fastest route from where you are to here.",
    "Players who like a puzzle tend to enjoy this Pal more than its power value alone would suggest.",
  ],
  variant: [
    "Treat the variant relationship as a feature rather than a redundancy — different element coverage opens different planning options.",
    "Most rosters benefit from owning at least one of each form, even when the power-value math overlaps heavily.",
  ],
};

function pickTailSentence(f: PalFacts): string {
  const pool = TAIL_SENTENCES[f.category];
  const idx = (stringHash(f.pal.id) >>> 8) % pool.length;
  return pool[idx]!;
}

/** Indicates whether a Pal currently has a hand-written override. */
export function hasManualDescription(pal: Pal): boolean {
  return Boolean(overrideMap[pal.id]?.trim());
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function formatElement(e: Element): string {
  return e;
}

function formatElements(f: PalFacts): string {
  if (f.isDual) return `${formatElement(f.primaryElement)}/${formatElement(f.secondaryElement!)}`;
  return formatElement(f.primaryElement);
}

/**
 * Best-effort base-form name extraction. e.g. "mau-cryst" → "Mau".  Used in
 * variant narratives. Falls back to the suffix-stripped capitalization.
 */
function baseFormName(pal: Pal): string {
  const slug = pal.slug.toLowerCase();
  for (const suffix of VARIANT_SUFFIXES) {
    if (slug.endsWith(`-${suffix}`)) {
      const stem = slug.slice(0, -(suffix.length + 1));
      return stem.replace(/(^|-)([a-z])/g, (_, sep, ch) => `${sep === "-" ? " " : ""}${ch.toUpperCase()}`);
    }
  }
  return pal.name;
}

/**
 * djb2 string hash → unsigned 32-bit. Deterministic, fast, no deps.
 * Used only for template selection — not crypto.
 */
function stringHash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  return h >>> 0;
}
