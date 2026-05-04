"use client";

/**
 * Saved goals — what makes the calculator sticky. Each goal is a target Pal
 * and a desired passive set that the user wants to come back to as their
 * roster grows.
 */

import Link from "next/link";

import { Card } from "@/components/ui/Card";
import { ElementBadge } from "@/components/ElementBadge";
import { PalImage } from "@/components/PalImage";
import { PassiveBadge } from "@/components/PassiveBadge";
import { getPalById } from "@/lib/data/pals";
import { getPassiveById } from "@/lib/data/passives";
import { emptyGoals, loadGoals, removeGoal, saveGoals } from "@/lib/goals";
import { useHydratedStore } from "@/lib/util/useHydratedStore";
import { serializePlanQuery } from "@/lib/utils/url-params";
import type { Goal, GoalsStore, PassiveSkill } from "@/types/pal";

export default function GoalsPage() {
  const [store, setStore] = useHydratedStore<GoalsStore>(
    () => emptyGoals(),
    () => loadGoals(),
    (s) => {
      saveGoals(s);
    },
  );

  const handleRemove = (id: string) => setStore((s) => removeGoal(s, id));

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">My Goals</h1>
        <p className="mt-1 max-w-prose text-sm text-[rgb(var(--muted))]">
          Save target Pal + desired-passive combinations and re-plan them as your
          roster grows. Use &ldquo;Mark as goal&rdquo; on the{" "}
          <Link href="/plan" className="hover:underline">
            Plan a Breed
          </Link>{" "}
          page to add one.
        </p>
      </header>

      {store.goals.length === 0 ? (
        <Card className="text-center text-sm text-[rgb(var(--muted))]">
          <p className="mb-1 font-medium text-[rgb(var(--foreground))]">
            No goals saved yet.
          </p>
          <p>
            On the planner page, set a target and desired passives, then click{" "}
            <em>Mark as goal</em>. Goals are stored in your browser.
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {store.goals.map((goal) => (
            <GoalCard key={goal.id} goal={goal} onRemove={handleRemove} />
          ))}
        </ul>
      )}
    </div>
  );
}

function buildRosterModePlanHref(targetSlug: string, passiveIds: string[]): string {
  const base = serializePlanQuery({ targetSlug, passiveIds });
  const params = new URLSearchParams(base.startsWith("?") ? base.slice(1) : "");
  params.set("mode", "roster");
  return `/plan?${params.toString()}`;
}

function GoalCard({ goal, onRemove }: { goal: Goal; onRemove: (id: string) => void }) {
  const pal = getPalById(goal.targetPalId);
  const desiredObjs = goal.desiredPassives
    .map((id) => getPassiveById(id))
    .filter((p): p is PassiveSkill => Boolean(p));

  if (!pal) {
    return (
      <li>
        <Card className="text-sm text-[rgb(var(--muted))]">
          Unknown target Pal id <code>{goal.targetPalId}</code> —{" "}
          <button
            type="button"
            onClick={() => onRemove(goal.id)}
            className="text-rose-600 hover:underline dark:text-rose-400"
          >
            remove
          </button>
        </Card>
      </li>
    );
  }

  const planHref = buildRosterModePlanHref(pal.slug, goal.desiredPassives);

  return (
    <li>
      <Card className="space-y-2">
        <div className="flex items-center gap-3">
          <PalImage pal={pal} />
          <div className="min-w-0 flex-1">
            <div className="text-xs uppercase tracking-wide text-[rgb(var(--muted))]">
              {goal.name}
            </div>
            <div className="text-base font-semibold">{pal.name}</div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[rgb(var(--muted))]">
              <span>#{String(pal.paldexNo).padStart(3, "0")}</span>
              <span aria-hidden>·</span>
              <span>Saved {new Date(goal.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {pal.elements.map((e) => (
                <ElementBadge key={e} element={e} />
              ))}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <Link
              href={planHref}
              className={
                "rounded-md bg-[rgb(var(--foreground))] px-3 py-1.5 text-sm font-medium " +
                "text-[rgb(var(--background))]"
              }
            >
              Re-plan
            </Link>
            <button
              type="button"
              onClick={() => onRemove(goal.id)}
              className="text-xs text-rose-600 hover:underline dark:text-rose-400"
            >
              Remove
            </button>
          </div>
        </div>
        {desiredObjs.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-[rgb(var(--border))] pt-2 text-xs">
            <span className="text-[rgb(var(--muted))]">Desired passives:</span>
            {desiredObjs.map((p) => (
              <PassiveBadge key={p.id} passive={p} compact />
            ))}
          </div>
        )}
      </Card>
    </li>
  );
}
