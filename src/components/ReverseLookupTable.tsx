"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import type { Pal, PassiveSkill } from "@/types/pal";
import { rankPairs, type RankedPair } from "@/lib/breeding/ranking";
import {
  expectedEggCount,
  probabilityOfAtLeastPassives,
} from "@/lib/breeding/passives";
import { ElementBadge } from "./ElementBadge";

interface Props {
  /** All known parent pairs that produce the target child. */
  pairs: ReadonlyArray<{ parentA: Pal; parentB: Pal }>;
  /** Optional desired passives — if provided, table also shows probability + eggs. */
  desiredPassives?: PassiveSkill[];
  /** Optional override for global passive count (defaults to lib constant). */
  globalPassiveCount?: number;
  /** Render at most N rows by default; user can expand. */
  initialLimit?: number;
}

type SortKey = "obtainability" | "expectedEggs";

/**
 * Ranked list of parent pairs. Defaults to top 10; "show all" expands.
 *
 * When `desiredPassives` is non-empty, two extra columns appear: probability
 * the child has all desired passives, and expected egg count.
 */
export function ReverseLookupTable({
  pairs,
  desiredPassives,
  globalPassiveCount,
  initialLimit = 10,
}: Props) {
  const [showAll, setShowAll] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>(
    desiredPassives && desiredPassives.length > 0 ? "expectedEggs" : "obtainability",
  );

  const ranked = useMemo<Array<RankedPair<Pal> & { eggs?: number; prob?: number }>>(() => {
    const base = rankPairs(pairs);
    if (!desiredPassives || desiredPassives.length === 0) return base;

    // Phase 1 placeholder: until per-Pal natural passives are scraped, we treat
    // every Pal as starting with no fixed passives. The math still runs — it
    // just falls back to wild-roll territory. Once data/pals.json includes
    // per-Pal `passiveTraits`, this is where to plug it in.
    const enriched = base.map((row) => {
      const aPassives = row.parentA.passiveTraits
        ? toPassiveStubs(row.parentA.passiveTraits)
        : [];
      const bPassives = row.parentB.passiveTraits
        ? toPassiveStubs(row.parentB.passiveTraits)
        : [];
      const prob = probabilityOfAtLeastPassives(aPassives, bPassives, desiredPassives, {
        globalPassiveCount,
      });
      const eggs = expectedEggCount(aPassives, bPassives, desiredPassives, {
        globalPassiveCount,
      });
      return { ...row, prob, eggs };
    });

    if (sortBy === "expectedEggs") {
      enriched.sort((a, b) => (a.eggs ?? Infinity) - (b.eggs ?? Infinity));
    }
    return enriched;
  }, [pairs, desiredPassives, globalPassiveCount, sortBy]);

  const visible = showAll ? ranked : ranked.slice(0, initialLimit);
  const hasPassives = (desiredPassives?.length ?? 0) > 0;

  if (pairs.length === 0) {
    return (
      <p className="text-sm text-[rgb(var(--muted))]">
        No parent pairs known to produce this Pal in the current data.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[rgb(var(--muted))]">
        <span>
          {ranked.length} parent pair{ranked.length === 1 ? "" : "s"}
        </span>
        {hasPassives && (
          <label className="flex items-center gap-1.5">
            Sort by:
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="rounded border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-1 py-0.5"
            >
              <option value="expectedEggs">Expected eggs</option>
              <option value="obtainability">Obtainability</option>
            </select>
          </label>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-[rgb(var(--border))]">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[rgb(var(--border))] bg-[rgb(var(--background))] text-left text-xs uppercase tracking-wide text-[rgb(var(--muted))]">
              <th className="px-3 py-2 font-medium">Parent A</th>
              <th className="px-3 py-2 font-medium">Parent B</th>
              {hasPassives && (
                <>
                  <th className="px-3 py-2 text-right font-medium">Probability</th>
                  <th className="px-3 py-2 text-right font-medium">Expected eggs</th>
                </>
              )}
              <th className="px-3 py-2 text-right font-medium">Score</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row, idx) => (
              <tr
                key={`${row.parentA.id}-${row.parentB.id}-${idx}`}
                className="border-t border-[rgb(var(--border))] hover:bg-[rgb(var(--background))]"
              >
                <td className="px-3 py-2">
                  <ParentCell pal={row.parentA} />
                </td>
                <td className="px-3 py-2">
                  <ParentCell pal={row.parentB} />
                </td>
                {hasPassives && (
                  <>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatProbability(row.prob ?? 0)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatEggs(row.eggs ?? Infinity)}
                    </td>
                  </>
                )}
                <td
                  className="px-3 py-2 text-right tabular-nums text-xs text-[rgb(var(--muted))]"
                  title={`paldex ${row.breakdown.paldex.toFixed(1)}, sameElement ${row.breakdown.sameElement}, breedOnly ${row.breakdown.breedOnly}, variant ${row.breakdown.variant}`}
                >
                  {row.score.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {ranked.length > initialLimit && (
        <button
          type="button"
          onClick={() => setShowAll((s) => !s)}
          className="text-sm font-medium text-[rgb(var(--foreground))] hover:underline"
        >
          {showAll ? "Show top 10" : `Show all ${ranked.length}`}
        </button>
      )}
    </div>
  );
}

function ParentCell({ pal }: { pal: Pal }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={`/pals/${pal.slug}`} className="font-medium hover:underline">
        {pal.name}
      </Link>
      <span className="text-xs text-[rgb(var(--muted))]">
        #{String(pal.paldexNo).padStart(3, "0")}
      </span>
      <span className="flex gap-1">
        {pal.elements.map((e) => (
          <ElementBadge key={e} element={e} />
        ))}
      </span>
      {pal.breedOnly && (
        <span
          className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-300"
          title="This Pal can only be obtained through breeding."
        >
          breed-only
        </span>
      )}
    </div>
  );
}

function formatProbability(p: number): string {
  if (p === 0) return "—";
  if (p < 0.0001) return "<0.01%";
  return `${(p * 100).toFixed(p < 0.01 ? 3 : p < 0.1 ? 2 : 1)}%`;
}

function formatEggs(eggs: number): string {
  if (!Number.isFinite(eggs)) return "∞";
  const n = Math.ceil(eggs);
  if (n > 500) return "500+";
  if (n < 1) return "<1";
  return String(n);
}

/**
 * Inflate string ids into a minimal PassiveSkill stub. The math only reads
 * `id`, so the rest is ignored; once per-Pal `passiveTraits` lands as full
 * objects this can be removed.
 */
function toPassiveStubs(ids: ReadonlyArray<string>): PassiveSkill[] {
  return ids.map((id) => ({
    id,
    name: id,
    tier: "neutral",
    rank: 1,
    effect: "",
  }));
}
