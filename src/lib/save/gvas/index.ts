/**
 * GVAS module entry point.
 *
 * `parseGvas` reads the header, then the root property map. It throws
 * `RangeError` on truncated input — callers wrap the call in try/catch
 * at the parser-pipeline level and convert to a structured error.
 */

import type { GvasHeader, ParsedGvas } from "./types";
import { BinaryReader } from "./reader";
import { readPropertyMap } from "./properties";

/** "GVAS" magic. */
const GVAS_MAGIC = [0x47, 0x56, 0x41, 0x53] as const;

export function parseGvas(payload: Uint8Array): ParsedGvas {
  const reader = new BinaryReader(payload);
  const header = readHeader(reader);
  const root = readPropertyMap(reader);
  return { header, root };
}

function readHeader(reader: BinaryReader): GvasHeader {
  const magic = [
    reader.readUint8(),
    reader.readUint8(),
    reader.readUint8(),
    reader.readUint8(),
  ] as const;
  for (let i = 0; i < 4; i++) {
    if (magic[i] !== GVAS_MAGIC[i]) {
      throw new RangeError(
        `GVAS magic mismatch at offset 0: expected GVAS, got bytes [${magic.join(", ")}]`,
      );
    }
  }
  const saveGameFileVersion = reader.readInt32LE();
  const packageFileUE4Version = reader.readInt32LE();
  // UE5 saves include a separate UE5 version field. We probe by checking the
  // file-version: UE5 GVAS bumps `SaveGameFileVersion` to >= 3.
  const packageFileUE5Version = saveGameFileVersion >= 3 ? reader.readInt32LE() : 0;

  const engineMajor = reader.readUint16LE();
  const engineMinor = reader.readUint16LE();
  const enginePatch = reader.readUint16LE();
  const engineChangelist = reader.readUint32LE();
  const engineBranch = reader.readFString();

  // Custom format data: int32 count, then [Guid, int32] pairs.
  const customFormatCount = reader.readInt32LE();
  const customFormat: Array<{ guid: string; value: number }> = [];
  for (let i = 0; i < customFormatCount; i++) {
    const guid = reader.readGuid();
    const value = reader.readInt32LE();
    customFormat.push({ guid, value });
  }

  const saveGameClassName = reader.readFString();

  return {
    magic: "GVAS",
    saveGameFileVersion,
    packageFileUE4Version,
    packageFileUE5Version,
    engineMajor,
    engineMinor,
    enginePatch,
    engineChangelist,
    engineBranch,
    customFormat,
    saveGameClassName,
  };
}

export type { ParsedGvas, GvasHeader, PropertyValue, PropertyMap, MapEntry } from "./types";
export { BinaryReader } from "./reader";
export {
  readPropertyMap,
  readPropertyValue,
  asString,
  asInt,
  asArray,
  asStructFields,
  asMapEntries,
} from "./properties";
