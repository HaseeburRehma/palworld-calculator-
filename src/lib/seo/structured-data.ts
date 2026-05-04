/**
 * JSON-LD builders.
 *
 * Output is a plain JSON-serializable object the page renders inside
 * `<script type="application/ld+json">`. Every builder is a pure function so
 * the same call deterministically produces the same payload — easy to test,
 * easy to validate.
 *
 * Schema reference: https://schema.org/.  Validate with Google's Rich Results
 * Test before relying on a new schema for ranking.
 */

import type { Pal } from "@/types/pal";
import { SITE_NAME, absoluteUrl } from "./constants";

/* -------------------------------------------------------------------------- */
/*  WebSite — home page only. Includes a SearchAction so Google can offer a   */
/*  sitelinks search box (when the site earns it).                            */
/* -------------------------------------------------------------------------- */

export function websiteSchema(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: absoluteUrl("/"),
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${absoluteUrl("/")}/?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  VideoGame — a once-per-site reference to Palworld itself, anchored on     */
/*  the home or about page. Helps Google understand what we're a fan tool    */
/*  for.                                                                      */
/* -------------------------------------------------------------------------- */

export function palworldVideoGameSchema(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: "Palworld",
    description:
      "Open-world survival creature-collection game by Pocketpair, Inc.",
    publisher: { "@type": "Organization", name: "Pocketpair, Inc." },
    sameAs: [
      "https://www.pocketpair.jp/palworld",
      "https://store.steampowered.com/app/1623730/Palworld/",
      "https://en.wikipedia.org/wiki/Palworld",
    ],
  };
}

/* -------------------------------------------------------------------------- */
/*  BreadcrumbList — every non-home page                                      */
/* -------------------------------------------------------------------------- */

export interface Crumb {
  name: string;
  /** Path or absolute URL. Normalized inside the builder. */
  href: string;
}

export function breadcrumbSchema(crumbs: ReadonlyArray<Crumb>): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: absoluteUrl(c.href),
    })),
  };
}

/* -------------------------------------------------------------------------- */
/*  Pal — Schema.org has no "fictional creature" type. We use Thing and       */
/*  attach the structured data via additionalProperty entries. This is the   */
/*  same pattern Pokémon and other creature-collection wikis use; Google     */
/*  reads it cleanly.                                                         */
/* -------------------------------------------------------------------------- */

export function palSchema(pal: Pal, options: { canonical: string; image?: string }): Record<string, unknown> {
  const url = absoluteUrl(options.canonical);
  const props: Array<{ name: string; value: string | number | boolean }> = [
    { name: "Paldex Number", value: pal.paldexNo },
    { name: "Power Value", value: pal.powerValue },
    { name: "Element", value: pal.elements.join(", ") },
    { name: "Breedable", value: pal.breedable },
  ];
  if (pal.breedOnly) {
    props.push({ name: "Acquisition", value: "Breeding only" });
  }
  return {
    "@context": "https://schema.org",
    "@type": "Thing",
    name: pal.name,
    alternateName: `Paldex #${String(pal.paldexNo).padStart(3, "0")}`,
    url,
    image: options.image ? absoluteUrl(options.image) : undefined,
    additionalType: "https://schema.org/Thing",
    additionalProperty: props.map((p) => ({
      "@type": "PropertyValue",
      name: p.name,
      value: p.value,
    })),
    isPartOf: {
      "@type": "VideoGame",
      name: "Palworld",
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  FAQPage                                                                   */
/* -------------------------------------------------------------------------- */

export interface FaqEntry {
  question: string;
  answer: string;
}

export function faqSchema(entries: ReadonlyArray<FaqEntry>): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: entries.map((e) => ({
      "@type": "Question",
      name: e.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: e.answer,
      },
    })),
  };
}

/* -------------------------------------------------------------------------- */
/*  Article — guides                                                          */
/* -------------------------------------------------------------------------- */

export interface ArticleInput {
  title: string;
  description: string;
  canonical: string;
  publishedAt: string;
  updatedAt?: string;
  author?: string;
  image?: string;
}

export function articleSchema(input: ArticleInput): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.title,
    description: input.description,
    mainEntityOfPage: { "@type": "WebPage", "@id": absoluteUrl(input.canonical) },
    datePublished: input.publishedAt,
    dateModified: input.updatedAt ?? input.publishedAt,
    author: input.author
      ? { "@type": "Person", name: input.author }
      : { "@type": "Organization", name: SITE_NAME },
    publisher: { "@type": "Organization", name: SITE_NAME },
    image: input.image ? absoluteUrl(input.image) : undefined,
  };
}

/* -------------------------------------------------------------------------- */
/*  Helper component for inlining the JSON-LD in a page                       */
/* -------------------------------------------------------------------------- */

/**
 * Returns the props for a `<script type="application/ld+json">` element.
 * Use it like:
 *
 *   <script {...jsonLd(palSchema(pal, ...))} />
 */
export function jsonLd(payload: unknown): {
  type: "application/ld+json";
  dangerouslySetInnerHTML: { __html: string };
} {
  return {
    type: "application/ld+json",
    // JSON.stringify with no indentation — minimizes payload, escapes safely.
    dangerouslySetInnerHTML: { __html: JSON.stringify(payload).replace(/</g, "\\u003c") },
  };
}
