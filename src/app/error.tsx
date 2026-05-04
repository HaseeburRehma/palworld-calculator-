"use client";

import Link from "next/link";

/**
 * Root error boundary. Brief by design — no stack traces, no error code
 * theatre. We trust the user to retry or jump back.
 *
 * Per Next.js convention this must be a Client Component.
 */
export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Something went wrong
        </h1>
        <p className="mt-1 max-w-prose text-sm text-[rgb(var(--muted))]">
          An unexpected error stopped the page from rendering. You can try
          again, or head back to the calculator.
        </p>
      </header>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className={
            "rounded-md bg-[rgb(var(--foreground))] px-3 py-1.5 text-sm font-medium " +
            "text-[rgb(var(--background))]"
          }
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-md border border-[rgb(var(--border))] px-3 py-1.5 text-sm hover:border-[rgb(var(--ring))]"
        >
          Back to calculator
        </Link>
      </div>
    </div>
  );
}
