/**
 * GVAS property reader.
 *
 * After the GVAS header, the file is a stream of `Property` records ending
 * with a "None" property. Each record is:
 *
 *   FString  property name        ("None" terminates)
 *   FString  property type        ("BoolProperty", "StructProperty", …)
 *   int64    serialized data size (excluding the small per-type prelude
 *                                  that BoolProperty/EnumProperty/etc add)
 *   uint32   array index          (almost always 0)
 *   …per-type prelude bytes…
 *   guid?    property guid        (only present if the next byte == 1)
 *   …value bytes…
 *
 * This module decodes the well-defined types fully and falls back to a
 * `raw` value for everything else. Falling back instead of throwing is what
 * makes the parser tolerant of game-version drift — new property kinds show
 * up as `unknown` warnings instead of fatal errors.
 *
 * Reference: `palworld-save-tools` (Apache-2.0). No code copied — credited
 * in README.
 */

import type {
  MapEntry,
  PropertyMap,
  PropertyValue,
} from "./types";
import type { BinaryReader } from "./reader";

/** Read properties until the "None" terminator. */
export function readPropertyMap(reader: BinaryReader): PropertyMap {
  const map: PropertyMap = new Map();
  while (true) {
    const name = reader.readFString();
    if (name === "None") return map;
    if (name === "") {
      // An empty name is malformed — bail rather than spin forever.
      throw new RangeError(
        `Unexpected empty property name at offset ${reader.position}`,
      );
    }
    const type = reader.readFString();
    const size = reader.readInt64LE(); // declared bytes for the value section
    const arrayIndex = reader.readUint32LE();
    void arrayIndex; // not used downstream — preserved for completeness
    const value = readPropertyValue(reader, type, Number(size));
    map.set(name, value);
  }
}

/**
 * Read a single property value. `size` is the declared size from the header;
 * we use it as a safety-net upper bound for unknown types.
 */
export function readPropertyValue(
  reader: BinaryReader,
  type: string,
  size: number,
): PropertyValue {
  switch (type) {
    case "BoolProperty": {
      // Bool values are encoded in the prelude byte, not the value section.
      const v = reader.readUint8() !== 0;
      readOptionalGuid(reader);
      return { kind: "bool", value: v };
    }
    case "IntProperty": {
      readOptionalGuid(reader);
      return { kind: "int", value: reader.readInt32LE() };
    }
    case "Int64Property": {
      readOptionalGuid(reader);
      return { kind: "int64", value: reader.readInt64LE() };
    }
    case "UInt32Property": {
      readOptionalGuid(reader);
      return { kind: "int", value: reader.readUint32LE() };
    }
    case "FloatProperty": {
      readOptionalGuid(reader);
      return { kind: "float", value: reader.readFloat32LE() };
    }
    case "DoubleProperty": {
      readOptionalGuid(reader);
      return { kind: "double", value: reader.readFloat64LE() };
    }
    case "StrProperty": {
      readOptionalGuid(reader);
      return { kind: "string", value: reader.readFString() };
    }
    case "NameProperty": {
      readOptionalGuid(reader);
      return { kind: "name", value: reader.readFName() };
    }
    case "ByteProperty": {
      const enumName = reader.readFString();
      readOptionalGuid(reader);
      // ByteProperty is "single byte enum" or "raw byte" depending on whether
      // the prelude enum name was "None".
      if (enumName === "None") {
        return { kind: "byte", enumName: null, value: reader.readUint8() };
      }
      return { kind: "byte", enumName, value: reader.readFString() };
    }
    case "EnumProperty": {
      const enumName = reader.readFString();
      readOptionalGuid(reader);
      return { kind: "enum", enumName, value: reader.readFString() };
    }
    case "ArrayProperty": {
      const elementType = reader.readFString();
      readOptionalGuid(reader);
      return readArrayValue(reader, elementType, size);
    }
    case "SetProperty": {
      const elementType = reader.readFString();
      readOptionalGuid(reader);
      // Sets serialize as: uint32 num removed entries (often 0) + array.
      const removedCount = reader.readUint32LE();
      void removedCount;
      const count = reader.readUint32LE();
      const values: PropertyValue[] = [];
      for (let i = 0; i < count; i++) {
        values.push(readInlineValue(reader, elementType));
      }
      return { kind: "set", elementType, values };
    }
    case "MapProperty": {
      const keyType = reader.readFString();
      const valueType = reader.readFString();
      readOptionalGuid(reader);
      // Map prelude: uint32 num-removed (skip), uint32 count.
      reader.readUint32LE();
      const count = reader.readUint32LE();
      const entries: MapEntry[] = [];
      for (let i = 0; i < count; i++) {
        // Palworld's `CharacterSaveParameterMap` (and most UE5 maps with
        // struct keys) uses an FGuid as the inline key — 16 raw bytes, not
        // a property map. Hard-code that shape here. If a future map needs
        // a different inline-struct key, plumb a hint through.
        const key: PropertyValue =
          keyType === "StructProperty"
            ? { kind: "string", value: reader.readGuid() }
            : readInlineValue(reader, keyType);
        const value = readInlineValue(reader, valueType);
        entries.push({ key, value });
      }
      return { kind: "map", keyType, valueType, entries };
    }
    case "StructProperty": {
      const structType = reader.readFString();
      // 16-byte struct guid (all zeros for most game-defined structs).
      reader.readBytes(16);
      readOptionalGuid(reader);
      return readStructValue(reader, structType, size);
    }
    default: {
      // Unknown property type — capture the bytes and continue. Use the
      // declared size as a hard upper bound.
      const cap = Math.min(size, reader.remaining);
      const bytes = reader.readBytes(Math.max(0, cap));
      return { kind: "unknown", declaredType: type, bytes };
    }
  }
}

