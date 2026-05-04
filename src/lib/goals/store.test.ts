import { describe, expect, it } from "vitest";
import {
  addGoal,
  emptyGoals,
  loadGoals,
  removeGoal,
  saveGoals,
  STORAGE_KEY,
} from "./store";
import type { StorageLike } from "@/lib/roster";

const NOW = new Date("2026-05-03T12:00:00.000Z");

function memStorage(initial: Record<string, string> = {}): StorageLike {
  const store = { ...initial };
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k]! : null),
    setItem: (k, v) => {
      store[k] = v;
    },
    removeItem: (k) => {
      delete store[k];
    },
  };
}

describe("emptyGoals", () => {
  it("starts versioned with no goals", () => {
    const g = emptyGoals(NOW);
    expect(g.version).toBe(1);
    expect(g.goals).toEqual([]);
    expect(g.updatedAt).toBe(NOW.toISOString());
  });
});

describe("addGoal", () => {
  it("appends with a generated id and dedup'd passives", () => {
    const next = addGoal(
      emptyGoals(NOW),
      {
        name: "Anubis Stack",
        targetPalId: "anubis",
        desiredPassives: ["lucky", "lucky", "swift"],
      },
      NOW,
    );
    expect(next.goals).toHaveLength(1);
    expect(next.goals[0]!.targetPalId).toBe("anubis");
    expect(next.goals[0]!.desiredPassives).toEqual(["lucky", "swift"]);
    expect(next.goals[0]!.id).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("falls back to 'Untitled goal' for empty/whitespace names", () => {
    const next = addGoal(emptyGoals(), {
      name: "   ",
      targetPalId: "anubis",
      desiredPassives: [],
    });
    expect(next.goals[0]!.name).toBe("Untitled goal");
  });

  it("caps passives at 4", () => {
    const next = addGoal(emptyGoals(), {
      name: "x",
      targetPalId: "y",
      desiredPassives: ["a", "b", "c", "d", "e", "f"],
    });
    expect(next.goals[0]!.desiredPassives).toHaveLength(4);
  });
});

describe("removeGoal", () => {
  it("removes by id, no-ops if not found", () => {
    const a = addGoal(emptyGoals(), { name: "a", targetPalId: "x", desiredPassives: [] });
    const id = a.goals[0]!.id;
    const after = removeGoal(a, id);
    expect(after.goals).toEqual([]);
    expect(removeGoal(after, "nope")).toBe(after);
  });
});

describe("save + load", () => {
  it("round-trips", () => {
    const mem = memStorage();
    const initial = addGoal(emptyGoals(NOW), {
      name: "x",
      targetPalId: "y",
      desiredPassives: ["lucky"],
    });
    expect(saveGoals(initial, mem)).toBe(true);
    const back = loadGoals(mem);
    expect(back).toEqual(initial);
  });

  it("loadGoals returns empty when storage missing/corrupt", () => {
    expect(loadGoals(undefined).goals).toEqual([]);
    const bad = memStorage({ [STORAGE_KEY]: "{not json" });
    expect(loadGoals(bad).goals).toEqual([]);
    const wrongShape = memStorage({ [STORAGE_KEY]: JSON.stringify({ version: 1 }) });
    expect(loadGoals(wrongShape).goals).toEqual([]);
  });

  it("rejects unknown version", () => {
    const future = memStorage({
      [STORAGE_KEY]: JSON.stringify({
        version: 99,
        goals: [],
        updatedAt: NOW.toISOString(),
      }),
    });
    expect(loadGoals(future).goals).toEqual([]);
  });
});
