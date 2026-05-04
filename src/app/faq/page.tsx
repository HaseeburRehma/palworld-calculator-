import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { buildMetadata } from "@/lib/seo/metadata";
import { faqSchema, jsonLd, type FaqEntry } from "@/lib/seo/structured-data";

export const metadata: Metadata = buildMetadata({
  title: "Palworld Breeding FAQ",
  description:
    "Answers to the most common Palworld breeding questions: how the calculator works, what the power-value formula does, how passive inheritance is computed, and where the data comes from.",
  canonical: "/faq",
});

const FAQS: FaqEntry[] = [
  {
    question: "How does Palworld breeding actually work?",
    answer:
      "When you breed two Pals, the game first checks a small table of special parent pairs that always produce a specific child (e.g. Mau + Pengullet → Mau Cryst). If no special rule matches, the child is the breedable Pal whose power value is closest to floor((parentA.powerValue + parentB.powerValue + 1) / 2). The calculator computes both paths and shows the result.",
  },
  {
    question: "What is power value?",
    answer:
      "Power value (sometimes called CombiRank) is a hidden number used purely for breeding math — it is not the same as combat strength. Lower-power-value Pals breed into lower-power-value children; the calculator's pages and tables surface this number for every Pal so you can predict what a pair will produce.",
  },
  {
    question: "How does passive-skill inheritance work?",
    answer:
      "The community-best-effort model: an inheritance count K is sampled from a small distribution, K passives are drawn uniformly from the union of both parents' passives, and any remaining slots up to four can roll a wild passive. The calculator runs this as closed-form combinatorics and reports the probability and expected egg count for any desired set.",
  },
  {
    question: "Why do egg counts say '500+' or 'infinity'?",
    answer:
      "The math saturates at 500 in the UI for readability — anything above that is, in practice, 'reroll your strategy'. Infinity means the desired passive set is unreachable from those parents (no inheritance path covers it and the wild-roll math can't either). Pick parents that already carry at least some of the desired passives.",
  },
  {
    question: "Where does the data come from?",
    answer:
      "The Pal table, breeding combos, and passive list are scraped at build time from community-maintained references and bundled as JSON. There is no runtime data fetching — the calculator works fully offline once loaded.",
  },
  {
    question: "Is this tool affiliated with Pocketpair?",
    answer:
      "No. This is an unofficial fan tool. Pal names, Paldex numbers, and game data are © Pocketpair, Inc. We're not endorsed by or associated with them.",
  },
  {
    question: "Can I import my Palworld save file?",
    answer:
      "Yes — the /import page accepts a .sav file and parses it entirely in your browser. Your save never leaves your device. See the privacy page for how to verify that.",
  },
  {
    question: "Why aren't all 150+ Pals in the calculator yet?",
    answer:
      "We're shipping in phases. Phase 1 included a hand-curated subset (~25 Pals) so the engine and UI are testable end-to-end. As the scraper is pointed at a real source the data file expands; nothing in the engine changes when it does.",
  },
];

export default function FaqPage() {
  return (
    <div className="space-y-6">
      <Breadcrumbs
        crumbs={[
          { name: "Home", href: "/" },
          { name: "FAQ", href: "/faq" },
        ]}
      />
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Palworld breeding — FAQ
        </h1>
        <p className="mt-1 max-w-prose text-sm text-[rgb(var(--muted))]">
          Quick answers to the questions that come up most often. For more
          depth, see the{" "}
          <Link href="/guides" className="hover:underline">
            guides hub
          </Link>
          .
        </p>
      </header>

      <dl className="space-y-3">
        {FAQS.map((q) => (
          <div
            key={q.question}
            className="rounded-md border border-[rgb(var(--border))] p-3"
          >
            <dt className="text-sm font-semibold">{q.question}</dt>
            <dd className="mt-1 text-sm text-[rgb(var(--muted))]">{q.answer}</dd>
          </div>
        ))}
      </dl>

      {/* eslint-disable-next-line @next/next/no-script-component-in-head */}
      <script {...jsonLd(faqSchema(FAQS))} />
    </div>
  );
}
