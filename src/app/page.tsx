"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { BreedingResult } from "@/components/BreedingResult";
import { PalSelect } from "@/components/PalSelect";
import { allCombos } from "@/lib/data/combos";
import { allPals } from "@/lib/data/pals";
import { breedDetailed } from "@/lib/breeding/engine";
import type { Pal } from "@/types/pal";

export default function HomePage() {
  const [parentA, setParentA] = useState<Pal | null>(null);
  const [parentB, setParentB] = useState<Pal | null>(null);

  const result = useMemo(() => {
    if (!parentA || !parentB) return null;
    try {
      return breedDetailed(parentA, parentB, {
        pals: [...allPals],
        combos: [...allCombos],
      });
    } catch (err) {
      console.error(err);
      return null;
    }
  }, [parentA, parentB]);

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Breeding calculator
        </h1>
        <p className="mt-1 max-w-prose text-sm text-[rgb(var(--muted))]">
          Pick two parents and we&apos;ll show you the resulting Pal. Special
          breeding combinations are matched first; otherwise the result is the
          breedable Pal closest in power value.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <PalSelect
          label="Parent A"
          pals={allPals}
          value={parentA}
          onChange={setParentA}
        />
        <PalSelect
          label="Parent B"
          pals={allPals}
          value={parentB}
          onChange={setParentB}
        />
      </section>

      <section>
        <BreedingResult
          child={result?.child ?? null}
          source={result?.source ?? null}
        />
      </section>

      <section
        className={
          "rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-4 " +
          "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
        }
      >
        <div>
          <h2 className="text-base font-semibold">Planning a specific Pal?</h2>
          <p className="text-sm text-[rgb(var(--muted))]">
            Reverse-lookup every parent pair, ranked by obtainability, with
            passive-inheritance probabilities and expected egg counts.
          </p>
        </div>
        <Link
          href="/plan"
          className={
            "inline-flex shrink-0 items-center justify-center rounded-md border " +
            "border-[rgb(var(--border))] bg-[rgb(var(--background))] px-4 py-2 text-sm font-medium " +
            "hover:border-[rgb(var(--ring))]"
          }
        >
          Plan a Breed →
        </Link>
      </section>
    </div>
  );
}
