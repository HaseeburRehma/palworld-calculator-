/**
 * Polite HTTP fetcher for the scraper.
 *
 * Responsibilities:
 *   - Identify ourselves with a descriptive User-Agent.
 *   - Throttle to ~1 request per second per host (be nice).
 *   - Cache responses on disk under `.cache/` so re-runs don't re-hit the source.
 *
 * Not responsible for parsing — callers do that.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";

const CACHE_DIR = path.resolve(process.cwd(), ".cache");
const DEFAULT_DELAY_MS = 1000;

const contact = process.env.SCRAPER_CONTACT_EMAIL || "anonymous";
const USER_AGENT = `palworld-breeding-calculator/0.1 (+https://github.com; contact: ${contact})`;

let lastRequestAt = 0;

async function throttle(delayMs: number): Promise<void> {
  const now = Date.now();
  const wait = Math.max(0, lastRequestAt + delayMs - now);
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  lastRequestAt = Date.now();
}

function cachePathFor(url: string): string {
  const hash = createHash("sha1").update(url).digest("hex").slice(0, 16);
  return path.join(CACHE_DIR, `${hash}.txt`);
}

async function readCache(url: string): Promise<string | null> {
  const file = cachePathFor(url);
  try {
    await stat(file);
    return await readFile(file, "utf8");
  } catch {
    return null;
  }
}

async function writeCache(url: string, body: string): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(cachePathFor(url), body, "utf8");
}

export interface FetchOptions {
  /** Override the inter-request delay in ms. Defaults to 1000. */
  delayMs?: number;
  /** Skip the on-disk cache for this call. */
  noCache?: boolean;
}

/**
 * Fetch a URL as text, throttled and cached.
 */
export async function politeFetchText(
  url: string,
  options: FetchOptions = {},
): Promise<string> {
  if (!options.noCache) {
    const cached = await readCache(url);
    if (cached !== null) return cached;
  }

  await throttle(options.delayMs ?? DEFAULT_DELAY_MS);

  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
    },
  });

  if (!res.ok) {
    throw new Error(`Fetch failed ${res.status} ${res.statusText} for ${url}`);
  }

  const body = await res.text();
  await writeCache(url, body);
  return body;
}

/** Convenience: fetch and parse JSON. */
export async function politeFetchJson<T>(url: string, options?: FetchOptions): Promise<T> {
  const body = await politeFetchText(url, options);
  return JSON.parse(body) as T;
}

/**
 * Resolve the configured base URL for the data source. Throws with a helpful
 * message if it isn't set, since the scraper is source-agnostic by design.
 */
export function getDataSourceBaseUrl(): string {
  const base = process.env.PAL_DATA_SOURCE;
  if (!base) {
    throw new Error(
      "PAL_DATA_SOURCE is not set. Pick a source (see data/README.md) and put " +
        "it in .env. Example: PAL_DATA_SOURCE=https://paldb.cc",
    );
  }
  return base.replace(/\/+$/, "");
}
