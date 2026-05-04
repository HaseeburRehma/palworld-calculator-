import type { Metadata } from "next";
import Link from "next/link";

import "./globals.css";

import { POPULAR_PAL_SLUGS, SITE_NAME } from "@/lib/seo/constants";
import { defaultMetadata } from "@/lib/seo/metadata";
import {
  jsonLd,
  palworldVideoGameSchema,
  websiteSchema,
} from "@/lib/seo/structured-data";
import { getPalBySlug } from "@/lib/data/pals";

export const metadata: Metadata = defaultMetadata();

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const popular = POPULAR_PAL_SLUGS.map((s) => getPalBySlug(s)).filter(
    (p): p is NonNullable<typeof p> => Boolean(p),
  );

  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-6 sm:px-6 lg:px-8">
          <header className="flex items-center justify-between border-b border-[rgb(var(--border))] pb-4">
            <Link
              href="/"
              className="text-lg font-semibold tracking-tight focus:outline-none"
            >
              {SITE_NAME}
            </Link>
            <nav aria-label="Primary" className="flex items-center gap-4 text-sm">
              <Link href="/" className="text-[rgb(var(--muted))] hover:underline">
                Calculator
              </Link>
              <Link href="/plan" className="text-[rgb(var(--muted))] hover:underline">
                Plan
              </Link>
              <Link href="/roster" className="text-[rgb(var(--muted))] hover:underline">
                Roster
              </Link>
              <Link href="/goals" className="text-[rgb(var(--muted))] hover:underline">
                Goals
              </Link>
              <Link href="/import" className="text-[rgb(var(--muted))] hover:underline">
                Import
              </Link>
              <Link href="/guides" className="text-[rgb(var(--muted))] hover:underline">
                Guides
              </Link>
              <Link href="/faq" className="text-[rgb(var(--muted))] hover:underline">
                FAQ
              </Link>
            </nav>
          </header>
          <main className="flex-1 py-8">{children}</main>
          <footer className="mt-8 space-y-3 border-t border-[rgb(var(--border))] pt-4 text-xs text-[rgb(var(--muted))]">
            {popular.length > 0 && (
              <nav aria-label="Popular Pals">
                <p className="font-medium text-[rgb(var(--foreground))]">Popular Pals</p>
                <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                  {popular.map((p) => (
                    <li key={p.id}>
                      <Link href={`/pals/${p.slug}`} className="hover:underline">
                        {p.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Link href="/faq" className="hover:underline">
                FAQ
              </Link>
              <Link href="/guides" className="hover:underline">
                Guides
              </Link>
              <Link href="/privacy" className="hover:underline">
                Privacy
              </Link>
              <span aria-hidden>·</span>
              <span>Unofficial fan tool. Not affiliated with Pocketpair.</span>
            </div>
          </footer>
        </div>

        {/* Site-wide JSON-LD: WebSite + VideoGame anchors. Per-page schemas
            (BreadcrumbList, Pal, FAQPage, Article) are emitted by the
            individual pages so they're scoped correctly. */}
        {/* eslint-disable-next-line @next/next/no-script-component-in-head */}
        <script {...jsonLd(websiteSchema())} />
        {/* eslint-disable-next-line @next/next/no-script-component-in-head */}
        <script {...jsonLd(palworldVideoGameSchema())} />
      </body>
    </html>
  );
}
