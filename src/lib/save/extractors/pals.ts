/**
 * Pal extractor — walks the parsed GVAS root and collects player-owned
 * Pals into `ParsedPal[]`.
 *
 * Where to look (community-documented Palworld save shape):
 *
 *   root["worldSaveData"] (StructProperty: PalWorldSaveData)
 *     .CharacterSaveParameterMap (Map<Guid, struct>)
 *       each value is a struct with `RawData` (ArrayProperty<ByteProperty>)
 *       containing a nested PropertyMap (re-parse) with shape:
 *         .object.SaveParameter
 *           .CharacterID            (NameProperty: "Pal_Lamball" | …)
 *           .Gender                 (EnumProperty: "EPalGenderType::Male" | …)
 *           .Level                  (IntProperty)
 *           .NickName               (StrProperty, optional)
 *           .Talent_HP              (IntProperty, optional — IV)
 *           .Talent_Shot / Defense  (IntProperty, optional — IVs)
 *           .PassiveSkillList       (ArrayProperty<NameProperty>)
 *           .OwnerPlayerUId         (StructProperty: Guid)  ← presence implies player-owned
 *           .IsPlayer               (BoolProperty, on the player avatar Pal only)
 *
 * We tolerate the inner `RawData` blob being either:
 *   - an Array<ByteProperty> we re-parse as a property map, OR
 *   - already-decoded inline. The community has shipped both shapes across
 *     patches.
 *
 * Anything we don't recognize bubbles up as a warning, not a crash.
 */

import type { ParsedGvas } from "../gvas/types";
import {
  asArray,
  asInt,
  asMapEntries,
  asString,
  asStructFields,
  readPropertyMap,
} from "../gvas/properties";
import { BinaryReader } from "../gvas/reader";
import { mapRawIdToPalId } from "../mappings/pal-ids";
import { resolvePassives } from "./passives";

export interface ParsedPal {
  /** Game-internal id (e.g. "Pal_Lamball"). */
  rawId: string;
  /** Our `Pal.id`, or null when we couldn't map the raw id. */
  palId: string | null;
  /** Resolved passive ids — at most 4, deduplicated. */
  passives: string[];
  /** Number of raw passive ids the mapper didn't recognize on this Pal. */
  unmappedPassiveCount: number;
  level: number;
  gender?: "male" | "female";
  nickname?: string;
  ivs?: { hp: number; attack: number; defense: number };
  /** True for Pals owned by a player (excludes wild + base-only NPCs). */
  isPlayerOwned: boolean;
}

export interface ExtractionWarning {
  code: string;
  message: string;
  context?: unknown;
}

export interface ExtractionResult {
  pals: ParsedPal[];
  unmappedPalIds: string[];
  unmappedPassiveIds: string[];
  warnings: ExtractionWarning[];
}