/**
 * StructProperty values vary by struct type. We handle a small set of
 * well-known shapes and fall back to "this is a property map" — which is
 * what the vast majority of Palworld game-defined structs are.
 */
function readStructValue(
  reader: BinaryReader,
  structType: string,
  size: number,
): PropertyValue {
  switch (structType) {
    case "Vector":
    case "Rotator": {
      const x = reader.readFloat64LE();
      const y = reader.readFloat64LE();
      const z = reader.readFloat64LE();
      const fields: PropertyMap = new Map();
      fields.set("X", { kind: "double", value: x });
      fields.set("Y", { kind: "double", value: y });
      fields.set("Z", { kind: "double", value: z });
      return { kind: "struct", structType, fields };
    }
    case "Quat": {
      const x = reader.readFloat64LE();
      const y = reader.readFloat64LE();
      const z = reader.readFloat64LE();
      const w = reader.readFloat64LE();
      const fields: PropertyMap = new Map();
      fields.set("X", { kind: "double", value: x });
      fields.set("Y", { kind: "double", value: y });
      fields.set("Z", { kind: "double", value: z });
      fields.set("W", { kind: "double", value: w });
      return { kind: "struct", structType, fields };
    }
    case "DateTime": {
      const ticks = reader.readInt64LE();
      const fields: PropertyMap = new Map();
      fields.set("Ticks", { kind: "int64", value: ticks });
      return { kind: "struct", structType, fields };
    }
    case "Guid": {
      const guid = reader.readGuid();
      const fields: PropertyMap = new Map();
      fields.set("Guid", { kind: "string", value: guid });
      return { kind: "struct", structType, fields };
    }
    case "LinearColor": {
      const r = reader.readFloat32LE();
      const g = reader.readFloat32LE();
      const b = reader.readFloat32LE();
      const a = reader.readFloat32LE();
      const fields: PropertyMap = new Map();
      fields.set("R", { kind: "float", value: r });
      fields.set("G", { kind: "float", value: g });
      fields.set("B", { kind: "float", value: b });
      fields.set("A", { kind: "float", value: a });
      return { kind: "struct", structType, fields };
    }
    default: {
      // Generic struct: a property map terminated by "None". The declared
      // size lets us detect runaways but we trust the "None" terminator.
      void size;
      const fields = readPropertyMap(reader);
      return { kind: "struct", structType, fields };
    }
  }
}

