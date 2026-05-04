# Palworld Breeding Calculator

A web app for figuring out which Pals breed into which, plus how likely you are to roll the passive set you want. Built with Next.js 14 (App Router), TypeScript, and Tailwind CSS.

## Phase 4 — current scope

- **Forward lookup** (Phase 1): pick two parents on the home page, see the resulting child Pal.
- **Reverse lookup** (Phase 2): every parent pair that produces a target Pal, ranked by obtainability. Available on every per-Pal page and on the `/plan` page.
- **Passive-skill inheritance math** (Phase 2): closed-form combinatorics for the probability of a child rolling a specific passive set, plus expected egg counts.
- **`/plan` page** with two modes:
  - **Any parents** (Phase 2 behavior): every theoretical parent pair, ranked.
  - **From my roster** (Phase 3): pathfinder finds the shortest breeding chain that uses Pals you actually own.
- **`/roster` page** (Phase 3): track your owned Pals + their passives. Local-only, JSON import/export.
- **`/goals` page** (Phase 3): save target Pal + desired-passive combos and re-plan against your current roster.
- **Multi-generation pathfinder** (Phase 3): two-phase search (species path → passive accumulation), runs in a Web Worker so the UI stays smooth. Up to 5 ranked plans per query, depth-capped at 6 breedings.
- **Share links with compressed roster state** (Phase 3): the roster mode URL embeds your current collection so plans are reproducible across devices.
- **Save-file import** (Phase 4): drop your Palworld `.sav` file at [/import](./src/app/import/page.tsx). The parser runs entirely in your browser inside a Web Worker — your save never leaves your device. Smart-merge mode dedupes re-imports without losing manually-added Pals. Diagnostics-copy button surfaces unmapped ids for easy bug reports.
- **Privacy page** at [/privacy](./src/app/privacy/page.tsx) documenting exactly what is and isn't stored, and how to verify the no-upload claim.
- **Per-Pal pages** at `/pals/[slug]` for every Pal, pre-rendered with proper metadata for SEO.
- **Pure breeding engine** (`src/lib/breeding/`) with no React or Next dependencies — engine, ranking, passive math, and pathfinder all live there.
- **Pure save-file parser** (`src/lib/save/`) with no React, no DOM, just `ArrayBuffer` + `Uint8Array`. GVAS reader, Palworld PlZ decompression, mapping tables.

### Known limitations & future work

The pathfinder uses a heuristic two-phase decomposition (species-path BFS, then passive accumulation along each path). Solving them jointly is intractable for non-trivial graphs. The result is the cheapest plan ~95% of the time, not provably optimal. The depth cap of 6 is observable in dev (look for `diagnostics.hitDepthLimit`) — tune `MAX_PATH_DEPTH` in `src/lib/breeding/pathfind.ts` once we have real data.

Phase 3 deliberately does **not** model:

- **Gender restrictions** — pairing requires opposite sexes in-game. Future work: a strict-mode toggle that filters incompatible pairs.
- **Breeding cooldowns** — Pals need rest between breeds. Affects throughput but not feasibility.
- **Item-based passive transfers** — community-discovered tricks that move passives outside the breeding mechanic.
- **Save-file import** — Phase 4 will let users sync their roster from a Palworld save instead of typing it in.

## Quick start

```sh
pnpm install        # or `npm install`
pnpm dev            # http://localhost:3000
```

Other scripts:

```sh
pnpm typecheck             # tsc --noEmit
pnpm lint                  # next lint
pnpm test                  # vitest run
pnpm test:watch            # vitest watch mode
pnpm build                 # next build (validates the per-Pal static export too)
pnpm scrape                # full data pipeline: pals → combos → passives → reverse-index
pnpm scrape:pals           # individual stages
pnpm scrape:combos
pnpm scrape:passives
pnpm build:reverse-index   # rebuild data/reverse-index.json from current pals/combos
```

Node 20+ is assumed.

## Project structure