export function extractPals(gvas: ParsedGvas): ExtractionResult {
  const warnings: ExtractionWarning[] = [];
  const out: ParsedPal[] = [];
  const unmappedPalIds = new Set<string>();
  const unmappedPassiveIds = new Set<string>();

  const worldSave = asStructFields(gvas.root.get("worldSaveData"));
  if (!worldSave) {
    warnings.push({
      code: "NO_WORLD_SAVE_DATA",
      message: "Save has no `worldSaveData` root property — not a player save?",
    });
    return { pals: out, unmappedPalIds: [], unmappedPassiveIds: [], warnings };
  }

  const characterMap = asMapEntries(worldSave.get("CharacterSaveParameterMap"));
  if (!characterMap) {
    warnings.push({
      code: "NO_CHARACTER_MAP",
      message: "`CharacterSaveParameterMap` missing or unexpected shape.",
    });
    return { pals: out, unmappedPalIds: [], unmappedPassiveIds: [], warnings };
  }

  for (const entry of characterMap) {
    const valueFields = asStructFields(entry.value);
    if (!valueFields) continue;

    // RawData is the meat in modern saves. Across patches it's been an
    // Array<Byte> (re-parse the bytes as a property map) and a pre-decoded
    // struct. Older / synthetic saves may put SaveParameter inline in the
    // value struct itself — fall back to that when RawData is absent.
    let inner = asStructFields(valueFields.get("RawData"));
    if (!inner) {
      const rawBytes = arrayOfBytes(valueFields.get("RawData"));
      if (rawBytes) {
        try {
          const reader = new BinaryReader(rawBytes);
          // Some variants prefix the blob with a uint32 group-id. Probe by
          // attempting a parse; on failure rewind and skip 4 bytes.
          try {
            inner = readPropertyMap(reader);
          } catch {
            const second = new BinaryReader(rawBytes);
            second.skip(4);
            inner = readPropertyMap(second);
          }
        } catch (e) {
          warnings.push({
            code: "RAWDATA_PARSE_FAILED",
            message: `Couldn't parse RawData for one Pal entry: ${(e as Error).message}`,
          });
          continue;
        }
      } else {
        inner = valueFields;
      }
    }

    if (!inner) continue;

    // The shape is `.object.SaveParameter` in modern saves; pre-2024 Q3
    // saves had it at the top level. Probe both.
    const saveParam =
      asStructFields(asStructFields(inner.get("object"))?.get("SaveParameter")) ??
      asStructFields(inner.get("SaveParameter")) ??
      inner;

    const rawId = asString(saveParam.get("CharacterID"));
    if (!rawId) continue;

    // Filter: only player-owned. The OwnerPlayerUId struct's presence is the
    // tell — wild Pals don't have one. The `IsPlayer` flag, if true, marks
    // the human player avatar — exclude that too.
    const ownerStruct = asStructFields(saveParam.get("OwnerPlayerUId"));
    const isPlayerAvatar = readBool(saveParam.get("IsPlayer"));
    const isPlayerOwned = ownerStruct !== undefined && !isPlayerAvatar;

    const passiveListRaw = asArray(saveParam.get("PassiveSkillList"))
      ?.map((v) => asString(v))
      .filter((s): s is string => Boolean(s)) ?? [];
    const resolved = resolvePassives(passiveListRaw);
    for (const id of passiveListRaw) {
      if (resolved.unmapped.includes(id)) unmappedPassiveIds.add(id);
    }

    const palId = mapRawIdToPalId(rawId);
    if (palId === null) unmappedPalIds.add(rawId);

    const pal: ParsedPal = {
      rawId,
      palId,
      passives: resolved.mapped,
      unmappedPassiveCount: resolved.unmapped.length,
      level: asInt(saveParam.get("Level")) ?? 1,
      gender: parseGender(asString(saveParam.get("Gender"))),
      nickname: asString(saveParam.get("NickName")) || undefined,
      ivs: parseIvs(saveParam),
      isPlayerOwned,
    };
    out.push(pal);
  }

  return {
    pals: out,
    unmappedPalIds: [...unmappedPalIds].sort(),
    unmappedPassiveIds: [...unmappedPassiveIds].sort(),
    warnings,
  };
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function arrayOfBytes(v: import("../gvas/types").PropertyValue | undefined): Uint8Array | null {
  if (!v) return null;
  if (v.kind === "array" && v.elementType === "ByteProperty") {
    const out = new Uint8Array(v.values.length);
    for (let i = 0; i < v.values.length; i++) {
      const item = v.values[i]!;
      if (item.kind === "byte") out[i] = typeof item.value === "number" ? item.value : 0;
      else if (item.kind === "int") out[i] = item.value & 0xff;
    }
    return out;
  }
  if (v.kind === "raw") return v.bytes;
  return null;
}

function readBool(v: import("../gvas/types").PropertyValue | undefined): boolean {
  return v?.kind === "bool" ? v.value : false;
}

function parseGender(value: string | undefined): "male" | "female" | undefined {
  if (!value) return undefined;
  if (value.includes("Male")) return "male";
  if (value.includes("Female")) return "female";
  return undefined;
}

function parseIvs(saveParam: import("../gvas/types").PropertyMap):
  | { hp: number; attack: number; defense: number }
  | undefined {
  const hp = asInt(saveParam.get("Talent_HP"));
  const attack = asInt(saveParam.get("Talent_Shot"));
  const defense = asInt(saveParam.get("Talent_Defense"));
  if (hp === undefined && attack === undefined && defense === undefined) return undefined;
  return {
    hp: hp ?? 0,
    attack: attack ?? 0,
    defense: defense ?? 0,
  };
}
