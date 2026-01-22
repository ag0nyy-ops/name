"use client";

import { useThemeToggle } from "./ThemeProvider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useThemeToggle();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="theme-toggle"
      aria-label="Toggle light or dark mode"
    >
      {theme === "dark" ? "Dark" : "Light"}
    </button>
  );
}
