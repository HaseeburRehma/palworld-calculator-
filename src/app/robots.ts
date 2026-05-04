import type { MetadataRoute } from "next";
import { SITE_URL, absoluteUrl } from "@/lib/seo/constants";

/**
 * /robots.txt — allow all crawlers, point at the dynamic sitemap, and
 * pre-emptively block routes we never want indexed (none today, but the
 * pattern is in place for future preview/draft routes).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/draft/", "/_next/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: absoluteUrl("/"),
  };
}
