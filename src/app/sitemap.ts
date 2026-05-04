import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/seo/constants";
import { allPals } from "@/lib/data/pals";
import { listGuides } from "@/lib/guides";

/**
 * Dynamic sitemap. Includes every static route plus per-Pal pages and any
 * MDX guides under `content/guides/`. `lastModified` is build time for
 * static routes (cheap and accurate-enough for ranking) and the front-matter
 * `updatedAt` for guides.
 *
 * Next.js exposes this at `/sitemap.xml` automatically.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/plan"), lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: absoluteUrl("/roster"), lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: absoluteUrl("/goals"), lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: absoluteUrl("/import"), lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: absoluteUrl("/faq"), lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: absoluteUrl("/privacy"), lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: absoluteUrl("/guides"), lastModified: now, changeFrequency: "weekly", priority: 0.7 },
  ];

  const palRoutes: MetadataRoute.Sitemap = allPals.map((pal) => ({
    url: absoluteUrl(`/pals/${pal.slug}`),
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  const guideRoutes: MetadataRoute.Sitemap = listGuides().map((g) => ({
    url: absoluteUrl(`/guides/${g.slug}`),
    lastModified: g.updatedAt ? new Date(g.updatedAt) : now,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [...staticRoutes, ...palRoutes, ...guideRoutes];
}
