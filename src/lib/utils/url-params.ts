/**
 * URL-param helpers for shareable plans.
 *
 * Schema:
 *   /plan?target=<palSlug>&passives=<id1,id2,...>
 *
 * Pure utility — no React, no Next, no I/O. Easy to unit test.
 */

export interface PlanQuery {
  targetSlug: string | null;
  passiveIds: string[];
}

export function parsePlanQuery(search: URLSearchParams): PlanQuery {
  const target = search.get("target");
  const passivesRaw = search.get("passives") ?? "";
  const passiveIds = passivesRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return { targetSlug: target && target.length > 0 ? target : null, passiveIds };
}

export function serializePlanQuery(q: PlanQuery): string {
  const params = new URLSearchParams();
  if (q.targetSlug) params.set("target", q.targetSlug);
  if (q.passiveIds.length > 0) params.set("passives", q.passiveIds.join(","));
  const s = params.toString();
  return s ? `?${s}` : "";
}