```
palworld-breeding-calculator/
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── layout.tsx
│   │   ├── page.tsx               # Home: forward-lookup calculator + CTA to /plan
│   │   ├── plan/page.tsx          # Phase 2: target Pal + desired passives
│   │   ├── globals.css
│   │   └── pals/[slug]/page.tsx   # Per-Pal SEO page (now with reverse lookup)
│   ├── components/
│   │   ├── PalSelect.tsx          # Searchable Pal dropdown (a11y)
│   │   ├── PassiveSelect.tsx      # Multi-select max-4 passives w/ tier groups
│   │   ├── PassiveBadge.tsx       # Tier-color-coded chip
│   │   ├── ReverseLookupTable.tsx # Ranked parent-pair table
│   │   ├── BreedingResult.tsx     # Result card / empty state
│   │   ├── PalCard.tsx            # Reusable Pal display
│   │   ├── ElementBadge.tsx
│   │   └── ui/Card.tsx            # Generic primitive
│   ├── lib/
│   │   ├── save/                  # Phase 4: PURE save-file parser
│   │   │   ├── parser.ts          # parseSaveFile() pipeline
│   │   │   ├── decompress.ts      # PlZ container handler
│   │   │   ├── gvas/              # Generic GVAS binary reader
│   │   │   ├── extractors/        # Palworld-specific extraction logic
│   │   │   └── mappings/          # game-id → our-id tables (drift here on patch)
│   │   ├── breeding/              # PURE: no React/Next imports here
│   │   │   ├── engine.ts          # Core breeding logic
│   │   │   ├── engine.test.ts     # + reverse-index round-trip
│   │   │   ├── ranking.ts         # Phase 2: parent-pair obtainability scoring
│   │   │   ├── ranking.test.ts
│   │   │   ├── passives.ts        # Phase 2: inheritance probability math
│   │   │   ├── passives.test.ts
│   │   │   └── types.ts
│   │   ├── data/
│   │   │   ├── pals.ts            # Imports + validates data/pals.json
│   │   │   ├── combos.ts          # Imports + validates data/combos.json
│   │   │   ├── passives.ts        # Phase 2: master passive list
│   │   │   └── reverse-index.ts   # Phase 2: childId → parent pairs
│   │   └── utils/
│   │       ├── slug.ts
│   │       └── url-params.ts      # Phase 2: shareable /plan URLs
│   └── types/pal.ts               # Pal, BreedingCombo, PassiveSkill, …
├── data/
│   ├── pals.json                  # Bundled Pal DB
│   ├── combos.json                # Special breeding combos
│   ├── passives.json              # Phase 2: master passive catalog
│   ├── reverse-index.json         # Phase 2: built by build-reverse-index.ts
│   └── README.md                  # Schema + recommended sources
├── scripts/
│   ├── scrape-pals.ts
│   ├── scrape-combos.ts
│   ├── scrape-passives.ts         # Phase 2 stub
│   ├── build-reverse-index.ts     # Phase 2: reuses src/lib/breeding/engine.ts
│   └── lib/
│       ├── fetcher.ts             # Polite, throttled, cached HTTP
│       └── parsers.ts             # Source-specific parsing (stubs)
├── public/pals/                   # Pal images, written by scraper
└── tests/fixtures/                # Hand-built test fixtures
```

## The breeding algorithm in plain English

When you breed two Pals:

1. **Special combination check** — there's a small lookup table of pre-defined parent pairs that always produce a specific child (e.g. `Mau + Pengullet → Mau Cryst`). If the parents match a row in this table (in either order), that child is the answer and we stop.
2. **Same-species shortcut** — breeding a Pal with the same species returns that species.
3. **Power-value calculation** — otherwise we compute `target = floor((parentA.powerValue + parentB.powerValue + 1) / 2)`, then pick the **breedable** Pal whose `powerValue` is closest to that target. Variants and special-combo-only Pals are excluded from the candidate pool.
4. **Tie-breaker** — if two Pals are equally close, the one with the lower Paldex number wins. This is a documented placeholder rule (`TIE_BREAKER` comment in `engine.ts`); the community-canonical rule is more nuanced and will be made injectable in Phase 2.

The engine lives in `src/lib/breeding/engine.ts` as pure functions and is fully unit-tested.

## Reverse lookup and ranking

`scripts/build-reverse-index.ts` runs the engine across every unordered pair of Pals and emits `data/reverse-index.json`, mapping `childId → Array<{parentA, parentB}>`. The web app imports this as a static module — reverse lookup is O(1) at runtime. A round-trip test in `engine.test.ts` re-runs `breed()` over every indexed pair, so the moment the engine drifts from the index, tests fail.

`src/lib/breeding/ranking.ts` scores parent pairs by **obtainability** so the most useful pairs surface first. Lower combined Paldex number is better, same primary element gets a small bonus, and breed-only parents are heavily penalized. Weights are exported constants — tune them by editing one block.

## Passive inheritance math

`src/lib/breeding/passives.ts` implements the model below as **closed-form combinatorics** (no Monte Carlo — the state space is tiny):

