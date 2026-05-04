/**
 * Roster compression for shareable URLs.
 *
 * The roster is small but JSON-bulky (uuids dominate). `lz-string` compresses
 * it to a URL-safe string in ~25% of the original size for typical inputs,
 * which keeps share links under most chat clients' length limits.
 *
 * This is one-way for the user-facing flow: encode → put in `?r=…`, decode →
 * read `?r=…` and validate against the same zod schema as `localStorage`.
 */

import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";

import { parseAnyRoster } from "@/lib/roster";
import type { Roster } from "@/types/pal";

export function encodeRosterParam(roster: Roster): string {
  return compressToEncodedURIComponent(JSON.stringify(roster));
}

/**
 * Returns a validated `Roster` if the param parses, otherwise null. We do
 * NOT throw — a malformed share link should silently fall back to whatever
 * is in localStorage.
 */
export function decodeRosterParam(value: string | null | undefined): Roster | null {
  if (!value) return null;
  try {
    const json = decompressFromEncodedURIComponent(value);
    if (!json) return null;
    const parsed = JSON.parse(json) as unknown;
    const result = parseAnyRoster(parsed);
    if (!result.ok) return null;
    return result.roster;
  } catch {
    return null;
  }
}
