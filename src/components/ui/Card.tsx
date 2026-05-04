import type { HTMLAttributes } from "react";

/**
 * Tiny presentational card primitive. Hand-written on purpose — no external
 * UI lib in Phase 1 so we can swap to shadcn or similar later without a
 * migration headache.
 */
export function Card({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={
        "rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--card))] " +
        "p-4 shadow-sm " +
        className
      }
      {...props}
    />
  );
}
