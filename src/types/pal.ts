/**
 * Domain types for Pals and breeding.
 *
 * These are the canonical shapes everything else (engine, UI, scraper output)
 * depends on. Keep them small, narrow, and forward-compatible: future phases
 * (passive skills, work suitabilities, save import) should extend, not break.
 */

export type Element =
  | "Neutral"
  | "Fire"
  | "Water"
  | "Grass"
  | "Electric"
  | "Ice"
  | "Ground"
  | "Dark"
  | "Dragon";

export const ELEMENTS: readonly Element[] = [
  "Neutral",
  "Fire",
  "Water",
  "Grass",
  "Electric",
  "Ice",
  "Ground",
  "Dark",
  "Dragon",
] as const;

export interface Pal {
  /** Stable internal id, e.g. "lamball". Lowercase, hyphenated, no spaces. */
  id: string;

  /** Canonical Paldex number. Used for tie-breaking and display. */
  paldexNo: number;

  /** Display name, e.g. "Lamball". */
  name: string;

  /** URL-safe slug — usually equal to id, kept separate so they can diverge later. */
  slug: string;

  /** One or two elements. Order matters (primary first). */
  elements: Element[];

  /**
   * CombiRank — the value used by the breeding-power-average algorithm.
   * Higher = "stronger" in the breeding sense (NOT raw stats).
   */
  powerValue: number;

  /**
   * Whether this Pal can appear as the *result* of standard power-value breeding.
   * Variants, raid bosses, and special-combo-only Pals should set this to false
   * so they're excluded from the candidate pool.
   */
  breedable: boolean;

  /**
   * True if this Pal CANNOT be caught in the wild — it can only be obtained by
   * breeding (or by hatching a specific egg). Used by ranking heuristics to
   * down-rank parent pairs that require breeding their parents first.
   * Optional; treat absent as `false` (catchable).
   */
  breedOnly?: boolean;

  /** Image URL — local (/pals/lamball.png) or remote. Optional until scraper fills it. */
  imageUrl?: string;

  // --- Reserved for later phases. Keep optional, never required. ---

  /** Passive trait ids this Pal can naturally roll. Used by Phase 2 passive math. */
  passiveTraits?: string[];

  /** Work suitabilities, e.g. { kindling: 1, mining: 2 }. Phase 4. */
  workSuitabilities?: Record<string, number>;
}

/**
 * A Palworld passive skill. Most Pals don't have a *fixed* passive set —
 * passives are mostly random per-instance — so this lives in its own master
 * list rather than embedded in each Pal record.
 */
export interface PassiveSkill {
  /** Stable id, e.g. "swift", "lucky", "ferocious". Lowercase, hyphenated. */
  id: string;
  /** Display name. */
  name: string;
  /** Sign of effect. Drives UI color coding. */
  tier: "positive" | "negative" | "neutral";
  /** Stat-boosting passives have ranks 1–4; non-tiered passives use 1. */
  rank: 1 | 2 | 3 | 4;
  /** Human-readable effect description. */
  effect: string;
}

/**
 * A special breeding combination that overrides the power-value calculation.
 * Order of parents is irrelevant: (A,B) and (B,A) yield the same child.
 */
export interface BreedingCombo {
  /** Parent A Pal id. */
  parentA: string;
  /** Parent B Pal id. */
  parentB: string;
  /** Resulting child Pal id. Overrides power-value math when matched. */
  child: string;
}

/**
 * Type guard: checks that an unknown value matches the Pal shape at runtime.
 * Used by the scraper output-writer and any future user-uploaded data.
 */
export function isPal(value: unknown): value is Pal {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.paldexNo === "number" &&
    typeof v.name === "string" &&
    typeof v.slug === "string" &&
    Array.isArray(v.elements) &&
    v.elements.every((e) => typeof e === "string") &&
    typeof v.powerValue === "number" &&
    typeof v.breedable === "boolean"
  );
}

