/**
 * Accessibility audit via `pa11y` (shelled out via `npx`).
 *
 * Pa11y wraps axe-core and runs against a list of URLs. We pull the route
 * list from the same source the SEO audit uses so the two stay in sync.
 *
 * Non-blocking by default. Set `A11Y_STRICT=1` to block CI on violations.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { allPals } from "../src/lib/data/pals";

const execFileP = promisify(execFile);

const STATIC = ["/", "/plan", "/roster", "/goals", "/import", "/faq", "/privacy", "/guides"];

interface Issue {
  code: string;
  message: string;
  type: "error" | "warning" | "notice";
}

async function audit(url: string): Promise<Issue[]> {
  const { stdout } = await execFileP("npx", [
    "--yes",
    "pa11y",
    url,
    "--reporter=json",
    "--standard=WCAG2AA",
  ]);
  const parsed = JSON.parse(stdout) as Issue[];
  return parsed;
}

async function main(): Promise<number> {
  const base = process.env.A11Y_BASE ?? "http://localhost:3000";
  const strict = process.env.A11Y_STRICT === "1";
  // Audit a representative subset rather than every Pal page — this script is
  // already slow because each pa11y invocation spins up Chromium.
  const palSample = allPals.slice(0, 3).map((p) => `/pals/${p.slug}`);
  const routes = [...STATIC, ...palSample];
  let totalErrors = 0;
  for (const route of routes) {
    const url = `${base}${route}`;
    try {
      const issues = await audit(url);
      const errors = issues.filter((i) => i.type === "error");
      const tag = errors.length === 0 ? "OK  " : strict ? "FAIL" : "WARN";
      console.log(`[${tag}] ${route}  ${errors.length} error(s), ${issues.length - errors.length} other(s)`);
      for (const i of errors) console.log(`        ${i.code}: ${i.message}`);
      totalErrors += errors.length;
    } catch (e) {
      console.log(`[ERR ] ${route}  ${(e as Error).message}`);
      totalErrors++;
    }
  }
  if (strict && totalErrors > 0) return 1;
  return 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err);
    process.exit(2);
  },
);
