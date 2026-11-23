// jay. — © 2026 Jay — https://ag0nyy-ops.github.io/ — source viewable, not reusable by others (LICENSE)
import type { Config } from "tailwindcss";

// Tailwind only handles layout here. Colours, type and pieces live in app/globals.css,
// built on the dossier tokens: black and white, every grey mixed from --fg and --bg.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        "bg-2": "var(--bg-2)",
        fg: "var(--fg)",
        muted: "var(--muted)",
        line: "var(--line)",
        "line-strong": "var(--line-strong)"
      },
      fontFamily: {
        goth: ["var(--goth)"],
        mono: ["var(--mono)"],
        sans: ["var(--sans)"]
      },
      maxWidth: {
        page: "var(--max)"
      },
      borderRadius: {
        none: "0"
      },
      transitionTimingFunction: {
        liquid: "cubic-bezier(.22, 1, .36, 1)",
        ink: "cubic-bezier(.65, 0, .35, 1)"
      }
    }
  },
  plugins: []
};

export default config;
