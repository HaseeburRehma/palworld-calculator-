import Link from "next/link";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Card } from "@/components/ui/Card";
import { listGuides } from "@/lib/guides";

export default function GuidesIndex() {
  const guides = listGuides();
  return (
    <div className="space-y-6">
      <Breadcrumbs
        crumbs={[
          { name: "Home", href: "/" },
          { name: "Guides", href: "/guides" },
        ]}
      />
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Guides</h1>
        <p className="mt-1 max-w-prose text-sm text-[rgb(var(--muted))]">
          Long-form articles on breeding mechanics, planning strategy, and
          specific high-value Pals.
        </p>
      </header>

      {guides.length === 0 ? (
        <Card className="text-center text-sm text-[rgb(var(--muted))]">
          <p className="font-medium text-[rgb(var(--foreground))]">No guides yet.</p>
          <p className="mt-1">
            Drop an <code>.mdx</code> file under <code>content/guides/</code> with a
            <em> title </em>, <em> description </em>, and <em> publishedAt </em> in
            the front matter — it&apos;ll show up here automatically.
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {guides.map((g) => (
            <li key={g.slug}>
              <Link
                href={`/guides/${g.slug}`}
                className="block rounded-md border border-[rgb(var(--border))] p-4 hover:border-[rgb(var(--ring))]"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-lg font-semibold">{g.title}</h2>
                  {g.featured && (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-300">
                      Featured
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-[rgb(var(--muted))]">{g.description}</p>
                <p className="mt-2 text-xs text-[rgb(var(--muted))]">
                  {new Date(g.publishedAt).toLocaleDateString()}
                  {g.author ? ` · ${g.author}` : null}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
