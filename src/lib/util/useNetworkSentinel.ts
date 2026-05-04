"use client";

import { useEffect } from "react";

/**
 * Dev-mode-only network sentinel.
 *
 * Mounts on the import flow and yells (via console.error) if anything calls
 * `fetch` or opens an `XMLHttpRequest` while the page is active. This
 * doesn't block the call — that would risk breaking Next.js's own internal
 * RSC fetches in dev. It's a tripwire, not a firewall.
 *
 * In production (`NODE_ENV !== "development"`) the hook is a no-op.
 *
 * The point of this hook is to make the privacy guarantee enforceable
 * during development: if a future change to the import page accidentally
 * pulls in a network call, the warning fires loudly in the console.
 */
export function useNetworkSentinel(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    if (process.env.NODE_ENV !== "development") return;
    if (typeof window === "undefined") return;

    const originalFetch = window.fetch;
    const OriginalXHR = window.XMLHttpRequest;
    let firedFetch = false;
    let firedXhr = false;

    window.fetch = function patchedFetch(...args: Parameters<typeof fetch>) {
      // Allow Next.js's own RSC fetches (they target `/_next` or are relative).
      const target = (() => {
        const first = args[0];
        if (typeof first === "string") return first;
        if (first instanceof URL) return first.toString();
        if (first && typeof first === "object" && "url" in first) {
          return (first as { url: string }).url;
        }
        return "";
      })();
      if (!isInternal(target) && !firedFetch) {
        firedFetch = true;
        // eslint-disable-next-line no-console
        console.error(
          "[Privacy sentinel] fetch() called from /import flow. The save-import flow " +
            "promises no outbound requests. Investigate before shipping. Target:",
          target,
        );
      }
      return originalFetch.apply(this, args);
    };

    class PatchedXHR extends OriginalXHR {
      override open(method: string, url: string | URL, ...rest: unknown[]) {
        const u = url instanceof URL ? url.toString() : url;
        if (!isInternal(u) && !firedXhr) {
          firedXhr = true;
          // eslint-disable-next-line no-console
          console.error(
            "[Privacy sentinel] XMLHttpRequest opened from /import flow. The save-import " +
              "flow promises no outbound requests. Investigate before shipping. Target:",
            u,
          );
        }
        // @ts-expect-error  rest is Parameters<typeof XMLHttpRequest.open>
        return super.open(method, u, ...rest);
      }
    }
    window.XMLHttpRequest = PatchedXHR;

    return () => {
      window.fetch = originalFetch;
      window.XMLHttpRequest = OriginalXHR;
    };
  }, [active]);
}

function isInternal(target: string): boolean {
  if (!target) return true;
  if (target.startsWith("/_next/")) return true;
  if (target.startsWith("/_vercel/")) return true;
  if (target.startsWith("data:")) return true;
  if (target.startsWith("blob:")) return true;
  // Same-origin relative URLs are allowed by default (we don't ship any in
  // the import flow today, but Next dev mode does internal RSC fetches).
  if (target.startsWith("/")) return true;
  return false;
}
