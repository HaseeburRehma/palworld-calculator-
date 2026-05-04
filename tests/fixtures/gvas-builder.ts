/**
 * Synthetic GVAS + PlZ buffer builder for tests.
 *
 * Construct minimal binary save files exercising specific parser paths,
 * without needing a real Palworld save. The builder is deliberately limited
 * — it only writes the property kinds we actually exercise in tests.
 *
 * Produces output the parser can round-trip:
 *   - PlZ-wrapped (default, container v0)
 *   - GVAS header with the magic, version fields, save class name
 *   - A property map of your design, ending with "None"
 */

import * as pako from "pako";

export class BufferWriter {
  private chunks: Uint8Array[] = [];
  private len = 0;

  bytes(b: Uint8Array): this {
    this.chunks.push(b);
    this.len += b.byteLength;
    return this;
  }
  uint8(n: number): this {
    return this.bytes(new Uint8Array([n & 0xff]));
  }
  uint16LE(n: number): this {
    const b = new Uint8Array(2);
    new DataView(b.buffer).setUint16(0, n, true);
    return this.bytes(b);
  }
  uint32LE(n: number): this {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setUint32(0, n, true);
    return this.bytes(b);
  }
  int32LE(n: number): this {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setInt32(0, n, true);
    return this.bytes(b);
  }
  int64LE(n: number | bigint): this {
    const b = new Uint8Array(8);
    new DataView(b.buffer).setBigInt64(0, BigInt(n), true);
    return this.bytes(b);
  }
  float32LE(n: number): this {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setFloat32(0, n, true);
    return this.bytes(b);
  }
  float64LE(n: number): this {
    const b = new Uint8Array(8);
    new DataView(b.buffer).setFloat64(0, n, true);
    return this.bytes(b);
  }
  /** UTF-8 FString with terminating null. Length includes the null. */
  fstring(s: string): this {
    if (s.length === 0) return this.int32LE(0);
    const utf8 = new TextEncoder().encode(s);
    this.int32LE(utf8.byteLength + 1);
    this.bytes(utf8);
    return this.uint8(0);
  }
  guidZeros(): this {
    return this.bytes(new Uint8Array(16));
  }
  build(): Uint8Array {
    const out = new Uint8Array(this.len);
    let off = 0;
    for (const c of this.chunks) {
      out.set(c, off);
      off += c.byteLength;
    }
    return out;
  }
}

/* -------------------------------------------------------------------------- */
/*  Property writers                                                          */
/* -------------------------------------------------------------------------- */

function writeBoolProp(w: BufferWriter, name: string, value: boolean): void {
  w.fstring(name).fstring("BoolProperty").int64LE(0).uint32LE(0);
  w.uint8(value ? 1 : 0).uint8(0);
}

function writeIntProp(w: BufferWriter, name: string, value: number): void {
  w.fstring(name).fstring("IntProperty").int64LE(4).uint32LE(0);
  w.uint8(0).int32LE(value);
}

function writeStrProp(w: BufferWriter, name: string, value: string): void {
  // Size field is the FString's bytes; we let the reader trust the data and
  // pass 0 since we re-derive FString length from its own header.
  w.fstring(name).fstring("StrProperty").int64LE(0).uint32LE(0);
  w.uint8(0).fstring(value);
}

function writeNameProp(w: BufferWriter, name: string, value: string): void {
  w.fstring(name).fstring("NameProperty").int64LE(0).uint32LE(0);
  w.uint8(0).fstring(value);
}

function writeEnumProp(w: BufferWriter, name: string, enumName: string, value: string): void {
  w.fstring(name).fstring("EnumProperty").int64LE(0).uint32LE(0);
  w.fstring(enumName).uint8(0).fstring(value);
}

function writeArrayOfNamesProp(w: BufferWriter, name: string, items: string[]): void {
  w.fstring(name).fstring("ArrayProperty").int64LE(0).uint32LE(0);
  w.fstring("NameProperty").uint8(0);
  w.uint32LE(items.length);
  for (const s of items) w.fstring(s);
}

function writeStructProp(
  w: BufferWriter,
  name: string,
  structType: string,
  inner: (w: BufferWriter) => void,
): void {
  w.fstring(name).fstring("StructProperty").int64LE(0).uint32LE(0);
  w.fstring(structType).guidZeros().uint8(0);
  inner(w);
  w.fstring("None"); // terminate the inner property map
}

/**
 * Write a StructProperty whose value is a special-cased struct type
 * (Guid, Vector, LinearColor, etc.). These don't end with a "None"
 * terminator — the reader consumes a fixed number of bytes.
 */
function writeSpecialStructProp(
  w: BufferWriter,
  name: string,
  structType: string,
  inner: (w: BufferWriter) => void,
): void {
  w.fstring(name).fstring("StructProperty").int64LE(0).uint32LE(0);
  w.fstring(structType).guidZeros().uint8(0);
  inner(w);
}

