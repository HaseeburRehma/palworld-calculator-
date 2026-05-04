import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Import Save File",
  description:
    "Drop your Palworld .sav file to populate your roster automatically. Parsing happens entirely in your browser — your save is never uploaded or sent anywhere.",
  canonical: "/import",
});

export default function ImportLayout({ children }: { children: React.ReactNode }) {
  return children;
}