/* -------------------------------------------------------------------------- */
/*  Phase 3: roster + multi-step breeding plans                               */
/* -------------------------------------------------------------------------- */

/**
 * A single Pal the user owns. Multiple instances of the same species are
 * allowed — players hoard. `instanceId` is a stable client-side uuid; nothing
 * in the engine cares about it except dedup and UI keying.
 */
export interface OwnedPal {
  /** UUID. Stable across renames; survives import/export. */
  instanceId: string;
  /** References Pal.id. */
  palId: string;
  /** PassiveSkill ids — max 4, deduplicated, ordered for display only. */
  passives: string[];
  /** Optional human-friendly label. */
  nickname?: string;
  /** Optional. Used by future strict-mode pairing rules; ignored by Phase-3 search. */
  gender?: "male" | "female";
  /** Free-form notes the user can attach. */
  notes?: string;
  /** How this Pal entered the roster. Phase 4. */
  source?: "manual" | "import";
  /** ISO timestamp of the import that produced this entry, if any. Phase 4. */
  importedAt?: string;
  /** Game-internal id (e.g. "Pal_Lamball"). Used by smart-merge to dedup re-imports. Phase 4. */
  rawId?: string;
}

/**
 * The user's owned-Pal collection. Versioned so we can migrate the shape later
 * without bricking saved data. Phase 3 ships v1.
 */
export interface Roster {
  version: 1;
  pals: OwnedPal[];
  /** ISO-8601 timestamp of the last write. */
  updatedAt: string;
}

/**
 * A saved goal: target species + desired passives. Re-runnable against the
 * current roster from `/goals`.
 */
export interface Goal {
  /** UUID. */
  id: string;
  /** User-supplied label, e.g. "Anubis with Lucky + Swift". */
  name: string;
  /** Pal.id of the target. */
  targetPalId: string;
  /** PassiveSkill ids. Up to 4. */
  desiredPassives: string[];
  /** ISO-8601 timestamp the goal was created. */
  createdAt: string;
}

export interface GoalsStore {
  version: 1;
  goals: Goal[];
  updatedAt: string;
}

/**
 * One step in a multi-generation plan. Either parent may be drawn from the
 * starting roster (`instanceId` populated) or be the child of a previous step
 * (`instanceId` undefined — produced in-chain).
 */
export interface BreedingStep {
  parentA: BreedingStepParent;
  parentB: BreedingStepParent;
  child: {
    palId: string;
    /** Passives the search expects this child to carry (subset of the desired set). */
    targetPassives: string[];
  };
  /** Expected number of eggs to hatch a child meeting `targetPassives`. Ceil at the UI layer. */
  expectedEggs: number;
  /** P(success on a single attempt of this step), in [0, 1]. */
  probability: number;
  /** Optional human-readable reason; populated when the step is a feeder pre-breed. */
  notes?: string;
}

export interface BreedingStepParent {
  palId: string;
  /** Set when this parent is a specific roster instance. */
  instanceId?: string;
  /** Passives we require this parent to carry going into the breed. */
  requiredPassives: string[];
}

/**
 * The output of the pathfinder. Up to ~5 of these come back per request,
 * sorted by `totalExpectedEggs` ascending.
 */
export interface BreedingPlan {
  steps: BreedingStep[];
  /** Sum of `expectedEggs` across all steps. The headline cost. */
  totalExpectedEggs: number;
  /** Number of breedings needed (== `steps.length`). */
  totalSteps: number;
  /** P(this plan produces the goal in a single full run-through). */
  finalProbability: number;
  /** Diagnostic strings — surfaced to users where actionable. */
  warnings: string[];
}

export function isPassiveSkill(value: unknown): value is PassiveSkill {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    (v.tier === "positive" || v.tier === "negative" || v.tier === "neutral") &&
    (v.rank === 1 || v.rank === 2 || v.rank === 3 || v.rank === 4) &&
    typeof v.effect === "string"
  );
}
