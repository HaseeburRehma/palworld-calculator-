import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "media",
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Palworld element colors — used for badges. Approximate, swap when scraper lands.
        element: {
          neutral: "#9ca3af",
          fire: "#ef4444",
          water: "#3b82f6",
          grass: "#22c55e",
          electric: "#eab308",
          ice: "#38bdf8",
          ground: "#a16207",
          dark: "#7c3aed",
          dragon: "#f43f5e",
        },
      },
      fontFamily: {
        sans: ["system-ui", "ui-sans-serif", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
