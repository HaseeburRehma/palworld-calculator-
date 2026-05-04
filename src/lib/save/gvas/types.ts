/**
 * GVAS (Unreal Engine SaveGame) type model.
 *
 * GVAS is documented in many Unreal-Engine reverse-engineering projects;
 * the canonical structural reference for this implementation is the
 * `palworld-save-tools` Python project. Property values are modeled as
 * a sum type so consumers can pattern-match.
 *
 * We model only what the Palworld-specific extractor needs. Unknown
 * property kinds get bubbled up as `UnknownProperty`, never thrown.
 */

/** Unreal FGuid — 16 bytes, displayed as a hyphenated UUID string. */
export type Guid = string;

export type PropertyValue =
  | { kind: "bool"; value: boolean }
  | { kind: "int"; value: number }
  | { kind: "int64"; value: bigint }
  | { kind: "float"; value: number }
  | { kind: "double"; value: number }
  | { kind: "string"; value: string }
  | { kind: "name"; value: string }
  | { kind: "byte"; enumName: string | null; value: string | number }
  | { kind: "enum"; enumName: string; value: string }
  | { kind: "array"; elementType: string; values: PropertyValue[] }
  | { kind: "set"; elementType: string; values: PropertyValue[] }
  | { kind: "map"; keyType: string; valueType: string; entries: MapEntry[] }
  | { kind: "struct"; structType: string; fields: PropertyMap }
  | { kind: "raw"; bytes: Uint8Array; declaredType: string }
  | { kind: "unknown"; declaredType: string; bytes: Uint8Array };

export interface MapEntry {
  key: PropertyValue;
  value: PropertyValue;
}

/** Properties keyed by their FName (the "Name" the property was serialized with). */
export type PropertyMap = Map<string, PropertyValue>;

/** Top-level result of parsing a GVAS file. */
export interface ParsedGvas {
  header: GvasHeader;
  /** Top-level "root" properties — the file's main save struct. */
  root: PropertyMap;
}

export interface GvasHeader {
  /** Magic bytes "GVAS". */
  magic: "GVAS";
  saveGameFileVersion: number;
  packageFileUE4Version: number;
  /** UE5 introduces a separate UE5 version field; UE4 saves report 0. */
  packageFileUE5Version: number;
  engineMajor: number;
  engineMinor: number;
  enginePatch: number;
  engineChangelist: number;
  engineBranch: string;
  /** Custom format `(Guid, int32)[]`. Not used by the extractor; preserved for diagnostics. */
  customFormat: Array<{ guid: Guid; value: number }>;
  saveGameClassName: string;
}
