/**
 * Download every Pal portrait the calculator knows about, into `public/pals/`.
 *
 * Run-once, optional. After this completes:
 *   - `PalImage` will pick up `/pals/<slug>.png` before falling through to the
 *     palworld.gg CDN, so the app no longer depends on that fan site staying
 *     online (or on them being okay with hot-linking from us).
 *   - You can commit the images, or .gitignore them and re-run after game
 *     patches add new Pals.
 *
 * Politeness: throttled at ~3 requests per second, sequential, with a custom
 * `User-Agent` so palworld.gg's logs are honest about who's hitting them.
 * Failures don't fatal-stop the script — they're collected and printed at
 * the end.
 *
 * Usage:
 *   pnpm download:images               # download all known
 *   pnpm download:images --only=lamball,cattiva  # selective
 *   pnpm download:images --force       # re-download even if file exists
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { allPals } from "../src/lib/data/pals";
import { getPalAssetName, getPalImageUrl, listMappedPalIds } from "../src/lib/data/pal-image-urls";

const OUT_DIR = resolve(process.cwd(), "public/pals");
const USER_AGENT =
  "palworld-breeding-calculator (+https://example.com — fan tool downloading Pal portraits)";
const THROTTLE_MS = 350;

interface Args {
  only: Set<string> | null;
  force: boolean;
}

function parseArgs(argv: string[]): Args {
  let only: Set<string> | null = null;
  let force = false;
  for (const arg of argv) {
    if (arg === "--force") force = true;
    else if (arg.startsWith("--only=")) {
      const list = arg.slice("--only=".length).split(",").map((s) => s.trim()).filter(Boolean);
      only = new Set(list);
    }
  }
  return { only, force };
}

async function fetchToFile(url: string, dest: string): Promise<void> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} (${url})`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(dest, buf);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  // Download the union of slugs known to data/pals.json AND the image map —
  // either source might be ahead of the other after a patch.
  const knownFromData = new Set(allPals.map((p) => p.slug));
  const knownFromMap = new Set(listMappedPalIds());
  const slugs = [...new Set([...knownFromData, ...knownFromMap])].sort();

  const targets = args.only ? slugs.filter((s) => args.only!.has(s)) : slugs;

  let downloaded = 0;
  let skipped = 0;
  let unmapped = 0;
  const failures: Array<{ slug: string; reason: string }> = [];

  console.log(`Targeting ${targets.length} slug(s) → ${OUT_DIR}`);
  for (const slug of targets) {
    const dest = resolve(OUT_DIR, `${slug}.png`);
    if (!args.force && existsSync(dest)) {
      skipped++;
      continue;
    }
    const url = getPalImageUrl(slug);
    if (!url) {
      const assetName = getPalAssetName(slug);
      if (!assetName) {
        unmapped++;
        console.log(`  ?? ${slug} (no asset mapping — add it to pal-image-urls.ts)`);
        continue;
      }
      // Shouldn't normally happen — getPalImageUrl returns null only when
      // the map lookup misses, which means assetName was also null above.
      unmapped++;
      continue;
    }
    try {
      await fetchToFile(url, dest);
      downloaded++;
      console.log(`  ✓ ${slug}`);
    } catch (e) {
      failures.push({ slug, reason: (e as Error).message });
      console.log(`  ✗ ${slug} — ${(e as Error).message}`);
    }
    await sleep(THROTTLE_MS);
  }

  console.log(
    `\nDone. downloaded=${downloaded}  skipped(existing)=${skipped}  unmapped=${unmapped}  failed=${failures.length}`,
  );
  if (failures.length > 0) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  ${f.slug}: ${f.reason}`);
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
