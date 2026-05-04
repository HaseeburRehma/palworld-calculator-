import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./tests/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}", "tests/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: [
        "src/lib/breeding/**",
        "src/lib/roster/**",
        "src/lib/goals/**",
        "src/lib/save/**",
      ],
      exclude: ["**/*.test.*", "**/index.ts"],
      thresholds: {
        // Phase-3 promise: ≥90% in the algorithmic & storage cores.
        "src/lib/breeding/**": { lines: 90, functions: 90 },
        "src/lib/roster/**": { lines: 90, functions: 90 },
        // Phase-4 promise: ≥80% in the parser. Lower than the others because
        // some branches handle malformed binary input that's hard to repro
        // beyond fuzz coverage.
        "src/lib/save/**": { lines: 80, functions: 80 },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@data": path.resolve(__dirname, "./data"),
      "@tests": path.resolve(__dirname, "./tests"),
    },
  },
});
