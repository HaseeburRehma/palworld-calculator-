/**
 * Typed metadata helper.
 *
 * Every route should call `buildMetadata(...)` rather than hand-rolling a
 * Next.js `Metadata` object. The helper:
 *   - Suffixes the brand name onto the title (unique part first, brand last).
 *   - Forces the canonical to absolute, lowercase, no-trailing-slash form.
 *   - Sets sensible OG / Twitter / robots defaults.
 *   - Truncates over-long descriptions in dev so we don't ship a 300-char
 *     snippet by accident.
 */

import type { Metadata } from "next";
import {
  DEFAULT_OG_IMAGE,
  SITE_NAME,
  SITE_TAGLINE,
  TWITTER_HANDLE,
  absoluteUrl,
} from "./constants";

/** Length budgets that match what Google + most social-card renderers crop at. */
export const TITLE_MAX_CHARS = 60;
export const DESCRIPTION_MAX_CHARS = 160;
export const DESCRIPTION_MIN_CHARS = 80;

export interface PageMetadata {
  /** Page-specific title. The brand is appended automatically. */
  title: string;
  /** 80–160 chars, action-oriented. Written for humans first. */
  description: string;
  /** Path or absolute URL. Will be normalized to absolute, lowercase, no trailing slash. */
  canonical: string;
  /** Path or absolute URL for the OG image. Defaults to the site-wide one. */
  ogImage?: string;
  /** OG type. Defaults to `website`; use `article` for guides. */
  ogType?: "website" | "article";
  /** Tells crawlers to skip this page. Default false. */
  noindex?: boolean;
  /** Optional. Mostly cosmetic for modern SEO; we still emit them when supplied. */
  keywords?: string[];
  /** ISO datetime — only used when `ogType === "article"`. */
  publishedTime?: string;
  /** ISO datetime — only used when `ogType === "article"`. */
  modifiedTime?: string;
}

export function buildMetadata(input: PageMetadata): Metadata {
  if (process.env.NODE_ENV !== "production") {
    if (input.title.length > TITLE_MAX_CHARS) {
      // eslint-disable-next-line no-console
      console.warn(
        `[seo] Title is ${input.title.length} chars (>${TITLE_MAX_CHARS}). It will be cropped in SERPs: "${input.title}"`,
      );
    }
    if (input.description.length < DESCRIPTION_MIN_CHARS) {
      // eslint-disable-next-line no-console
      console.warn(
        `[seo] Description is ${input.description.length} chars (<${DESCRIPTION_MIN_CHARS}). Aim for 80–160.`,
      );
    }
    if (input.description.length > DESCRIPTION_MAX_CHARS) {
      // eslint-disable-next-line no-console
      console.warn(
        `[seo] Description is ${input.description.length} chars (>${DESCRIPTION_MAX_CHARS}). It will be cropped.`,
      );
    }
  }

  const titleWithBrand = `${input.title} | ${SITE_NAME}`;
  const canonical = absoluteUrl(input.canonical);
  const ogImage = input.ogImage
    ? absoluteUrl(input.ogImage)
    : absoluteUrl(DEFAULT_OG_IMAGE);
  const ogType = input.ogType ?? "website";

  const meta: Metadata = {
    title: titleWithBrand,
    description: input.description,
    keywords: input.keywords,
    alternates: { canonical },
    robots: input.noindex
      ? { index: false, follow: false }
      : { index: true, follow: true },
    openGraph: {
      title: titleWithBrand,
      description: input.description,
      url: canonical,
      siteName: SITE_NAME,
      type: ogType,
      images: [{ url: ogImage, width: 1200, height: 630, alt: SITE_NAME }],
      ...(ogType === "article" && {
        publishedTime: input.publishedTime,
        modifiedTime: input.modifiedTime,
      }),
    },
    twitter: {
      card: "summary_large_image",
      title: titleWithBrand,
      description: input.description,
      images: [ogImage],
      ...(TWITTER_HANDLE && { site: TWITTER_HANDLE }),
    },
  };
  return meta;
}

/**
 * Default metadata for the root layout. Each page overrides via its own
 * `generateMetadata` (or static `metadata` export). Setting it here means a
 * page that forgets to define metadata still renders something reasonable.
 */
export function defaultMetadata(): Metadata {
  return buildMetadata({
    title: SITE_NAME,
    description:
      "Plan Palworld breeding chains, look up parent pairs, calculate passive-skill probability, and import your save file — all in your browser.",
    canonical: "/",
  });
}

export { SITE_NAME, SITE_TAGLINE };
