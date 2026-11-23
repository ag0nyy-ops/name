import type { ReactNode } from "react";

export const THEME_STORAGE_KEY = "name-rarity-theme";

/** Runs before paint so a saved light theme never flashes dark first. */
export const THEME_SCRIPT = `try{if(localStorage.getItem("${THEME_STORAGE_KEY}")==="light")document.documentElement.classList.add("light")}catch(e){}`;

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell min-h-screen bg-obsidian text-glacier">
      <div className="relative z-10">{children}</div>
    </div>
  );
}
