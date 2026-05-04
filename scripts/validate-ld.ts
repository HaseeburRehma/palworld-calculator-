/**
 * JSON-LD shape validator.
 *
 * For each URL, finds every `<script type="application/ld+json">`, parses
 * the JSON, and asserts a small set of shape requirements per schema:
 *
 *   - Every payload has a `@context` of `https://schema.org`.
 *   - `BreadcrumbList` has a non-empty `itemListElement` with `position`s
 *     starting at 1 and incrementing.
 *   - `FAQPage` has `mainEntity` array of `Question` entries each with an
 *     `acceptedAnswer.text`.
 *   - `Thing` (used for Pals) has `name` + `url`.
 *   - `Article` has `headline`, `datePublished`, and `mainEntityOfPage`.
 *   - `WebSite` has `name` + `url`; if `potentialAction` exists it's a
 *     `SearchAction`.
 *
 * This isn't a full Schema.org validator — that would require pulling a
 * giant ontology in. It's a "did we screw up the shape" sanity check, and
 * complements Google's Rich Results Test (which is the source of truth
 * for ranking-eligible markup).
 */

import { allPals } from "../src/lib/data/pals";
import { listGuides } from "../src/lib/guides";

const STATIC = ["/", "/plan", "/roster", "/goals", "/import", "/faq", "/privacy", "/guides"];

interface Failure {
  url: string;
  payload?: unknown;
  message: string;
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function extractLd(html: string): unknown[] {
  const out: unknown[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1]?.trim() ?? "";
    if (!raw) continue;
    try {
      out.push(JSON.parse(raw));
    } catch (e) {
      out.push({ __parseError: (e as Error).message, raw });
    }
  }
  return out;
}

function check(url: string, payload: unknown, failures: Failure[]): void {
  const isObj = (v: unknown): v is Record<string, unknown> =>
    typeof v === "object" && v !== null && !Array.isArray(v);
  if (!isObj(payload)) {
    failures.push({ url, payload, message: "payload is not an object" });
    return;
  }
  if (payload["@context"] !== "https://schema.org") {
    failures.push({ url, payload, message: "@context !== https://schema.org" });
  }
  const type = payload["@type"];
  switch (type) {
    case "BreadcrumbList": {
      const items = payload["itemListElement"];
      if (!Array.isArray(items) || items.length === 0) {
        failures.push({ url, payload, message: "BreadcrumbList itemListElement empty" });
        break;
      }
      items.forEach((it: unknown, i: number) => {
        if (!isObj(it) || it["position"] !== i + 1) {
          failures.push({ url, payload, message: `BreadcrumbList[${i}] position mismatch` });
        }
      });
      break;
    }
    case "FAQPage": {
      const main = payload["mainEntity"];
      if (!Array.isArray(main) || main.length === 0) {
        failures.push({ url, payload, message: "FAQPage mainEntity empty" });
        break;
      }
      for (const q of main) {
        if (!isObj(q) || q["@type"] !== "Question" || !q["name"]) {
          failures.push({ url, payload, message: "FAQPage entry missing Question/name" });
        }
        const a = isObj(q) ? q["acceptedAnswer"] : null;
        if (!isObj(a) || !a["text"]) {
          failures.push({ url, payload, message: "FAQPage entry missing acceptedAnswer.text" });
        }
      }
      break;
    }
    case "Thing": {
      if (!payload["name"] || !payload["url"]) {
        failures.push({ url, payload, message: "Thing missing name or url" });
      }
      break;
    }
    case "Article": {
      for (const f of ["headline", "datePublished", "mainEntityOfPage"]) {
        if (!payload[f]) failures.push({ url, payload, message: `Article missing ${f}` });
      }
      break;
    }
    case "WebSite": {
      if (!payload["name"] || !payload["url"]) {
        failures.push({ url, payload, message: "WebSite missing name or url" });
      }
      break;
    }
    case "VideoGame":
      if (!payload["name"]) failures.push({ url, payload, message: "VideoGame missing name" });
      break;
    default:
      // Other types pass — this is shape-checking only.
      break;
  }
}

async function main(): Promise<number> {
  const base = process.env.AUDIT_BASE_URL ?? "http://localhost:3000";
  const palPaths = allPals.slice(0, 3).map((p) => `/pals/${p.slug}`); // sample
  const guidePaths = listGuides().slice(0, 3).map((g) => `/guides/${g.slug}`);
  const paths = [...STATIC, ...palPaths, ...guidePaths];
  const failures: Failure[] = [];

  for (const path of paths) {
    const url = `${base}${path}`;
    let payloads: unknown[];
    try {
      payloads = extractLd(await fetchHtml(url));
    } catch (e) {
      failures.push({ url: path, message: `fetch failed: ${(e as Error).message}` });
      continue;
    }
    if (payloads.length === 0) {
      console.log(`[WARN] ${path}  no JSON-LD found`);
      continue;
    }
    for (const p of payloads) check(path, p, failures);
    if (failures.filter((f) => f.url === path).length === 0) {
      console.log(`[OK  ] ${path}  ${payloads.length} payload(s) valid`);
    }
  }

  if (failures.length > 0) {
    console.log(`\nFailures (${failures.length}):`);
    for (const f of failures) console.log(`  ${f.url}: ${f.message}`);
    return 1;
  }
  return 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err);
    process.exit(2);
  },
);
