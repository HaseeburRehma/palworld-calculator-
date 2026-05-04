/**
 * Public surface of the save-file module.
 *
 * Keep this list small. The UI imports from here; everything internal to
 * `src/lib/save/` is private.
 */

export {
  parseSaveFile,
  type ParseResult,
  type ParseWarning,
  type ParseError,
  type ParseProgress,
  type ParseOptions,
  type ParsedPal,
} from "./parser";
export { decompressSave, type DecompressResult, type DecompressErrorCode } from "./decompress";
export { mapRawIdToPalId, PAL_ID_MAP } from "./mappings/pal-ids";
export { mapRawPassiveIdToPassiveId, PASSIVE_ID_MAP } from "./mappings/passive-ids";
