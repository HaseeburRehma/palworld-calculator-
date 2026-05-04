/**
 * Per-Pal Open Graph image route.
 *
 * Next.js 14 picks this file up by convention and exposes it at
 * `/pals/<slug>/opengraph-image`. The page's metadata then references this
 * URL automatically — we don't have to wire it up in `generateMetadata`.
 *
 * Rendering is server-side via `next/og`'s `ImageResponse`, which uses
 * Satori under the hood. That means JSX-as-image: no DOM, a small subset of
 * CSS, only system fonts unless we feed it a font. We stay fontless and let
 * the satori default cover us — fine for OG cards.
 *
 * Cached aggressively: these don't change unless the Pal's stats change.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { allPals, getPalBySlug } from "@/lib/data/pals";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/seo/constants";

export const size = { width: 1200, height: 630 } as const;
export const contentType = "image/png";
export const alt = "Palworld Pal";

/** Static OG-image generation — one PNG per Pal at build time. */
export function generateStaticParams() {
  return allPals.map((p) => ({ slug: p.slug }));
}

const ELEMENT_HEX: Record<string, string> = {
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

export default async function Image({ params }: { params: { slug: string } }) {
  // Load fonts
  const interRegular = readFileSync(join(process.cwd(), "public/fonts/Inter-Regular.ttf"));
  const interBold = readFileSync(join(process.cwd(), "public/fonts/Inter-Bold.ttf"));

  const pal = getPalBySlug(params.slug);
  if (!pal) {
    return new ImageResponse(<DefaultCard />, {
      ...size,
      fonts: [
        { name: "Inter", data: interRegular, weight: 400, style: "normal" },
        { name: "Inter", data: interBold, weight: 700, style: "normal" },
      ],
    });
  }
  const primary = pal.elements[0] ?? "Neutral";
  const accent = ELEMENT_HEX[primary] ?? "#9ca3af";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #0b1d2c 0%, #102536 100%)",
          padding: "48px 64px",
          color: "#e5fbff",
          fontFamily: "Inter, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 28 }}>
          <span style={{ color: accent, fontSize: 40 }}>●</span>
          <span style={{ color: "#9ca3af" }}>{SITE_NAME}</span>
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
            <span style={{ fontSize: 96, fontWeight: 800 }}>{pal.name}</span>
            <span style={{ fontSize: 36, color: "#9ca3af" }}>
              #{String(pal.paldexNo).padStart(3, "0")}
            </span>
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
            {pal.elements.map((e) => {
              const c = ELEMENT_HEX[e] ?? "#9ca3af";
              return (
                <div
                  key={e}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 20px",
                    borderRadius: 999,
                    border: `2px solid ${c}`,
                    color: c,
                    fontSize: 28,
                    fontWeight: 600,
                  }}
                >
                  {e}
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 32, marginTop: 32, fontSize: 32 }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ color: "#9ca3af", fontSize: 20 }}>POWER VALUE</span>
              <span style={{ fontWeight: 700 }}>{pal.powerValue}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ color: "#9ca3af", fontSize: 20 }}>BREEDABLE</span>
              <span style={{ fontWeight: 700 }}>{pal.breedable ? "Yes" : "Special-only"}</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", color: "#9ca3af", fontSize: 22 }}>
          {SITE_TAGLINE}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Inter", data: interRegular, weight: 400, style: "normal" },
        { name: "Inter", data: interBold, weight: 700, style: "normal" },
      ],
    },
  );
}

function DefaultCard() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0b1d2c",
        color: "#e5fbff",
        fontFamily: "Inter, sans-serif",
        fontSize: 64,
      }}
    >
      {SITE_NAME}
    </div>
  );
}