function readArrayValue(
  reader: BinaryReader,
  elementType: string,
  size: number,
): PropertyValue {
  if (elementType === "StructProperty") {
    // Arrays of structs have an extra header before the elements:
    //   FString fieldName, FString "StructProperty", int64 size,
    //   FString structType, 16-byte guid, optional guid byte
    // (all of which we already know in context — we read them and use
    // structType.)
    const count = reader.readUint32LE();
    const innerName = reader.readFString();
    void innerName;
    const innerType = reader.readFString();
    void innerType;
    const innerSize = reader.readInt64LE();
    void innerSize;
    const structType = reader.readFString();
    reader.readBytes(16); // struct guid
    readOptionalGuid(reader);
    const values: PropertyValue[] = [];
    for (let i = 0; i < count; i++) {
      // Each struct in the array is the inner property map (or a known shape).
      values.push(readStructValue(reader, structType, 0));
    }
    return { kind: "array", elementType, values };
  }
  const count = reader.readUint32LE();
  const values: PropertyValue[] = [];
  for (let i = 0; i < count; i++) {
    values.push(readInlineValue(reader, elementType));
  }
  void size;
  return { kind: "array", elementType, values };
}

/**
 * Read a single value at the current offset for `type`, in the inline form
 * used inside Array/Set/Map. Inline values omit the property header, just
 * the raw value bytes.
 */
function readInlineValue(reader: BinaryReader, type: string): PropertyValue {
  switch (type) {
    case "BoolProperty":
      return { kind: "bool", value: reader.readBool() };
    case "IntProperty":
      return { kind: "int", value: reader.readInt32LE() };
    case "Int64Property":
      return { kind: "int64", value: reader.readInt64LE() };
    case "FloatProperty":
      return { kind: "float", value: reader.readFloat32LE() };
    case "DoubleProperty":
      return { kind: "double", value: reader.readFloat64LE() };
    case "StrProperty":
      return { kind: "string", value: reader.readFString() };
    case "NameProperty":
      return { kind: "name", value: reader.readFName() };
    case "ByteProperty":
      return { kind: "byte", enumName: null, value: reader.readUint8() };
    case "StructProperty":
      // Inline structs in arrays/maps are themselves property maps unless
      // the caller has special-cased the struct type. Defer to generic.
      return { kind: "struct", structType: "<inline>", fields: readPropertyMap(reader) };
    default:
      // Best effort: leave a tagged marker. Inline-of-unknown is rare
      // outside game-version drift; flagging it surfaces the issue to
      // the user via the diagnostics panel.
      return { kind: "unknown", declaredType: type, bytes: new Uint8Array() };
  }
}

/**
 * Many UE saves write a "have-guid" byte (0/1) before the value, and a
 * 16-byte guid when 1. Read the byte; consume the guid if present.
 */
function readOptionalGuid(reader: BinaryReader): void {
  const flag = reader.readUint8();
  if (flag !== 0) reader.readBytes(16);
}

/* -------------------------------------------------------------------------- */
/*  Convenience helpers — type-narrowing accessors used by extractors.        */
/* -------------------------------------------------------------------------- */

export function asString(v: PropertyValue | undefined): string | undefined {
  if (!v) return undefined;
  if (v.kind === "string" || v.kind === "name") return v.value;
  if (v.kind === "enum") return v.value;
  if (v.kind === "byte" && typeof v.value === "string") return v.value;
  return undefined;
}

export function asInt(v: PropertyValue | undefined): number | undefined {
  if (!v) return undefined;
  if (v.kind === "int") return v.value;
  if (v.kind === "int64") {
    // Levels and IVs fit in safe int range. Saturate if not.
    const n = Number(v.value);
    return Number.isSafeInteger(n) ? n : undefined;
  }
  return undefined;
}

export function asArray(v: PropertyValue | undefined): PropertyValue[] | undefined {
  if (!v) return undefined;
  if (v.kind === "array" || v.kind === "set") return v.values;
  return undefined;
}

export function asStructFields(v: PropertyValue | undefined): PropertyMap | undefined {
  if (!v) return undefined;
  if (v.kind === "struct") return v.fields;
  return undefined;
}

export function asMapEntries(v: PropertyValue | undefined): MapEntry[] | undefined {
  if (!v) return undefined;
  if (v.kind === "map") return v.entries;
  return undefined;
}
