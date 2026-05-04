import Link from "next/link";
import type { Pal } from "@/types/pal";
import { ElementBadge } from "./ElementBadge";
import { PalImage } from "./PalImage";

interface Props {
  pal: Pal;
  /** When true, render the name as a link to the Pal's detail page. */
  linkToDetail?: boolean;
  /** Optional label shown above the Pal (e.g. "Parent A", "Result"). */
  label?: string;
}

/**
 * A reusable Pal display card. Used in both forward-lookup results and
 * the per-Pal detail page header.
 */
export function PalCard({ pal, linkToDetail = false, label }: Props) {
  return (
    <article
      className={
        "flex items-center gap-4 rounded-lg border border-[rgb(var(--border))] " +
        "bg-[rgb(var(--card))] p-4"
      }
      aria-label={label ? `${label}: ${pal.name}` : pal.name}
    >
      <PalImage pal={pal} />
      <div className="min-w-0 flex-1">
        {label && (
          <div className="text-xs uppercase tracking-wide text-[rgb(var(--muted))]">
            {label}
          </div>
        )}
        <h3 className="truncate text-lg font-semibold">
          {linkToDetail ? (
            <Link href={`/pals/${pal.slug}`} className="hover:underline">
              {pal.name}
            </Link>
          ) : (
            pal.name
          )}
        </h3>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[rgb(var(--muted))]">
          <span>#{String(pal.paldexNo).padStart(3, "0")}</span>
          <span aria-hidden>·</span>
          <span>Power {pal.powerValue}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {pal.elements.map((e) => (
            <ElementBadge key={e} element={e} />
          ))}
        </div>
      </div>
    </article>
  );
}

