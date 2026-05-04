import { describe, expect, it } from "vitest";
import {
  addPal,
  emptyRoster,
  exportRoster,
  importRoster,
  loadRoster,
  removePal,
  saveRoster,
  STORAGE_KEY,
  updatePal,
  type StorageLike,
} from "./store";

const FIXED_NOW = new Date("2026-05-03T12:00:00.000Z");

function makeMemStorage(initial: Record<string, string> = {}): StorageLike & {
  inspect: () => Record<string, string>;
  forceThrow: (mode: "read" | "write" | null) => void;
} {
  const store = { ...initial };
  let throwMode: "read" | "write" | null = null;
  return {
    getItem(k) {
      if (throwMode === "read") throw new Error("storage read failed");
      return Object.prototype.hasOwnProperty.call(store, k) ? store[k]! : null;
    },
    setItem(k, v) {
      if (throwMode === "write") throw new Error("storage write failed");
      store[k] = v;
    },
    removeItem(k) {
      delete store[k];
    },
    inspect: () => ({ ...store }),
    forceThrow: (mode) => {
      throwMode = mode;
    },
  };
}

describe("emptyRoster", () => {
  it("is v1 with empty pals and a current ISO timestamp", () => {
    const r = emptyRoster(FIXED_NOW);
    expect(r.version).toBe(1);
    expect(r.pals).toEqual([]);
    expect(r.updatedAt).toBe(FIXED_NOW.toISOString());
  });
});

describe("addPal", () => {
  it("appends a new instance with a generated id and dedup'd passives", () => {
    const start = emptyRoster(FIXED_NOW);
    const next = addPal(
      start,
      { palId: "lamball", passives: ["lucky", "lucky", "swift"] },
      FIXED_NOW,
    );
    expect(next.pals).toHaveLength(1);
    const added = next.pals[0]!;
    expect(added.palId).toBe("lamball");
    expect(added.passives).toEqual(["lucky", "swift"]);
    expect(added.instanceId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(next.updatedAt).toBe(FIXED_NOW.toISOString());
  });

  it("trims nickname/notes; coerces empty strings to undefined", () => {
    const next = addPal(
      emptyRoster(),
      { palId: "lamball", nickname: "  Cloud  ", notes: " " },
    );
    expect(next.pals[0]!.nickname).toBe("Cloud");
    expect(next.pals[0]!.notes).toBeUndefined();
  });

  it("caps passives at 4 (drops the overflow)", () => {
    const next = addPal(emptyRoster(), {
      palId: "lamball",
      passives: ["a", "b", "c", "d", "e", "f"],
    });
    expect(next.pals[0]!.passives).toEqual(["a", "b", "c", "d"]);
  });
});

describe("removePal", () => {
  it("removes by instanceId, no-ops when not found", () => {
    const a = addPal(emptyRoster(), { palId: "lamball" });
    const b = addPal(a, { palId: "cattiva" });
    const remId = b.pals[0]!.instanceId;
    const after = removePal(b, remId);
    expect(after.pals.map((p) => p.palId)).toEqual(["cattiva"]);

    // No-op for unknown id — returns the SAME reference (cheap perf check).
    const after2 = removePal(after, "nope-id");
    expect(after2).toBe(after);
  });
});

describe("updatePal", () => {
  it("patches fields, dedupes passives, leaves others alone", () => {
    const start = addPal(emptyRoster(), { palId: "lamball", passives: ["a"] });
    const id = start.pals[0]!.instanceId;
    const updated = updatePal(start, id, {
      passives: ["a", "a", "b"],
      nickname: "Sparky",
    });
    expect(updated.pals[0]!.passives).toEqual(["a", "b"]);
    expect(updated.pals[0]!.nickname).toBe("Sparky");
    expect(updated.pals[0]!.palId).toBe("lamball");
  });

  it("no-ops on unknown id (returns same roster)", () => {
    const start = addPal(emptyRoster(), { palId: "lamball" });
    const out = updatePal(start, "missing-id", { nickname: "x" });
    expect(out).toBe(start);
  });
});

describe("export + import", () => {
  it("round-trips: import(export(x)) equals x", () => {
    const r = addPal(
      addPal(emptyRoster(FIXED_NOW), { palId: "lamball", passives: ["lucky"] }, FIXED_NOW),
      { palId: "cattiva" },
      FIXED_NOW,
    );
    const json = exportRoster(r);
    const back = importRoster(json);
    expect(back.ok).toBe(true);
    if (back.ok) {
      expect(back.roster).toEqual(r);
    }
  });

  it("rejects malformed JSON with a clear error", () => {
    const result = importRoster("not json");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]).toMatch(/Not valid JSON/);
    }
  });

  it("rejects rosters with the wrong shape", () => {
    const result = importRoster(JSON.stringify({ version: 1, pals: "no" }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it("rejects unknown keys (strict schema)", () => {
    const evil = JSON.stringify({
      version: 1,
      pals: [{ instanceId: "x", palId: "y", passives: [], surprise: "field" }],
      updatedAt: FIXED_NOW.toISOString(),
    });
    const result = importRoster(evil);
    expect(result.ok).toBe(false);
  });

  it("rejects v0 / future versions explicitly", () => {
    const result = importRoster(
      JSON.stringify({ version: 99, pals: [], updatedAt: FIXED_NOW.toISOString() }),
    );
    expect(result.ok).toBe(false);
  });
});

describe("loadRoster / saveRoster", () => {
  it("save + load round-trips through a storage adapter", () => {
    const mem = makeMemStorage();
    const r = addPal(emptyRoster(FIXED_NOW), { palId: "lamball" }, FIXED_NOW);
    expect(saveRoster(r, mem)).toBe(true);
    expect(JSON.parse(mem.inspect()[STORAGE_KEY]!)).toEqual(r);
    const back = loadRoster(mem);
    expect(back).toEqual(r);
  });

  it("loadRoster returns empty when storage is undefined", () => {
    const r = loadRoster(undefined);
    expect(r.pals).toEqual([]);
    expect(r.version).toBe(1);
  });

  it("loadRoster returns empty when stored JSON is corrupt", () => {
    const mem = makeMemStorage({ [STORAGE_KEY]: "{not valid" });
    expect(loadRoster(mem).pals).toEqual([]);
  });

  it("loadRoster returns empty when stored value fails schema", () => {
    const mem = makeMemStorage({
      [STORAGE_KEY]: JSON.stringify({ version: 1, pals: "wrong" }),
    });
    expect(loadRoster(mem).pals).toEqual([]);
  });

  it("loadRoster returns empty if storage throws on read (Safari private mode)", () => {
    const mem = makeMemStorage();
    mem.forceThrow("read");
    expect(loadRoster(mem).pals).toEqual([]);
  });

  it("saveRoster returns false if storage throws (quota)", () => {
    const mem = makeMemStorage();
    mem.forceThrow("write");
    expect(saveRoster(emptyRoster(), mem)).toBe(false);
  });

  it("saveRoster returns false when storage is undefined", () => {
    expect(saveRoster(emptyRoster(), undefined)).toBe(false);
  });
});
