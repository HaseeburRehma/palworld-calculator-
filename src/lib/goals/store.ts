/**
 * Goals store — same pattern as `lib/roster/store.ts`, separate localStorage
 * key, separate schema. Goals are user-saved targets they want to re-plan
 * against as the roster grows.
 *
 * Pure functions over `GoalsStore` values, plus thin localStorage adapters.
 */

import { z } from "zod";

import type { Goal, GoalsStore } from "@/types/pal";
import { newUuid } from "@/lib/util/uuid";
import type { StorageLike } from "@/lib/roster";
import { safeStorage } from "@/lib/roster";

export const STORAGE_KEY = "palworld-goals-v1";

const GoalSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1).max(120),
    targetPalId: z.string().min(1),
    desiredPassives: z.array(z.string().min(1)).max(4),
    createdAt: z.string().datetime(),
  })
  .strict();

const GoalsV1Schema = z
  .object({
    version: z.literal(1),
    goals: z.array(GoalSchema),
    updatedAt: z.string().datetime(),
  })
  .strict();

export function emptyGoals(now: Date = new Date()): GoalsStore {
  return { version: 1, goals: [], updatedAt: now.toISOString() };
}

export interface AddGoalInput {
  name: string;
  targetPalId: string;
  desiredPassives: string[];
}

export function addGoal(
  store: GoalsStore,
  input: AddGoalInput,
  now: Date = new Date(),
): GoalsStore {
  const goal: Goal = {
    id: newUuid(),
    name: input.name.trim() || "Untitled goal",
    targetPalId: input.targetPalId,
    desiredPassives: dedupe(input.desiredPassives).slice(0, 4),
    createdAt: now.toISOString(),
  };
  return {
    ...store,
    goals: [...store.goals, goal],
    updatedAt: now.toISOString(),
  };
}

export function removeGoal(store: GoalsStore, id: string, now: Date = new Date()): GoalsStore {
  const next = store.goals.filter((g) => g.id !== id);
  if (next.length === store.goals.length) return store;
  return { ...store, goals: next, updatedAt: now.toISOString() };
}

export function loadGoals(storage: StorageLike | undefined = safeStorage()): GoalsStore {
  if (!storage) return emptyGoals();
  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return emptyGoals();
  }
  if (raw === null) return emptyGoals();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptyGoals();
  }
  const result = GoalsV1Schema.safeParse(parsed);
  if (!result.success) return emptyGoals();
  return result.data;
}

export function saveGoals(
  store: GoalsStore,
  storage: StorageLike | undefined = safeStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

function dedupe(ids: ReadonlyArray<string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (id && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}