1. Inheritance count K is sampled from a tunable distribution `[P(K=1), P(K=2), P(K=3), P(K=4)]`. Capped at the parent passive pool size.
2. K passives are drawn uniformly without replacement from the union of both parents' passives.
3. For each remaining slot up to `maxPassives`, with probability `wildPassiveChance`, a uniformly random passive from the global list is added.

It exports `probabilityOfAtLeastPassives`, `probabilityOfExactPassives`, and `expectedEggCount`. All three are pure functions; tests cover hand-checked closed-form values, edge cases, and a random property-style sweep.

> ⚠ **The constants (`countDistribution`, `wildPassiveChance`) are placeholders based on community estimates as of Phase 2 launch.** They are NOT official numbers. If Pocketpair publishes them or the community tightens the consensus, the entire model lives in one block at the top of `passives.ts` — a single edit updates the whole calculator.

## Running the scraper

The scraper is **source-agnostic** — it reads the base URL from `PAL_DATA_SOURCE`. You pick the source, the scraper does the rest.

```sh
cp .env.example .env
# Edit .env and set:
#   PAL_DATA_SOURCE=https://example.com
#   SCRAPER_CONTACT_EMAIL=you@example.com
pnpm scrape
```

See `data/README.md` for recommended sources (paldb.cc, palworld.gg, the Palworld Fandom wiki) and the Pal/Combo schemas. The fetcher is throttled to ~1 req/sec and caches responses to `.cache/` so re-runs are free.

**Phase 1 caveat:** the source-specific parsing in `scripts/lib/parsers.ts` is intentionally stubbed. Once you pick a source, implement those parsers against its HTML/JSON. Until then the app runs on the hand-curated `data/pals.json` (~25 Pals).

## Conventions

- **Strict TypeScript.** No `any`. Lint enforces this.
- **Pure breeding engine.** Anything under `src/lib/breeding/` is forbidden from importing React, Next, the file system, or the network.
- **Read-only data at runtime.** The scraper writes `data/`, the app imports it. There's no runtime fetching for Pal data.
- **Small, single-purpose components.** Hand-written, no UI library yet.
- **No state-management library.** React state is enough for v1.
- **Tests use hand-built fixtures**, not the scraped data, so they're stable.

## SEO

The site is set up to rank. Every route runs through a typed metadata helper, structured data is emitted per page type, and the per-Pal pages carry unique narrative content. See [`docs/SEO_CHECKLIST.md`](./docs/SEO_CHECKLIST.md) for the per-page list.

Key files:

