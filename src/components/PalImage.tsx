"use client";

import { useState } from "react";
import { getPalImageUrl } from "@/lib/data/pal-image-urls";
import type { Element, Pal } from "@/types/pal";

interface Props {
  pal: Pal;
}

/**
 * Element → hex color. Mirrors the palette in tailwind.config.ts. Used inline
 * (not via Tailwind classes) so dynamic element values don't get purged.
 */
const ELEMENT_HEX: Record<Element, string> = {
  Neutral: "#9ca3af",
  Fire: "#ef4444",
  Water: "#3b82f6",
  Grass: "#22c55e",
  Electric: "#eab308",
  Ice: "#38bdf8",
  Ground: "#a16207",
  Dark: "#7c3aed",
  Dragon: "#f43f5e",
};

/**
 * Renders a Pal's avatar image, falling back to an element-tinted placeholder
 * tile (with the Paldex number) when no asset is available. Lives in its own
 * Client Component because `onError` is a DOM event handler and can't be
 * attached from a Server Component.
 *
 * Source priority (each step falls through to the next on a load error):
 *   1. `pal.imageUrl` (set by the scraper, local or remote)
 *   2. `/pals/<slug>.png` (drop a PNG there and it's picked up automatically)
 *   3. palworld.gg CDN via `getPalImageUrl(pal.id)` — community-fan-site
 *      asset; covers most of the Paldex out of the box. See
 *      `src/lib/data/pal-image-urls.ts` for attribution + the slug mapping.
 *      To self-host instead: run `pnpm download:images` once.
 *   4. Styled placeholder (no network needed)
 */
export function PalImage({ pal }: Props) {
  // Build the chain in priority order, skipping null entries. The component
  // walks down the list as each `<img>` fires `onError`.
  const sources: string[] = [];
  if (pal.imageUrl) sources.push(pal.imageUrl);
  sources.push(`/pals/${pal.slug}.png`);
  const remote = getPalImageUrl(pal.id);
  if (remote) sources.push(remote);
  const [stepIdx, setStepIdx] = useState(0);
  const failed = stepIdx >= sources.length;
  const src = sources[stepIdx];

  const primary = pal.elements[0] ?? "Neutral";
  const accent = ELEMENT_HEX[primary];

  return (
    <div
      className={
        "flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden " +
        "rounded-md ring-1 ring-[rgb(var(--border))]"
      }
      style={
        failed
          ? {
              // Soft element-tinted gradient, readable in light + dark modes.
              backgroundImage: `linear-gradient(135deg, ${accent}33, ${accent}14)`,
            }
          : { backgroundColor: "rgb(var(--background))" }
      }
      aria-hidden={failed ? undefined : true}
      aria-label={failed ? `${pal.name} placeholder` : undefined}
      role={failed ? "img" : undefined}
    >
      {failed ? (
        <span
          className="select-none font-mono text-xs font-semibold tabular-nums"
          style={{ color: accent }}
        >
          #{String(pal.paldexNo).padStart(3, "0")}
        </span>
      ) : (
        // The `key={src}` is intentional — when the source changes mid-life
        // (a step in the fallback chain failed), React remounts a fresh
        // `<img>` rather than reusing the one whose `onError` already fired.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setStepIdx((i) => i + 1)}
        />
      )}
    </div>
  );
}
