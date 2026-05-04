# Per-page SEO checklist

Before merging a change that adds or substantially modifies a route, walk this list.

## Required (build-blocking via `pnpm seo:audit`)

- [ ] **Metadata via `buildMetadata`** — no hand-rolled `Metadata` objects. The helper enforces brand suffix, canonical normalization, and OG/Twitter defaults.
- [ ] **Title under 60 chars** — page-specific part first, brand last.
- [ ] **Description 80–160 chars** — written for humans first, keywords second.
- [ ] **Canonical URL** — absolute, lowercase, no trailing slash. Use `absoluteUrl(...)` from `lib/seo/constants` if computing manually.
- [ ] **Open Graph image** — site default is fine for most pages; per-Pal pages get an auto-generated card via `opengraph-image.tsx`.
- [ ] **Exactly one `<h1>`** — and it's the page's main heading, not a styling choice.
- [ ] **`<html lang="en">`** — set by the root layout; don't override on a sub-tree.
- [ ] **Every `<img>` has `alt`** — empty string for decorative, meaningful text for content images.

## Required (manual verification)

- [ ] **Breadcrumbs** — visible breadcrumb component AND matching `BreadcrumbList` JSON-LD. Use `<Breadcrumbs />` which emits both.
- [ ] **Structured data** — for content-rich pages, emit the appropriate schema:
  - Pal pages → `palSchema(...)` (Thing) + `faqSchema(...)`.
  - Guide pages → `articleSchema(...)`.
  - FAQ pages → `faqSchema(...)`.
- [ ] **Internal links from at least 2 other pages** — orphan pages don't rank. The footer Popular Pals widget covers most Pal pages; new top-level pages need a link from the nav and at least one in-content link from the home page or a guide.
- [ ] **Listed in the sitemap** — `src/app/sitemap.ts`. Static routes: add to the array. Dynamic routes (Pals, guides): the loop includes them automatically as long as the data source is wired up.

## Recommended

- [ ] **80+ words of unique narrative content** — for content pages (Pal detail, guides). Templated content with one swapped noun per page is the Google penalty pattern; the narrative generator avoids it via category-based templates and hashed selection.
- [ ] **Related-content section** — every content page should outbound-link to 3–6 other content pages. Per-Pal pages do this with `pickRelatedPals`; guides do it with tag overlap.
- [ ] **No console warnings in dev** — the metadata helper warns when title/description is out of budget; fix those before shipping.
- [ ] **Lighthouse 90+** — Performance, SEO, Accessibility, Best Practices. Run `pnpm lighthouse` against a local `pnpm start`.

## Performance budgets

| Metric | Home page | Per-Pal page |
| --- | --- | --- |
| Total transferred | ≤ 200 KB | ≤ 350 KB |
| LCP (4G mobile) | ≤ 2.0 s | ≤ 2.5 s |
| CLS | ≤ 0.05 | ≤ 0.05 |
| INP | ≤ 100 ms | ≤ 100 ms |

The biggest wins are usually:

1. **Don't add third-party scripts.** The site has none. Don't be the person who adds the first.
2. **Reserve image dimensions.** Every `<img>`/`next/image` needs explicit width/height to keep CLS at zero.
3. **Defer non-critical JS.** The calculator's pathfinder lives in a worker; per-Pal pages have minimal JS.
4. **Self-host fonts only if you really need a brand font.** `system-ui` is faster than any web font and zero CLS.

## How to add a new page (cheat-sheet)

```tsx
// src/app/foo/page.tsx (server component preferred)
import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { buildMetadata } from "@/lib/seo/metadata";
import { faqSchema, jsonLd } from "@/lib/seo/structured-data";

export const metadata: Metadata = buildMetadata({
  title: "My new page",
  description: "Eighty to one-sixty characters of human-readable description.",
  canonical: "/foo",
});

export default function FooPage() {
  return (
    <>
      <Breadcrumbs crumbs={[{ name: "Home", href: "/" }, { name: "Foo", href: "/foo" }]} />
      <h1>Foo</h1>
      {/* …content… */}
      {/* eslint-disable-next-line @next/next/no-script-component-in-head */}
      <script {...jsonLd(faqSchema([/* … */]))} />
    </>
  );
}
```

Then add `/foo` to `src/app/sitemap.ts` and a link from at least one existing page.

## How to update site-wide SEO settings

- **Brand name** → `SITE_NAME` in `src/lib/seo/constants.ts`.
- **Canonical origin** → `NEXT_PUBLIC_SITE_URL` env var (or the fallback in the same file).
- **Default OG image** → `DEFAULT_OG_IMAGE` constant + drop the file at the matching path under `public/`.
- **Popular Pals (footer + 404 page)** → `POPULAR_PAL_SLUGS` array.

One file. One commit. Don't go hunting through the codebase for hard-coded brand strings — there shouldn't be any.