- `src/lib/seo/constants.ts` — `SITE_NAME`, `SITE_URL`, default OG image, popular-Pal slugs. One source of truth for site-wide branding.
- `src/lib/seo/metadata.ts` — `buildMetadata({ title, description, canonical, … })`. Every page calls this rather than hand-rolling a `Metadata` object.
- `src/lib/seo/structured-data.ts` — JSON-LD builders for `WebSite`, `VideoGame`, `BreadcrumbList`, `Thing` (Pal), `FAQPage`, `Article`. Validate against [Google's Rich Results Test](https://search.google.com/test/rich-results) before relying on a new schema.
- `src/lib/seo/pal-description.ts` — narrative paragraph generator for per-Pal pages. Categorizes each Pal (legendary / variant / breed-only / starter / common-breeder / midgame / endgame) and picks one of N structurally distinct templates per category, hashed off the Pal id for determinism. A `data/pal-descriptions.json` file lets you override individual Pals with hand-written copy as you climb the search-volume ladder.
- `src/middleware.ts` — 301-redirects any URL with uppercase chars or a trailing slash to the canonical lowercase form.
- `src/app/sitemap.ts` and `src/app/robots.ts` — App Router conventions; render `/sitemap.xml` and `/robots.txt` automatically.

Tooling:

```sh
pnpm seo:audit    # scans every sitemap URL — title, description, canonical, OG, H1 count, JSON-LD, alt text. Build-blocking on errors.
pnpm test:ld      # validates the JSON-LD shape on every page. Catches missing fields before Google does.
pnpm lighthouse   # runs Lighthouse against a sample of routes; warns by default, set LIGHTHOUSE_STRICT=1 to block.
pnpm a11y         # runs pa11y/axe against a representative subset; warns by default, set A11Y_STRICT=1 to block.
```

The Lighthouse and a11y scripts shell out via `npx` so contributors don't need a global install. They expect a server already running (`pnpm start &`).

## Content

Long-form articles live under `content/guides/` as MDX. Each file has YAML-ish front matter and a Markdown+JSX body:

```mdx
---
title: "How Palworld breeding actually works"
description: "Plain-English walkthrough of the power-value formula …"
publishedAt: "2026-05-04"
updatedAt: "2026-05-04"
author: "Palworld Breeding Calculator"
tags: [breeding, fundamentals]
featured: true
---

…body in Markdown, with React components if you want them…
```

The renderer (`src/app/guides/[slug]/page.tsx`) uses `next-mdx-remote` with two remark plugins:

- `remark-gfm` — GitHub-flavored markdown (tables, task lists, strikethrough).
- `autoLinkPals` (custom, `src/lib/mdx/plugins/auto-link-pals.ts`) — auto-links the first occurrence of any Pal name in each text node to its `/pals/<slug>` page. Saves writer effort and keeps internal linking consistent.

To add a guide: drop a new `.mdx` file into `content/guides/`. The route, sitemap, and `Article` JSON-LD are wired automatically.

## Performance budgets

| Metric | Home | Per-Pal |
| --- | --- | --- |
| Transferred | ≤ 200 KB | ≤ 350 KB |
| LCP (4G mobile) | ≤ 2.0 s | ≤ 2.5 s |
| CLS | ≤ 0.05 | ≤ 0.05 |
| INP | ≤ 100 ms | ≤ 100 ms |

A few explicit non-decisions worth calling out:

- **No third-party scripts.** No analytics, no error trackers, no ads, no SDKs. The Privacy page documents this and `useNetworkSentinel` enforces it on the import flow in dev.
- **No web fonts in v1.** `system-ui` is faster than any served font and zero CLS. If a brand font becomes important later, `next/font/local` is one file away — don't introduce Google Fonts at runtime.
- **Per-Pal OG images are static.** `src/app/pals/[slug]/opengraph-image.tsx` runs at build time via `next/og`'s `ImageResponse`. Cached aggressively; doesn't add to the runtime bundle.

## Roadmap

- ✅ **Phase 1 — Forward lookup.** Engine + UI + data pipeline.
- ✅ **Phase 2 — Reverse lookup + passive math.** Ranked parent pairs, inheritance probabilities, expected egg counts, shareable plan URLs.
- ✅ **Phase 3 — Roster + multi-generation pathfinding.** Local-first roster, two-phase breeding-graph search in a Web Worker, breeding-tree visualization, saved goals, compressed share links.
- ✅ **Phase 4 — Save-file import.** Browser-side `.sav` parsing, drop-zone UI with virtualized preview, smart-merge against existing roster, mapping canary script, dedicated `/privacy` page.
- ✅ **Phase 1.5 — SEO foundation.** Metadata helper, sitemap + robots + middleware, JSON-LD on every page, per-Pal narrative + FAQ + dynamic OG card, MDX guide hub, breadcrumbs, audit tooling. The site is technically ready to rank — actual ranking takes 2–6 months of trust-building + real guide content + earned inbound links.
- **Phase 5 — Polish + launch.** Loading states, empty states, real design pass, social sharing, content writing for the guide hub.

## Credits

This project's save-file parser was written from scratch but learned heavily from existing community work. Format docs, validation behaviors, and the Palworld-specific quirks (PlZ container, `CharacterSaveParameterMap` with `Guid` keys, the `RawData` blob convention) are publicly documented; we owe particular thanks to:

- **`palworld-save-tools`** — the Python reference implementation maintained by the Palworld modding community (search GitHub for the most active fork; ownership has changed over time). We don't ship its code, but the format notes and field names in our extractors trace back to it. If you find a parser bug here, check that project for the same fix; if it's a Palworld patch issue we caught first, please send a fix upstream too.
- **palworld.gg** — fellow fan site whose published Pal-portrait catalog (`/images/full_palicon/T_*_icon_normal.png`) we resolve as a fallback in `PalImage`. The slug→asset-name mapping lives in `src/lib/data/pal-image-urls.ts`. Pal art is © Pocketpair, Inc. — palworld.gg republishes it the same way we do, as a fan tool. If you'd rather not depend on their CDN, run `pnpm download:images` once and the files will live under `public/pals/<slug>.png`.
- The wider Palworld modding/data-mining community on Reddit and Discord, who have repeatedly reverse-engineered the format across patches.

If you spot Pal or passive ids the parser doesn't recognize after a Palworld patch, please [open an issue](#) with the diagnostics output (the **Copy diagnostics** button in `/import` is built for exactly this) — we'd rather find drift fast than silently miss data.

## License & attribution

Unofficial fan tool. Not affiliated with Pocketpair. Pal names, Paldex numbers, and game data are © Pocketpair, Inc.
