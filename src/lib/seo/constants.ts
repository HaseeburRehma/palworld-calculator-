/**
 * Site-wide SEO constants.
 *
 * One file, one source of truth. Change `SITE_NAME` once and the whole site
 * follows. Same for `SITE_URL` — every canonical, OG, sitemap entry derives
 * from it.
 */

/** Brand. Swap to "PalForge" or anything else if you rebrand. */
export const SITE_NAME = "Palworld Breeding Calculator";

/** Short brand line shown in OG images and the footer. */
export const SITE_TAGLINE = "Reverse lookup, breeding plans, save imports.";

/**
 * Production canonical URL. NO trailing slash. Override at deploy time via
 * `NEXT_PUBLIC_SITE_URL` if hosting somewhere else.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  "https://palworld-breeding-calculator.example.com";

/** OG image fallback used when a per-page override isn't supplied. */
export const DEFAULT_OG_IMAGE = "/og/default.png";

/** Twitter handle for `twitter:site` if/when you create one; null = omit. */
export const TWITTER_HANDLE: string | null = null;

/**
 * Pals that get linked from the footer "Popular Pals" widget. Picked by
 * search-volume judgment, not power-value. Swap freely as priorities shift —
 * touching this file rebuilds the footer everywhere.
 */
export const POPULAR_PAL_SLUGS: ReadonlyArray<string> = Object.freeze([
  "lamball",
  "cattiva",
  "foxparks",
  "pengullet",
  "depresso",
  "mau",
  "rushoar",
  "killamari",
]);

/**
 * Build an absolute URL from a path. Always lowercase, never trailing slash
 * (canonical form). Pass it the path as written in routing (`/pals/lamball`).
 */
export function absoluteUrl(path: string): string {
  const trimmed = path.replace(/\/+$/, "").toLowerCase();
  if (!trimmed || trimmed === "/") return SITE_URL;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `${SITE_URL}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
}
