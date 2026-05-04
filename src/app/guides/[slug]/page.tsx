import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { autoLinkPals } from "@/lib/mdx/plugins/auto-link-pals";
import { listGuides, getGuide } from "@/lib/guides";
import { buildMetadata } from "@/lib/seo/metadata";
import { articleSchema, jsonLd } from "@/lib/seo/structured-data";

interface Params {
  slug: string;
}

export function generateStaticParams(): Params[] {
  return listGuides().map((g) => ({ slug: g.slug }));
}

export function generateMetadata({ params }: { params: Params }): Metadata {
  const guide = getGuide(params.slug);
  if (!guide) return { title: "Guide not found" };
  return buildMetadata({
    title: guide.title,
    description: guide.description,
    canonical: `/guides/${guide.slug}`,
    ogType: "article",
    publishedTime: guide.publishedAt,
    modifiedTime: guide.updatedAt ?? guide.publishedAt,
  });
}

export default function GuidePage({ params }: { params: Params }) {
  const guide = getGuide(params.slug);
  if (!guide) notFound();

  const related = pickRelatedGuides(guide.slug, guide.tags ?? [], 3);

  return (
    <article className="space-y-6">
      <Breadcrumbs
        crumbs={[
          { name: "Home", href: "/" },
          { name: "Guides", href: "/guides" },
          { name: guide.title, href: `/guides/${guide.slug}` },
        ]}
      />
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{guide.title}</h1>
        <p className="mt-1 max-w-prose text-sm text-[rgb(var(--muted))]">
          {guide.description}
        </p>
        <p className="mt-1 text-xs text-[rgb(var(--muted))]">
          Published {new Date(guide.publishedAt).toLocaleDateString()}
          {guide.author ? ` by ${guide.author}` : null}
          {guide.updatedAt && guide.updatedAt !== guide.publishedAt
            ? ` · updated ${new Date(guide.updatedAt).toLocaleDateString()}`
            : null}
        </p>
      </header>

      <div className="prose-styles max-w-prose space-y-3 text-sm leading-relaxed">
        <MDXRemote
          source={guide.body}
          options={{
            mdxOptions: {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              remarkPlugins: [autoLinkPals as any],
            },
          }}
        />
      </div>

      {related.length > 0 && (
        <section aria-labelledby="related-guides-heading">
          <h2 id="related-guides-heading" className="text-lg font-semibold">
            Related guides
          </h2>
          <ul className="mt-2 space-y-2">
            {related.map((r) => (
              <li key={r.slug}>
                <Link
                  href={`/guides/${r.slug}`}
                  className="block rounded-md border border-[rgb(var(--border))] p-3 text-sm hover:border-[rgb(var(--ring))]"
                >
                  <div className="font-medium">{r.title}</div>
                  <div className="text-xs text-[rgb(var(--muted))]">{r.description}</div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* eslint-disable-next-line @next/next/no-script-component-in-head */}
      <script
        {...jsonLd(
          articleSchema({
            title: guide.title,
            description: guide.description,
            canonical: `/guides/${guide.slug}`,
            publishedAt: guide.publishedAt,
            updatedAt: guide.updatedAt,
            author: guide.author,
          }),
        )}
      />
    </article>
  );
}

function pickRelatedGuides(currentSlug: string, tags: string[], n: number) {
  const all = listGuides().filter((g) => g.slug !== currentSlug);
  if (tags.length === 0) return all.slice(0, n);
  const tagSet = new Set(tags);
  // Score by overlap of tags then fall back to recency.
  const scored = all
    .map((g) => ({
      g,
      score: (g.tags ?? []).filter((t) => tagSet.has(t)).length,
    }))
    .sort((a, b) => b.score - a.score || b.g.publishedAt.localeCompare(a.g.publishedAt));
  return scored.slice(0, n).map((s) => s.g);
}
