import Link from "next/link";

import { breadcrumbSchema, jsonLd, type Crumb } from "@/lib/seo/structured-data";

interface Props {
  crumbs: ReadonlyArray<Crumb>;
}

/**
 * Visible breadcrumb trail + matching `BreadcrumbList` JSON-LD inlined on
 * the same component. Putting them together is intentional: if either is
 * missing, the SEO audit catches it; if either is wrong, both can be fixed
 * in one place.
 *
 * The last crumb is rendered as plain text (representing "you are here").
 * Earlier crumbs are linked. This is the form Google explicitly recommends.
 */
export function Breadcrumbs({ crumbs }: Props) {
  if (crumbs.length === 0) return null;
  return (
    <>
      <nav aria-label="Breadcrumb" className="text-xs text-[rgb(var(--muted))]">
        <ol className="flex flex-wrap items-center gap-1">
          {crumbs.map((c, i) => {
            const isLast = i === crumbs.length - 1;
            return (
              <li key={c.href} className="flex items-center gap-1">
                {i > 0 && <span aria-hidden>/</span>}
                {isLast ? (
                  <span aria-current="page" className="text-[rgb(var(--foreground))]">
                    {c.name}
                  </span>
                ) : (
                  <Link href={c.href} className="hover:underline">
                    {c.name}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      {/* eslint-disable-next-line @next/next/no-script-component-in-head */}
      <script {...jsonLd(breadcrumbSchema(crumbs))} />
    </>
  );
}
