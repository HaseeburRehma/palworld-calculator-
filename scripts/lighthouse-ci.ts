/**
 * Lighthouse runner.
 *
 * Lighthouse CI is a separate dev tool — installing it here would balloon
 * dev deps. Instead we shell out to `npx lighthouse` so contributors don't
 * need a global install. Each route is run in turn and the relevant scores
 * (Performance, SEO, Accessibility, Best Practices) are checked against
 * the targets the SEO spec defines.
 *
 * Non-blocking by default — fails CI only when LIGHTHOUSE_STRICT=1 is set.
 *
 * Run with the dev/preview server already up: `pnpm start &` then
 * `pnpm lighthouse`.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

const TARGETS = {
  performance: 90,
  seo: 90,
  accessibility: 90,
  "best-practices": 90,
} as const;

const ROUTES = ["/", "/pals/lamball", "/plan", "/faq"];

interface Score {
  category: keyof typeof TARGETS;
  score: number;
}

async function runLighthouse(url: string): Promise<Score[]> {
  const { stdout } = await execFileP("npx", [
    "--yes",
    "lighthouse",
    url,
    "--output=json",
    "--quiet",
    "--chrome-flags=--headless --no-sandbox",
    "--only-categories=performance,seo,accessibility,best-practices",
  ]);
  const json = JSON.parse(stdout) as {
    categories: Record<string, { id: string; score: number }>;
  };
  const out: Score[] = [];
  for (const cat of Object.keys(TARGETS) as Array<keyof typeof TARGETS>) {
    const node = json.categories[cat] ?? json.categories[cat.replace("-", "")];
    if (!node) continue;
    out.push({ category: cat, score: Math.round(node.score * 100) });
  }
  return out;
}

async function main(): Promise<number> {
  const base = process.env.LIGHTHOUSE_BASE ?? "http://localhost:3000";
  const strict = process.env.LIGHTHOUSE_STRICT === "1";
  let failed = 0;
  for (const route of ROUTES) {
    const url = `${base}${route}`;
    try {
      const scores = await runLighthouse(url);
      console.log(`\n${route}`);
      for (const s of scores) {
        const target = TARGETS[s.category];
        const ok = s.score >= target;
        const tag = ok ? "OK  " : strict ? "FAIL" : "WARN";
        console.log(`  [${tag}] ${s.category}: ${s.score} (target ${target})`);
        if (!ok) failed++;
      }
    } catch (e) {
      console.log(`\n${route}  failed to run: ${(e as Error).message}`);
      failed++;
    }
  }
  if (strict && failed > 0) return 1;
  return 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err);
    process.exit(2);
  },
);
