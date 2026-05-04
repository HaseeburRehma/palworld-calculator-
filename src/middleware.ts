/**
 * URL-hygiene middleware.
 *
 * Two canonical-form rules, both enforced as 301 redirects so search engines
 * consolidate ranking signal on a single URL:
 *
 *   1. All paths lowercase. `/Pals/Lamball` → 301 → `/pals/lamball`.
 *   2. No trailing slashes. `/pals/lamball/` → 301 → `/pals/lamball`.
 *
 * The root `/` is exempt from rule #2.
 *
 * Excludes Next's own asset paths (`_next`, `_vercel`) and image-optimization
 * routes — touching those breaks the build.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest): NextResponse | undefined {
  const url = req.nextUrl;
  const { pathname } = url;

  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/_vercel/") ||
    pathname.startsWith("/api/") ||
    pathname === "/sitemap.xml" ||
    pathname === "/robots.txt"
  ) {
    return undefined;
  }

  let target = pathname;
  let mutated = false;

  // Trailing slash collapse (root excluded).
  if (target.length > 1 && target.endsWith("/")) {
    target = target.replace(/\/+$/, "") || "/";
    mutated = true;
  }

  // Lowercase enforcement.
  if (/[A-Z]/.test(target)) {
    target = target.toLowerCase();
    mutated = true;
  }

  if (!mutated) return undefined;

  const redirected = req.nextUrl.clone();
  redirected.pathname = target;
  return NextResponse.redirect(redirected, 301);
}

export const config = {
  // Skip static asset suffixes — anything with a file extension is served as-is.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
