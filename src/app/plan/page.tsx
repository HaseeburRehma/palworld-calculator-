"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { BreedingTree } from "@/components/BreedingTree";
import { PalCard } from "@/components/PalCard";
import { PalSelect } from "@/components/PalSelect";
import { PassiveSelect } from "@/components/PassiveSelect";
import { ReverseLookupTable } from "@/components/ReverseLookupTable";
import { Card } from "@/components/ui/Card";
import { allPals, getPalBySlug } from "@/lib/data/pals";
import { allPassives, totalPassiveCount } from "@/lib/data/passives";
import { getParentPairsFor } from "@/lib/data/reverse-index";
import { addGoal, loadGoals, saveGoals } from "@/lib/goals";
import { loadRoster } from "@/lib/roster";
import { createPathfindClient, type PathfindResult } from "@/lib/workers/pathfindClient";
import { parsePlanQuery, serializePlanQuery } from "@/lib/utils/url-params";
import { decodeRosterParam, encodeRosterParam } from "@/lib/utils/share-link";
import type { BreedingPlan, OwnedPal, Pal, PassiveSkill, Roster } from "@/types/pal";

type Mode = "any-parents" | "roster";

export default function PlanPage() {
  return (
    <Suspense fallback={<Card className="text-center text-sm text-[rgb(var(--muted))]">Loading planner...</Card>}>
      <PlanPageContent />
    </Suspense>
  );
}

function PlanPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Derive initial state from URL params (deep linking).
  const initial = useMemo(() => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    const q = parsePlanQuery(params);
    const target = q.targetSlug ? (getPalBySlug(q.targetSlug) ?? null) : null;
    const passives = q.passiveIds
      .map((id) => allPassives.find((p) => p.id === id))
      .filter((p): p is PassiveSkill => Boolean(p));
    const mode: Mode = (params.get("mode") as Mode | null) === "roster" ? "roster" : "any-parents";
    const sharedRoster = decodeRosterParam(params.get("r"));
    return { target, passives, mode, sharedRoster };
  }, [searchParams]);

  const [target, setTarget] = useState<Pal | null>(initial.target);
  const [passives, setPassives] = useState<PassiveSkill[]>(initial.passives);
  const [mode, setMode] = useState<Mode>(initial.mode);
  const [roster, setRoster] = useState<Roster | null>(null);
  const [plans, setPlans] = useState<BreedingPlan[]>([]);
  const [searchState, setSearchState] = useState<"idle" | "running" | "done" | "error">(
    "idle",
  );
  const [searchWarnings, setSearchWarnings] = useState<string[]>([]);
  const [searchProgress, setSearchProgress] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [savedGoalConfirmation, setSavedGoalConfirmation] = useState<string | null>(null);

  // Load roster once on mount: shared link wins, then localStorage.
  useEffect(() => {
    const fromUrl = initial.sharedRoster;
    setRoster(fromUrl ?? loadRoster());
  }, [initial.sharedRoster]);

  // Push state changes into the URL so plans are shareable.
  useEffect(() => {
    const next = serializePlanQuery({
      targetSlug: target?.slug ?? null,
      passiveIds: passives.map((p) => p.id),
    });
    const params = new URLSearchParams(next.startsWith("?") ? next.slice(1) : next);
    if (mode === "roster") params.set("mode", "roster");
    const finalQuery = params.toString();
    const desired = finalQuery ? `?${finalQuery}` : "";
    const current = searchParams?.toString() ? `?${searchParams.toString()}` : "";
    if (desired !== current) {
      router.replace(`/plan${desired}`, { scroll: false });
    }
  }, [target, passives, mode, router, searchParams]);

  const pairs = useMemo(() => {
    if (!target) return [];
    const palMap = new Map(allPals.map((p) => [p.id, p]));
    return getParentPairsFor(target.id)
      .map((p) => ({
        parentA: palMap.get(p.parentA),
        parentB: palMap.get(p.parentB),
      }))
      .filter(
        (p): p is { parentA: Pal; parentB: Pal } =>
          Boolean(p.parentA) && Boolean(p.parentB),
      );
  }, [target]);

  const rosterEmpty = (roster?.pals.length ?? 0) === 0;

  // Pathfind client — single instance per page.
  const clientRef = useRef<ReturnType<typeof createPathfindClient> | null>(null);
  useEffect(() => {
    clientRef.current = createPathfindClient();
    return () => {
      clientRef.current?.dispose();
      clientRef.current = null;
    };
  }, []);

  const cancelRef = useRef<(() => void) | null>(null);

  // Run the search whenever inputs change in roster mode.
  useEffect(() => {
    if (mode !== "roster" || !target || !roster || rosterEmpty) {
      setPlans([]);
      setSearchState("idle");
      setSearchWarnings([]);
      return;
    }
    const client = clientRef.current;
    if (!client) return;

    cancelRef.current?.();
    setSearchState("running");
    setSearchProgress(null);
    const slowTimer = setTimeout(() => {
      setSearchProgress("Searching breeding paths…");
    }, 200);

    const job = client.run(
      {
        roster: roster.pals,
        targetPalId: target.id,
        desiredPassiveIds: passives.map((p) => p.id),
      },
      { onProgress: (m) => setSearchProgress(m) },
    );
    cancelRef.current = job.cancel;

    job.promise
      .then((res: PathfindResult) => {
        clearTimeout(slowTimer);
        if (!res.completed) return; // cancelled — don't clobber UI
        setPlans(res.plans);
        setSearchWarnings(res.warnings);
        setSearchState("done");
        setSearchProgress(null);
      })
      .catch(() => {
        clearTimeout(slowTimer);
        setSearchState("error");
        setSearchProgress(null);
      });

    return () => {
      clearTimeout(slowTimer);
    };
  }, [mode, target, passives, roster, rosterEmpty]);

  const handleCancel = () => {
    cancelRef.current?.();
    setSearchState("idle");
    setSearchProgress(null);
  };

  const handleCopyShare = async () => {
    if (!roster) return;
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("mode", "roster");
    params.set("r", encodeRosterParam(roster));
    const url = `${window.location.origin}/plan?${params.toString()}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      // clipboard.writeText can reject; fall back: select an off-screen field.
      window.prompt("Copy this share link:", url);
    }
  };

  const handleMarkAsGoal = () => {
    if (!target) return;
    const goals = loadGoals();
    const next = addGoal(goals, {
      name: `${target.name}${passives.length > 0 ? " — " + passives.map((p) => p.name).join(", ") : ""}`,
      targetPalId: target.id,
      desiredPassives: passives.map((p) => p.id),
    });
    saveGoals(next);
    setSavedGoalConfirmation("Saved to /goals");
    setTimeout(() => setSavedGoalConfirmation(null), 2500);
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Plan a Breed</h1>
        <p className="mt-1 max-w-prose text-sm text-[rgb(var(--muted))]">
          Pick a target Pal and the passives you want. In <strong>Any parents</strong>{" "}
          mode you&apos;ll see every theoretical parent pair ranked by obtainability;
          in <strong>From my roster</strong> mode the planner finds the shortest
          breeding chain that uses Pals you actually own.
        </p>
      </header>

      <ModeToggle mode={mode} setMode={setMode} rosterEmpty={rosterEmpty} />

      <section className="grid gap-4 sm:grid-cols-2">
        <PalSelect
          label="Target Pal"
          pals={allPals}
          value={target}
          onChange={setTarget}
          placeholder="Search for the Pal you want…"
        />
        <PassiveSelect
          label="Desired passives"
          passives={allPassives}
          value={passives}
          onChange={setPassives}
        />
      </section>

      {!target ? (
        <Card className="text-center text-sm text-[rgb(var(--muted))]">
          Pick a target Pal to begin.
        </Card>
      ) : mode === "any-parents" ? (
        <section className="space-y-4">
          <PalCard pal={target} label="Target" />
          <ReverseLookupTable
            pairs={pairs}
            desiredPassives={passives}
            globalPassiveCount={totalPassiveCount}
          />
        </section>
      ) : (
        <RosterModeResults
          target={target}
          plans={plans}
          searchState={searchState}
          searchWarnings={searchWarnings}
          searchProgress={searchProgress}
          rosterEmpty={rosterEmpty}
          onCancel={handleCancel}
          onCopyShare={handleCopyShare}
          shareCopied={shareCopied}
          onMarkAsGoal={handleMarkAsGoal}
          savedGoalConfirmation={savedGoalConfirmation}
          roster={roster}
        />
      )}

      <p className="text-xs text-[rgb(var(--muted))]">
        Probability and egg counts use a community-estimated inheritance model.
        See{" "}
        <Link href="/" className="hover:underline">
          forward-lookup calculator
        </Link>{" "}
        and{" "}
        <Link href="/roster" className="hover:underline">
          roster
        </Link>
        .
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function ModeToggle({
  mode,
  setMode,
  rosterEmpty,
}: {
  mode: Mode;
  setMode: (m: Mode) => void;
  rosterEmpty: boolean;
}) {
  return (
    <div
      role="tablist"
      aria-label="Planning mode"
      className="inline-flex rounded-md border border-[rgb(var(--border))] p-0.5"
    >
      <ModeButton
        active={mode === "any-parents"}
        onClick={() => setMode("any-parents")}
        label="Any parents"
        title="Show every parent pair that breeds into your target."
      />
      <ModeButton
        active={mode === "roster"}
        onClick={() => setMode("roster")}
        disabled={rosterEmpty}
        label="From my roster"
        title={
          rosterEmpty
            ? "Add Pals to your roster first to use this mode."
            : "Find the shortest chain using Pals you own."
        }
      />
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  label,
  title,
  disabled = false,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  title: string;
  disabled?: boolean;
}) {
  return (
    <button
      role="tab"
      type="button"
      aria-selected={active}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={
        "rounded px-3 py-1 text-sm transition-colors " +
        (active
          ? "bg-[rgb(var(--foreground))] text-[rgb(var(--background))]"
          : "text-[rgb(var(--muted))] hover:text-[rgb(var(--foreground))]") +
        (disabled ? " cursor-not-allowed opacity-60 hover:text-[rgb(var(--muted))]" : "")
      }
    >
      {label}
    </button>
  );
}

/* -------------------------------------------------------------------------- */

function RosterModeResults({
  target,
  plans,
  searchState,
  searchWarnings,
  searchProgress,
  rosterEmpty,
  onCancel,
  onCopyShare,
  shareCopied,
  onMarkAsGoal,
  savedGoalConfirmation,
  roster,
}: {
  target: Pal;
  plans: BreedingPlan[];
  searchState: "idle" | "running" | "done" | "error";
  searchWarnings: string[];
  searchProgress: string | null;
  rosterEmpty: boolean;
  onCancel: () => void;
  onCopyShare: () => void;
  shareCopied: boolean;
  onMarkAsGoal: () => void;
  savedGoalConfirmation: string | null;
  roster: Roster | null;
}) {
  if (rosterEmpty) {
    return (
      <Card className="text-sm">
        <p>
          Your roster is empty.{" "}
          <Link href="/roster" className="font-medium hover:underline">
            Add Pals to your roster
          </Link>{" "}
          and come back to plan multi-step breeds.
        </p>
      </Card>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PalCard pal={target} label="Target" />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onMarkAsGoal}
            className="rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-3 py-1.5 text-sm hover:border-[rgb(var(--ring))]"
          >
            Mark as goal
          </button>
          <button
            type="button"
            onClick={onCopyShare}
            className="rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-3 py-1.5 text-sm hover:border-[rgb(var(--ring))]"
          >
            {shareCopied ? "Copied!" : "Copy share link"}
          </button>
        </div>
      </div>
      {savedGoalConfirmation && (
        <p className="text-xs text-emerald-700 dark:text-emerald-300">
          ✓ {savedGoalConfirmation}
        </p>
      )}
      <p className="text-[11px] text-[rgb(var(--muted))]">
        Sharing this link exposes which Pals are in your roster. No personal info, but
        worth knowing.
      </p>

      {searchState === "running" && searchProgress && (
        <div className="flex items-center gap-3 text-sm text-[rgb(var(--muted))]">
          <span>{searchProgress}</span>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-[rgb(var(--border))] px-2 py-0.5 text-xs hover:border-[rgb(var(--ring))]"
          >
            Cancel
          </button>
        </div>
      )}

      {searchWarnings.length > 0 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
          <ul className="list-disc space-y-1 pl-5">
            {searchWarnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {searchState === "done" && plans.length === 0 && searchWarnings.length === 0 && (
        <p className="text-sm text-[rgb(var(--muted))]">
          No breeding chain found within the depth limit. Try adding intermediate
          species to your roster.
        </p>
      )}

      {plans.length > 0 && (
        <div className="space-y-6">
          <details className="text-xs text-[rgb(var(--muted))]">
            <summary className="cursor-pointer hover:underline">
              How this works
            </summary>
            <p className="mt-2 max-w-prose">
              The planner runs a two-phase search: first it finds the shortest{" "}
              <em>species</em> path to your target through the breeding graph;
              then for each candidate path it computes the cheapest passive-stacking
              strategy using the same probability math the &ldquo;Any parents&rdquo; mode
              uses. The two phases are decoupled — solving them jointly is intractable.
              Plans are sorted by total expected eggs.
            </p>
          </details>
          {plans.map((plan, i) => (
            <PlanResult
              key={i}
              plan={plan}
              rank={i + 1}
              roster={roster?.pals ?? []}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function PlanResult({
  plan,
  rank,
  roster,
}: {
  plan: BreedingPlan;
  rank: number;
  roster: ReadonlyArray<OwnedPal>;
}) {
  return (
    <article className="space-y-3">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">
          Plan {rank}{" "}
          <span className="text-sm font-normal text-[rgb(var(--muted))]">
            · {plan.totalSteps} step{plan.totalSteps === 1 ? "" : "s"}
          </span>
        </h2>
        <div className="text-xs text-[rgb(var(--muted))]">
          ≈{Math.ceil(plan.totalExpectedEggs)} total eggs · final P ={" "}
          {(plan.finalProbability * 100).toFixed(plan.finalProbability < 0.01 ? 3 : 1)}%
        </div>
      </header>
      <BreedingTree plan={plan} roster={roster} />
      {plan.warnings.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-5 text-xs text-amber-700 dark:text-amber-300">
          {plan.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}
    </article>
  );
}
