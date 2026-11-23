import type { Config } from "tailwindcss";

const themed = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        obsidian: themed("obsidian"),
        graphite: themed("graphite"),
        mist: themed("mist"),
        glacier: themed("glacier"),
        aurora: themed("aurora"),
        line: themed("line"),
        caution: themed("caution")
      },
      boxShadow: {
        glow: "0 0 28px rgb(var(--c-aurora) / 0.25)",
        soft: "0 28px 70px rgb(0 0 0 / var(--shadow-strength))"
      },
      borderRadius: {
        card: "22px"
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Text",
          "SF Pro Display",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif"
        ],
        mono: [
          "SFMono-Regular",
          "ui-monospace",
          "SF Mono",
          "Menlo",
          "Monaco",
          "Consolas",
          "Liberation Mono",
          "monospace"
        ]
      },
      transitionTimingFunction: {
        "out-smooth": "cubic-bezier(0.22, 1, 0.36, 1)"
      }
    }
  },
  plugins: []
};

export default config;
