/**
 * Mapping canary script.
 *
 * Reads every `.sav` file under `tests/fixtures/saves/` and reports any
 * unmapped Pal ids or passive ids the parser surfaces. The intended workflow
 * after a Palworld patch:
 *
 *   1. Dump a sanitized save into `tests/fixtures/saves/<patch>.sav`.
 *   2. `pnpm verify-mappings`
 *   3. Update `src/lib/save/mappings/{pal-ids,passive-ids}.ts` to cover the
 *      diffs.
 *   4. Re-run; expect 0 unmapped.
 *
 * Exits with a non-zero status when any unmapped ids are reported. CI can
 * wire this up later.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseSaveFile } from "../src/lib/save";

const FIXTURES_DIR = resolve(process.cwd(), "tests/fixtures/saves");

async function main(): Promise<number> {
  if (!existsSync(FIXTURES_DIR)) {
    console.log(`No fixtures directory at ${FIXTURES_DIR}.`);
    console.log(
      "Drop a sanitized save file in there (Level.sav, sanitized of player/world names) " +
        "to use this canary.",
    );
    return 0;
  }

  const files = readdirSync(FIXTURES_DIR).filter((f) => f.toLowerCase().endsWith(".sav"));
  if (files.length === 0) {
    console.log(`No .sav files under ${FIXTURES_DIR}.`);
    return 0;
  }

  let totalUnmapped = 0;
  for (const file of files) {
    const path = join(FIXTURES_DIR, file);
    const buffer = readFileSync(path);
    // Convert Node Buffer → ArrayBuffer the parser expects.
    const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

    console.log(`\n— ${file} —`);
    const result = await parseSaveFile(ab);

    console.log(`  saveVersion: ${result.saveVersion}`);
    console.log(`  detectedGameVersion: ${result.detectedGameVersion ?? "(unknown)"}`);
    console.log(`  pals (player-owned): ${result.pals.filter((p) => p.isPlayerOwned).length}`);
    if (result.errors.length > 0) {
      for (const e of result.errors) {
        console.log(`  error[${e.fatal ? "fatal" : "warn"}] ${e.code}: ${e.message}`);
      }
    }
    if (result.warnings.length > 0) {
      for (const w of result.warnings) {
        console.log(`  warn ${w.code}: ${w.message}`);
      }
    }
    if (result.unmappedPalIds.length > 0) {
      console.log(`  unmapped Pal ids (${result.unmappedPalIds.length}):`);
      for (const id of result.unmappedPalIds) console.log(`    - ${id}`);
      totalUnmapped += result.unmappedPalIds.length;
    } else {
      console.log("  unmapped Pal ids: 0");
    }
    if (result.unmappedPassiveIds.length > 0) {
      console.log(`  unmapped passive ids (${result.unmappedPassiveIds.length}):`);
      for (const id of result.unmappedPassiveIds) console.log(`    - ${id}`);
      totalUnmapped += result.unmappedPassiveIds.length;
    } else {
      console.log("  unmapped passive ids: 0");
    }
  }

  console.log(`\nTotal unmapped ids across all fixtures: ${totalUnmapped}`);
  return totalUnmapped === 0 ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err);
    process.exit(2);
  },
);
