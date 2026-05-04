import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "My Roster",
  description:
    "Track the Palworld Pals you own and the passive skills on each. The roster powers the multi-step breeding planner — your data stays local, in your browser only.",
  canonical: "/roster",
});

export default function RosterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
