/**
 * Public entry point for save-file parsing.
 *
 * Pipeline:
 *   1. Decompress the PlZ container around the GVAS payload.
 *   2. Parse the GVAS file (header + root property map).
 *   3. Detect the save variant.
 *   4. Run the version-appropriate Pal extractor.
 *
 * Errors are values, not exceptions. Only truly malformed input — a buffer
 * that isn't a Palworld save at all — produces a fatal error. Everything
 * else (unknown property kinds, missing fields, unsupported version) is a
 * warning bundled with whatever data we managed to extract.
 */

import { decompressSave } from "./decompress";
import { parseGvas } from "./gvas";
import { extractPals, type ParsedPal } from "./extractors/pals";
import { detectVariant } from "./extractors/version";

export interface ParseResult {
  saveVersion: string;
  detectedGameVersion: string | null;
  pals: ParsedPal[];
  warnings: ParseWarning[];
  errors: ParseError[];
  unmappedPalIds: string[];
  unmappedPassiveIds: string[];
}

export interface ParseWarning {
  code: string;
  message: string;
  context?: unknown;
}

export interface ParseError extends ParseWarning {
  fatal: boolean;
}

export type { ParsedPal };

export type ParseProgress =
  | { phase: "decompress"; progress: number }
  | { phase: "parse"; progress: number }
  | { phase: "extract"; progress: number };

export interface ParseOptions {
  onProgress?: (p: ParseProgress) => void;
  /** Override the decompressor's max-bytes guard. */
  maxCompressedBytes?: number;
}

const EMPTY: ParseResult = {
  saveVersion: "unknown",
  detectedGameVersion: null,
  pals: [],
  warnings: [],
  errors: [],
  unmappedPalIds: [],
  unmappedPassiveIds: [],
};

/**
 * The promised public API. Runs synchronously under the hood; the async
 * signature lets callers `await` it from worker glue without changing their
 * code if we ever insert async work.
 */
export async function parseSaveFile(
  buffer: ArrayBuffer,
  options: ParseOptions = {},
): Promise<ParseResult> {
  const warnings: ParseWarning[] = [];
  const errors: ParseError[] = [];

  const decompress = decompressSave(buffer, {
    maxCompressedBytes: options.maxCompressedBytes,
    onProgress: (p) => options.onProgress?.({ phase: "decompress", progress: p }),
  });
  if (!decompress.ok) {
    return {
      ...EMPTY,
      errors: [
        { code: decompress.code, message: decompress.message, fatal: decompress.code === "BAD_MAGIC" },
      ],
    };
  }

  options.onProgress?.({ phase: "parse", progress: 0 });

  let gvas;
  try {
    gvas = parseGvas(decompress.payload);
  } catch (e) {
    return {
      ...EMPTY,
      errors: [
        {
          code: "GVAS_PARSE_FAILED",
          message:
            "Decompression succeeded but the GVAS payload is malformed: " +
            (e as Error).message,
          fatal: true,
        },
      ],
    };
  }
  options.onProgress?.({ phase: "parse", progress: 1 });

  const versionInfo = detectVariant(gvas.header);
  if (versionInfo.belowMinimum) {
    errors.push({
      code: "BELOW_MINIMUM_VERSION",
      message: `${versionInfo.description} is older than this parser supports.`,
      fatal: false,
    });
  }
  if (versionInfo.aboveMaximum) {
    errors.push({
      code: "UNSUPPORTED_VERSION",
      message:
        `${versionInfo.description} is newer than this parser supports. ` +
        "Some Pals may be missing or incorrect.",
      fatal: false,
    });
  }

  options.onProgress?.({ phase: "extract", progress: 0 });
  const extraction = extractPals(gvas);
  options.onProgress?.({ phase: "extract", progress: 1 });

  for (const w of extraction.warnings) warnings.push(w);

  const saveVersion = `gvas v${gvas.header.saveGameFileVersion}`;
  const detectedGameVersion = `${gvas.header.engineMajor}.${gvas.header.engineMinor}.${gvas.header.enginePatch}`;

  return {
    saveVersion,
    detectedGameVersion,
    pals: extraction.pals,
    warnings,
    errors,
    unmappedPalIds: extraction.unmappedPalIds,
    unmappedPassiveIds: extraction.unmappedPassiveIds,
  };
}
