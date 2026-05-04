import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Plan a Breed",
  description:
    "Pick a Palworld target and desired passive skills, see every parent pair ranked by obtainability with live probability and expected egg counts. Or use roster mode to find the shortest breeding chain from your owned Pals.",
  canonical: "/plan",
});

export default function PlanLayout({ children }: { children: React.ReactNode }) {
  return children;
}
