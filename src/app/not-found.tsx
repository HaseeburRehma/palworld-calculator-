import type { Metadata } from "next";
import Link from "next/link";

import { Card } from "@/components/ui/Card";
import { POPULAR_PAL_SLUGS } from "@/lib/seo/constants";
import { allPals, getPalBySlug } from "@/lib/data/pals";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Page not found",
  description:
    "The page you were looking for doesn't exist. Try the calculator, browse the popular Pals below, or use the search.",
  canonical: "/404",
  noindex: true,
});

export default function NotFound() {
  const popular = POPULAR_PAL_SLUGS.map((s) => getPalBySlug(s)).filter(
    (p): p is NonNullable<typeof p> => Boolean(p),
  );

  // Surfacing all Pals here is overkill, so we cap at the popular set + a
  // few same-Paldex-bucket ones if popular is short on real data.
  const fallback = allPals.slice(0, 8);
  const links = popular.length > 0 ? popular : fallback;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Page not found
        </h1>
        <p className="mt-1 max-w-prose text-sm text-[rgb(var(--muted))]">
          We couldn&apos;t find the page you were looking for. It may have moved
          or never existed. Try the calculator on the home page, or jump to a
          popular Pal below.
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/"
          className={
            "rounded-md bg-[rgb(var(--foreground))] px-3 py-1.5 text-sm font-medium " +
            "text-[rgb(var(--background))]"
          }
        >
          Go to the calculator
        </Link>
        <Link
          href="/plan"
          className="rounded-md border border-[rgb(var(--border))] px-3 py-1.5 text-sm hover:border-[rgb(var(--ring))]"
        >
          Plan a breed
        </Link>
        <Link
          href="/faq"
          className="rounded-md border border-[rgb(var(--border))] px-3 py-1.5 text-sm hover:border-[rgb(var(--ring))]"
        >
          FAQ
        </Link>
      </div>

      <Card>
        <h2 className="text-base font-semibold">Popular Pals</h2>
        <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {links.map((p) => (
            <li key={p.id}>
              <Link
                href={`/pals/${p.slug}`}
                className="block rounded-md border border-[rgb(var(--border))] p-2 text-sm hover:border-[rgb(var(--ring))]"
              >
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-[rgb(var(--muted))]">
                  #{String(p.paldexNo).padStart(3, "0")}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
