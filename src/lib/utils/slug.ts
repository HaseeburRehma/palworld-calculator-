/**
 * Slugify a Pal name into a URL-safe identifier.
 * Conservative: lowercases, strips non-[a-z0-9], collapses runs of "-".
 *
 * Pure, no dependencies — safe to use anywhere.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
