/**
 * Remark plugin: auto-link Pal names in MDX text nodes.
 *
 * The plugin walks every text node in the AST, scans for any Pal name from
 * `data/pals.json` (case-insensitive, whole-word), and replaces the first
 * occurrence per text node with a `<Link>` to that Pal's page. Subsequent
 * occurrences are left as plain text — over-linking is a real SEO penalty.
 *
 * Skips text nodes that are already inside a link (so we don't nest links)
 * and code blocks (so technical strings don't get mangled).
 *
 * The plugin is intentionally simple — about 60 lines of logic. If we ever
 * need richer behavior (per-paragraph rather than per-node, alias lookup,
 * etc.) it's easy to extend.
 */

import type { Plugin } from "unified";
import type { Root, Text } from "mdast";

import { allPals } from "@/lib/data/pals";

interface PluginOptions {
  /** Override the link path generator. Default: `/pals/<slug>`. */
  hrefFor?: (palSlug: string) => string;
}

export const autoLinkPals: Plugin<[PluginOptions?], Root> = (options = {}) => {
  // Build the lookup once. Sort by name length DESCENDING so "Mau Cryst"
  // matches before "Mau".
  const palByLowerName = new Map<string, { slug: string; name: string }>();
  for (const p of allPals) palByLowerName.set(p.name.toLowerCase(), { slug: p.slug, name: p.name });
  const sortedNames = [...palByLowerName.keys()].sort((a, b) => b.length - a.length);
  if (sortedNames.length === 0) {
    return () => undefined;
  }
  // Whole-word match, case-insensitive. Anchored boundaries are word-class
  // since Pal names are alphanumeric.
  const escaped = sortedNames.map((n) => n.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"));
  const regex = new RegExp(`\\b(${escaped.join("|")})\\b`, "i");
  const hrefFor = options.hrefFor ?? ((slug: string) => `/pals/${slug}`);

  return (tree) => {
    visitTextSafely(tree, (node, index, parent) => {
      if (!parent || index === undefined) return;
      // Don't replace inside an existing link, code, or inline-code node.
      if (parent.type === "link" || parent.type === "code" || parent.type === "inlineCode") {
        return;
      }
      const m = regex.exec(node.value);
      if (!m) return;
      const matched = m[0]!;
      const lower = matched.toLowerCase();
      const ref = palByLowerName.get(lower);
      if (!ref) return;
      const before = node.value.slice(0, m.index);
      const after = node.value.slice(m.index + matched.length);
      const replacement: Array<Text | { type: "link"; url: string; children: Array<Text> }> = [];
      if (before) replacement.push({ type: "text", value: before } as Text);
      replacement.push({
        type: "link",
        url: hrefFor(ref.slug),
        children: [{ type: "text", value: matched } as Text],
      });
      if (after) replacement.push({ type: "text", value: after } as Text);
      // Splice the replacement nodes into the parent in place of the original.
      // We deliberately replace only the FIRST match per text node to avoid
      // over-linking dense paragraphs.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (parent as any).children.splice(index, 1, ...replacement);
    });
  };
};

/* -------------------------------------------------------------------------- */
/*  Tiny tree walker — avoid pulling in `unist-util-visit` for one use.       */
/* -------------------------------------------------------------------------- */

type Visitor = (
  node: Text,
  index: number | undefined,
  parent: { type: string; children?: Array<unknown> } | undefined,
) => void;

function visitTextSafely(tree: Root, visitor: Visitor): void {
  walk(tree, undefined, undefined);

  function walk(
    node: { type: string; children?: Array<unknown>; value?: string },
    index: number | undefined,
    parent: { type: string; children?: Array<unknown> } | undefined,
  ): void {
    if (node.type === "text") {
      visitor(node as Text, index, parent);
    }
    if (Array.isArray(node.children)) {
      // Iterate by index so the visitor's splice doesn't shift things on us
      // mid-loop. We only ever increase the children count by replacing 1
      // node with 1–3 — recompute the next index from the post-splice length.
      let i = 0;
      while (i < node.children.length) {
        const child = node.children[i] as { type: string; children?: Array<unknown> };
        const before = node.children.length;
        walk(child, i, node);
        const after = node.children.length;
        i += after - before + 1;
      }
    }
  }
}
