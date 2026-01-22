"use client";

import { ReactNode, useEffect, useState } from "react";

type Theme = "dark" | "light";

type ThemeProviderProps = {
  children: ReactNode;
};

const STORAGE_KEY = "name-rarity-theme";

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.body.classList.toggle("light", theme === "light");
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
    const nextTheme = stored ?? "dark";
    setTheme(nextTheme);
    applyTheme(nextTheme);
  }, []);

  useEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  return (
    <div className="app-shell min-h-screen bg-obsidian text-glacier">
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export function useThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
    const nextTheme = stored ?? "dark";
    setTheme(nextTheme);
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      applyTheme(next);
      window.localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  };

  return { theme, toggleTheme };
}
