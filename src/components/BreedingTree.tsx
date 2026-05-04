"use client";

/**
 * Breeding-tree visualization for a single BreedingPlan.
 *
 * The plan is a flat, topologically-ordered list of steps — each step has two
 * parents and one child. We render them as a vertical sequence of cards:
 *
 *   ┌──────────────┐  ┌──────────────┐
 *   │ Parent A     │  │ Parent B     │
 *   └──────┬───────┘  └──────┬───────┘
 *          └──── breed ──────┘
 *                  ↓
 *           ┌──────────────┐
 *           │ Child        │
 *           └──────────────┘
 *
 * Custom layout, no graph lib — the structure is too regular to need one,
 * and anything off-the-shelf would look generic.
 */

import { useState } from "react";

import { ElementBadge } from "./ElementBadge";
import { PalImage } from "./PalImage";
import { PassiveBadge } from "./PassiveBadge";
import { getPalById } from "@/lib/data/pals";
import { getPassiveById } from "@/lib/data/passives";
import type { BreedingPlan, BreedingStep, OwnedPal } from "@/types/pal";

interface Props {
  plan: BreedingPlan;
  /** Roster instance map — used to flag which Pals are from the user's collection. */
  roster?: ReadonlyArray<OwnedPal>;
}

export function BreedingTree({ plan, roster }: Props) {
  const rosterById = new Map((roster ?? []).map((o) => [o.instanceId, o] as const));

  if (plan.steps.length === 0) {
    return (
      <p className="text-sm text-[rgb(var(--muted))]">
        Already in your roster — no breeding needed.
      </p>
    );
  }

  return (
    <ol className="space-y-3" aria-label="Breeding steps in order">
      {plan.steps.map((step, idx) => (
        <StepCard
          key={`${idx}-${step.parentA.palId}-${step.parentB.palId}`}
          step={step}
          index={idx + 1}
          rosterById={rosterById}
        />
      ))}
    </ol>
  );
}

function StepCard({
  step,
  index,
  rosterById,
}: {
  step: BreedingStep;
  index: number;
  rosterById: ReadonlyMap<string, OwnedPal>;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <li className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs uppercase tracking-wide text-[rgb(var(--muted))]">
          Step {index}
        </h3>
        <button
          type="button"
          onClick={() => setExpanded((s) => !s)}
          className="text-xs text-[rgb(var(--muted))] hover:underline"
          aria-expanded={expanded}
        >
          {expanded ? "Hide details" : "Why this step?"}
        </button>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-3">
        <ParentSlot side="A" parent={step.parentA} rosterById={rosterById} />
        <ParentSlot side="B" parent={step.parentB} rosterById={rosterById} />
      </div>

      <div className="my-2 flex items-center justify-center text-xs text-[rgb(var(--muted))]">
        <span aria-hidden>↓ breed ↓</span>
      </div>

      <ChildSlot child={step.child} />

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-[rgb(var(--border))] pt-2 text-xs">
        <div className="flex justify-between">
          <dt className="text-[rgb(var(--muted))]">Probability</dt>
          <dd className="tabular-nums">{formatProbability(step.probability)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-[rgb(var(--muted))]">Expected eggs</dt>
          <dd className="tabular-nums">{formatEggs(step.expectedEggs)}</dd>
        </div>
      </dl>

      {step.notes && (
        <p className="mt-2 text-xs text-[rgb(var(--muted))]">{step.notes}</p>
      )}

      {expanded && (
        <div className="mt-3 space-y-2 rounded-md bg-[rgb(var(--background))] p-3 text-xs text-[rgb(var(--muted))]">
          <p>
            This pair was chosen because it produces{" "}
            <strong>{getPalById(step.child.palId)?.name ?? step.child.palId}</strong>{" "}
            and the parents&apos; combined passive pool covers{" "}
            <strong>
              {step.parentA.requiredPassives.length +
                step.parentB.requiredPassives.length}
            </strong>{" "}
            of your desired passives.
          </p>
          <p>
            Required passives carried into this breed: parent A —{" "}
            {step.parentA.requiredPassives.length === 0
              ? "none"
              : step.parentA.requiredPassives.join(", ")}
            ; parent B —{" "}
            {step.parentB.requiredPassives.length === 0
              ? "none"
              : step.parentB.requiredPassives.join(", ")}
            .
          </p>
        </div>
      )}
    </li>
  );
}

function ParentSlot({
  side,
  parent,
  rosterById,
}: {
  side: "A" | "B";
  parent: BreedingStep["parentA"];
  rosterById: ReadonlyMap<string, OwnedPal>;
}) {
  const pal = getPalById(parent.palId);
  const ownInstance = parent.instanceId ? rosterById.get(parent.instanceId) : undefined;
  if (!pal) {
    return (
      <div className="rounded-md border border-[rgb(var(--border))] p-2 text-xs text-[rgb(var(--muted))]">
        Unknown Pal: {parent.palId}
      </div>
    );
  }
  const isFromRoster = parent.instanceId !== undefined;
  return (
    <div
      className={
        "flex items-start gap-2 rounded-md border p-2 " +
        (isFromRoster
          ? "border-emerald-500/40 bg-emerald-500/5"
          : "border-[rgb(var(--border))]")
      }
    >
      <PalImage pal={pal} />
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wide text-[rgb(var(--muted))]">
          Parent {side}
          {isFromRoster && (
            <span className="ml-1.5 rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] tracking-normal text-emerald-700 dark:text-emerald-300">
              roster
            </span>
          )}
        </div>
        <div className="truncate text-sm font-medium">
          {ownInstance?.nickname ? `${pal.name} "${ownInstance.nickname}"` : pal.name}
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {pal.elements.map((e) => (
            <ElementBadge key={e} element={e} />
          ))}
        </div>
        {parent.requiredPassives.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {parent.requiredPassives.map((id) => {
              const passive = getPassiveById(id);
              if (!passive) return null;
              return <PassiveBadge key={id} passive={passive} compact />;
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ChildSlot({ child }: { child: BreedingStep["child"] }) {
  const pal = getPalById(child.palId);
  if (!pal) {
    return (
      <div className="rounded-md border border-dashed border-[rgb(var(--border))] p-2 text-xs text-[rgb(var(--muted))]">
        Unknown Pal: {child.palId}
      </div>
    );
  }
  return (
    <div className="mx-auto flex max-w-md items-start gap-2 rounded-md border border-[rgb(var(--ring))] bg-[rgb(var(--background))] p-2">
      <PalImage pal={pal} />
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wide text-[rgb(var(--muted))]">
          Child
        </div>
        <div className="truncate text-sm font-medium">{pal.name}</div>
        <div className="mt-1 flex flex-wrap gap-1">
          {pal.elements.map((e) => (
            <ElementBadge key={e} element={e} />
          ))}
        </div>
        {child.targetPassives.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {child.targetPassives.map((id) => {
              const passive = getPassiveById(id);
              if (!passive) return null;
              return <PassiveBadge key={id} passive={passive} compact />;
            })}
          </div>
        )}
      </div>
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