/* -------------------------------------------------------------------------- */
/*  Fixture builders                                                          */
/* -------------------------------------------------------------------------- */

export interface FixturePalSpec {
  characterId: string;
  level: number;
  passives: string[];
  ownerGuidZero?: boolean; // whether to include OwnerPlayerUId (default true)
  isPlayer?: boolean;
  nickname?: string;
  gender?: "male" | "female";
}

/**
 * Build a synthetic GVAS payload (post-decompression, pre-PlZ-wrapping) with
 * a `worldSaveData` containing a `CharacterSaveParameterMap` of the supplied
 * Pals. Useful for testing the extractor in isolation.
 */
export function buildSyntheticGvasPayload(pals: FixturePalSpec[]): Uint8Array {
  const w = new BufferWriter();
  // Header
  w.uint8(0x47).uint8(0x56).uint8(0x41).uint8(0x53); // "GVAS"
  w.int32LE(2); // saveGameFileVersion
  w.int32LE(0); // packageFileUE4Version
  // No UE5 version field (saveGameFileVersion < 3)
  w.uint16LE(5).uint16LE(1).uint16LE(1); // engine 5.1.1
  w.uint32LE(0); // changelist
  w.fstring("++UE5+Release-5.1");
  w.int32LE(0); // custom format count
  w.fstring("PalSaveGame");

  // Root: { worldSaveData: Struct { CharacterSaveParameterMap: Map<Guid, Struct> } }
  writeStructProp(w, "worldSaveData", "PalWorldSaveData", (ww) => {
    // MapProperty
    ww.fstring("CharacterSaveParameterMap")
      .fstring("MapProperty")
      .int64LE(0)
      .uint32LE(0);
    ww.fstring("StructProperty"); // key type
    ww.fstring("StructProperty"); // value type
    ww.uint8(0); // optional guid byte
    ww.uint32LE(0); // num removed
    ww.uint32LE(pals.length);
    for (const pal of pals) {
      // Key: a Guid struct (we use zeros)
      ww.bytes(new Uint8Array(16));
      // Value: a struct holding our SaveParameter directly under "object"
      writePalEntry(ww, pal);
      // Terminate the value's outer map.
      ww.fstring("None");
    }
  });

  w.fstring("None");
  return w.build();
}

function writePalEntry(w: BufferWriter, pal: FixturePalSpec): void {
  // Inline value layout: a property map. Top-level field is "object" of struct
  // type containing "SaveParameter".
  writeStructProp(w, "object", "PalObjectSaveData", (oo) => {
    writeStructProp(oo, "SaveParameter", "PalIndividualCharacterSaveParameter", (sp) => {
      writeNameProp(sp, "CharacterID", pal.characterId);
      writeIntProp(sp, "Level", pal.level);
      if (pal.nickname !== undefined) writeStrProp(sp, "NickName", pal.nickname);
      if (pal.gender !== undefined) {
        writeEnumProp(sp, "Gender", "EPalGenderType", `EPalGenderType::${pal.gender === "male" ? "Male" : "Female"}`);
      }
      writeArrayOfNamesProp(sp, "PassiveSkillList", pal.passives);
      if (pal.ownerGuidZero !== false) {
        // The reader's special-cased "Guid" struct path consumes exactly
        // 16 bytes — no property-map terminator.
        writeSpecialStructProp(sp, "OwnerPlayerUId", "Guid", (g) => {
          g.bytes(new Uint8Array(16));
        });
      }
      if (pal.isPlayer) writeBoolProp(sp, "IsPlayer", true);
    });
  });
}

/**
 * Wrap a payload in a PlZ container. `version` controls which decompression
 * branch the parser hits. v0 = single zlib pass.
 */
export function wrapPlZ(payload: Uint8Array, version: 0 | 1 | 2 = 0): Uint8Array {
  const onceCompressed = pako.deflate(payload);
  const finalCompressed = version === 0 ? onceCompressed : pako.deflate(onceCompressed);
  const out = new Uint8Array(12 + finalCompressed.byteLength);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, payload.byteLength, true);
  dv.setUint32(4, finalCompressed.byteLength, true);
  out[8] = 0x50; // P
  out[9] = 0x4c; // L
  out[10] = 0x5a; // Z
  out[11] = version;
  out.set(finalCompressed, 12);
  return out;
}

/** Convenience: synth payload → PlZ-wrapped buffer. */
export function buildSyntheticSave(
  pals: FixturePalSpec[],
  containerVersion: 0 | 1 | 2 = 0,
): ArrayBuffer {
  const payload = buildSyntheticGvasPayload(pals);
  const wrapped = wrapPlZ(payload, containerVersion);
  return (wrapped.buffer as ArrayBuffer).slice(
    wrapped.byteOffset,
    wrapped.byteOffset + wrapped.byteLength,
  );
}
