import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Palworld Breeding Guides",
  description:
    "In-depth guides to Palworld breeding: how power-value math works, how to plan multi-generation chains, how passive inheritance is calculated, and which Pals are worth the chase.",
  canonical: "/guides",
});

export default function GuidesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
