import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";

export function SiteHeader() {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 pt-8 md:px-10">
      <div className="flex items-center gap-3">
        <div className="h-3 w-3 rounded-full bg-aurora/80 shadow-glow" />
        <span className="text-sm font-semibold uppercase tracking-[0.4em] text-mist">
          name rarity
        </span>
      </div>
      <nav className="flex items-center gap-6 text-xs font-semibold uppercase tracking-[0.2em] text-mist">
        <Link className="transition hover:text-glacier" href="/">
          Tool
        </Link>
        <Link className="transition hover:text-glacier" href="/methodology">
          Methodology
        </Link>
        <Link className="transition hover:text-glacier" href="/privacy">
          Privacy
        </Link>
      </nav>
      <ThemeToggle />
    </header>
  );
}
