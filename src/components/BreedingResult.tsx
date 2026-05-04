import Link from "next/link";
import type { Pal } from "@/types/pal";
import { PalCard } from "./PalCard";

interface Props {
  child: Pal | null;
  source: "special-combo" | "power-value" | null;
}

/**
 * Displays the result of a breeding calculation, with an empty-state fallback.
 */
export function BreedingResult({ child, source }: Props) {
  if (!child) {
    return (
      <div
        className={
          "flex h-full flex-col items-center justify-center rounded-lg border " +
          "border-dashed border-[rgb(var(--border))] bg-[rgb(var(--card))] p-8 text-center"
        }
      >
        <p className="text-sm text-[rgb(var(--muted))]">
          Pick two parents to see the resulting Pal.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <PalCard pal={child} label="Result" linkToDetail />
      <div className="flex items-center justify-between text-xs text-[rgb(var(--muted))]">
        <span>
          {source === "special-combo"
            ? "Matched a special breeding combination."
            : "Calculated from average power value."}
        </span>
        <Link
          href={`/pals/${child.slug}`}
          className="font-medium text-[rgb(var(--foreground))] hover:underline"
        >
          View details →
        </Link>
      </div>
    </div>
  );
}
