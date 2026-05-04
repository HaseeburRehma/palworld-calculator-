/**
 * Save-version detection.
 *
 * Phase 4 ships one extractor variant. The dispatch table makes future
 * variants a one-file addition: implement the new extractor, add a case
 * to `selectExtractor`, document the supported version in `data/README.md`.
 */

import type { GvasHeader } from "../gvas/types";

/** Stable identifier for an extractor variant. Surface this in diagnostics. */
export type ExtractorVariant = "v1" | "unknown";

export interface VersionInfo {
  variant: ExtractorVariant;
  /** Human-readable, e.g. "Palworld save (engine 5.1.1, GVAS file v3)". */
  description: string;
  /** True when the variant is below our minimum supported. */
  belowMinimum: boolean;
  /** True when the variant is above our maximum supported. */
  aboveMaximum: boolean;
}

/**
 * Inspect the GVAS header and decide which extractor to dispatch to. Use
 * the engine version + save-game class name as the discriminator.
 *
 * The current implementation is permissive — anything that looks like a
 * Palworld GVAS goes to the v1 extractor and gets warnings if it's
 * suspiciously old or new.
 */
export function detectVariant(header: GvasHeader): VersionInfo {
  const engineDesc = `engine ${header.engineMajor}.${header.engineMinor}.${header.enginePatch}`;
  const description = `Palworld save (${engineDesc}, GVAS file v${header.saveGameFileVersion})`;

  // Treat anything older than UE 5 as "below minimum" — Palworld is UE5.
  const belowMinimum = header.engineMajor < 5;
  // Save-game file version >= 5 hasn't shipped yet at time of writing.
  const aboveMaximum = header.saveGameFileVersion >= 5;

  if (header.engineMajor === 0) {
    return { variant: "unknown", description, belowMinimum: true, aboveMaximum };
  }

  return { variant: "v1", description, belowMinimum, aboveMaximum };
}
