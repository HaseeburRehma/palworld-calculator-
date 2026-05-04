/**
 * Guide registry.
 *
 * Reads MDX files from `content/guides/` at build time and exposes a typed
 * list. The MDX content itself is rendered by `src/app/guides/[slug]/page.tsx`.
 *
 * `node:fs` reads are safe here because this module is imported only from
 * server contexts (page metadata, sitemap). It is NOT imported from any
 * client component.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface GuideFrontMatter {
  /** Display title shown in the article header and SERP. */
  title: string;
  /** 80–160 char description used for meta description + OG. */
  description: string;
  /** ISO datetime. */
  publishedAt: string;
  /** ISO datetime — defaults to publishedAt when omitted. */
  updatedAt?: string;
  /** Author display name. */
  author?: string;
  /** Free-form tags for related-guide grouping. */
  tags?: string[];
  /** Pin to the top of the index. */
  featured?: boolean;
}

export interface GuideEntry extends GuideFrontMatter {
  /** Filename (without extension), used as the `[slug]` route param. */
  slug: string;
  /** Raw MDX body (post-front-matter). */
  body: string;
}

const GUIDES_DIR = resolve(process.cwd(), "content/guides");

/**
 * Read all guides from disk and parse their YAML-ish front matter. We don't
 * pull in `gray-matter` for one tiny case — the front matter format is
 * fenced with `---` and contains only flat key:value pairs in our usage.
 */
export function listGuides(): GuideEntry[] {
  if (!existsSync(GUIDES_DIR)) return [];
  const files = readdirSync(GUIDES_DIR).filter((f) => f.endsWith(".mdx"));
  const entries: GuideEntry[] = [];
  for (const file of files) {
    const raw = readFileSync(resolve(GUIDES_DIR, file), "utf-8");
    const parsed = parseFrontMatter(raw);
    if (!parsed) continue;
    entries.push({
      slug: file.replace(/\.mdx$/, ""),
      ...parsed.data,
      body: parsed.body,
    });
  }
  // Featured first, then newest first.
  entries.sort((a, b) => {
    if (Boolean(a.featured) !== Boolean(b.featured)) return a.featured ? -1 : 1;
    return b.publishedAt.localeCompare(a.publishedAt);
  });
  return entries;
}

export function getGuide(slug: string): GuideEntry | undefined {
  return listGuides().find((g) => g.slug === slug);
}

/* -------------------------------------------------------------------------- */
/*  Tiny YAML-ish front-matter parser                                          */
/* -------------------------------------------------------------------------- */

interface ParsedFm {
  data: GuideFrontMatter;
  body: string;
}

function parseFrontMatter(raw: string): ParsedFm | null {
  const match = raw.match(/^---\s*\n([\s\S]+?)\n---\s*\n([\s\S]*)$/);
  if (!match) return null;
  const [, frontRaw, body] = match;
  const data = parseFlatYaml(frontRaw ?? "");
  if (!isGuideFrontMatter(data)) return null;
  return { data, body: body ?? "" };
}

function parseFlatYaml(text: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf(":");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const valRaw = trimmed.slice(idx + 1).trim();
    if (valRaw.startsWith("[") && valRaw.endsWith("]")) {
      // simple bracketed list: ["a", "b", c]
      out[key] = valRaw
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    } else if (valRaw === "true" || valRaw === "false") {
      out[key] = valRaw === "true";
    } else {
      out[key] = valRaw.replace(/^["']|["']$/g, "");
    }
  }
  return out;
}

function isGuideFrontMatter(d: unknown): d is GuideFrontMatter {
  const data = d as Record<string, unknown>;
  return typeof data.title === "string" && typeof data.description === "string" && typeof data.publishedAt === "string";
}
