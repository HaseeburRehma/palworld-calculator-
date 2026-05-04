/**
 * SEO audit.
 *
 * For each URL exposed in the static sitemap (built from `src/lib/data/pals`
 * and the static-route list — same data the runtime sitemap uses), this
 * script checks:
 *
 *   - <title> present, ≤ 60 chars (warns if over)
 *   - <meta name="description"> present, 80–160 chars
 *   - <link rel="canonical"> present, absolute, lowercase, no trailing slash
 *   - At least one Open Graph image
 *   - <html lang> attribute present
 *   - Exactly one <h1>
 *   - At least one JSON-LD <script type="application/ld+json">
 *   - All <img> elements have an alt attribute (empty alt OK for decorative)
 *
 * Failures: hard exit 1. Warnings: exit 0 but logged.
 *
 * Runs against a built site served by `next start` (so pages render to
 * actual HTML). Pass `--base=http://localhost:3000` to override the URL.
 *
 * Pure Node, no extra deps — uses the global `fetch` and a regex-based
 * HTML scanner. Good enough for shape checks; ranking tools use the same
 * patterns.
 */

import { allPals } from "../src/lib/data/pals";
import { listGuides } from "../src/lib/guides";

interface Args {
  base: string;
}

const STATIC_PATHS = [
  "/",
  "/plan",
  "/roster",
  "/goals",
  "/import",
  "/faq",
  "/privacy",
  "/guides",
];

interface Issue {
  url: string;
  severity: "error" | "warn";
  code: string;
  message: string;
}

function parseArgs(argv: string[]): Args {
  let base = process.env.AUDIT_BASE_URL ?? "http://localhost:3000";
  for (const arg of argv) {
    if (arg.startsWith("--base=")) base = arg.slice("--base=".length);
  }
  return { base: base.replace(/\/$/, "") };
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
  return res.text();
}

function audit(url: string, html: string): Issue[] {
  const issues: Issue[] = [];
  const push = (severity: Issue["severity"], code: string, message: string) =>
    issues.push({ url, severity, code, message });

  // <html lang>
  if (!/<html[^>]+\blang=/.test(html)) {
    push("error", "MISSING_LANG", "<html> must have a lang attribute.");
  }

  // <title>
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/)?.[1]?.trim();
  if (!title) push("error", "MISSING_TITLE", "<title> is missing or empty.");
  else if (title.length > 60) push("warn", "TITLE_TOO_LONG", `Title is ${title.length} chars (>60).`);

  // <meta description>
  const desc = html
    .match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1]
    ?.trim();
  if (!desc) push("error", "MISSING_DESCRIPTION", "Meta description is missing.");
  else if (desc.length < 80) push("warn", "DESCRIPTION_SHORT", `Description is ${desc.length} chars (<80).`);
  else if (desc.length > 160) push("warn", "DESCRIPTION_LONG", `Description is ${desc.length} chars (>160).`);

  // <link rel="canonical">
  const canonical = html
    .match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1]
    ?.trim();
  if (!canonical) {
    push("error", "MISSING_CANONICAL", "Canonical link is missing.");
  } else {
    if (!/^https?:\/\//.test(canonical))
      push("error", "CANONICAL_NOT_ABSOLUTE", `Canonical is not absolute: ${canonical}`);
    if (/\/$/.test(canonical) && canonical !== `${canonical.split("//")[0]}//${canonical.split("//")[1]?.split("/")[0] ?? ""}/`)
      push("warn", "CANONICAL_TRAILING_SLASH", `Canonical ends with /: ${canonical}`);
    if (/[A-Z]/.test(canonical.split("//")[1] ?? ""))
      push("error", "CANONICAL_UPPERCASE", `Canonical has uppercase chars: ${canonical}`);
  }

  // OG image
  if (!/<meta[^>]+property=["']og:image["']/i.test(html)) {
    push("error", "MISSING_OG_IMAGE", "og:image is not set.");
  }

  // H1 count
  const h1Matches = html.match(/<h1\b[^>]*>/gi) ?? [];
  if (h1Matches.length === 0) push("error", "NO_H1", "Page has no <h1>.");
  if (h1Matches.length > 1) push("error", "MULTIPLE_H1", `Page has ${h1Matches.length} <h1> tags.`);

  // JSON-LD
  if (!/<script[^>]+type=["']application\/ld\+json["']/i.test(html)) {
    push("warn", "NO_JSONLD", "Page has no JSON-LD <script>.");
  }

  // Images without alt
  const imgs = html.match(/<img\b[^>]*>/gi) ?? [];
  for (const img of imgs) {
    if (!/\balt\s*=/.test(img)) {
      push("error", "IMG_MISSING_ALT", `<img> missing alt: ${img.slice(0, 80)}…`);
    }
  }

  return issues;
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const palPaths = allPals.map((p) => `/pals/${p.slug}`);
  const guidePaths = listGuides().map((g) => `/guides/${g.slug}`);
  const paths = [...STATIC_PATHS, ...palPaths, ...guidePaths];

  console.log(`Auditing ${paths.length} URLs against ${args.base}`);

  let errors = 0;
  let warnings = 0;
  for (const path of paths) {
    const url = `${args.base}${path}`;
    let issues: Issue[] = [];
    try {
      const html = await fetchHtml(url);
      issues = audit(path, html);
    } catch (e) {
      console.log(`[ERR ] ${path}  ${(e as Error).message}`);
      errors++;
      continue;
    }
    if (issues.length === 0) {
      console.log(`[OK  ] ${path}`);
      continue;
    }
    for (const i of issues) {
      const tag = i.severity === "error" ? "[ERR ]" : "[WARN]";
      console.log(`${tag} ${path}  ${i.code}: ${i.message}`);
      if (i.severity === "error") errors++;
      else warnings++;
    }
  }
  console.log(`\nDone. errors=${errors} warnings=${warnings}`);
  return errors > 0 ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err);
    process.exit(2);
  },
);
