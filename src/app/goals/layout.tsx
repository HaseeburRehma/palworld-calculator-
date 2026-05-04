import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "My Goals",
  description:
    "Save Palworld breeding goals — a target Pal plus the passives you want — and re-plan against your current roster as you catch new Pals. Local-first, browser-only.",
  canonical: "/goals",
});

export default function GoalsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
