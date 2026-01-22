import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";

export function SiteHeader() {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 pt-6 md:px-10">
      <div className="flex items-center gap-3">
        <div className="h-2.5 w-2.5 rounded-full bg-aurora/80 shadow-glow" />
        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-mist/80">
          whatsmynamerarity
        </span>
      </div>
      <div className="flex items-center gap-6">
        <nav className="hidden items-center gap-5 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-mist md:flex">
          <Link className="transition hover:text-glacier" href="/">
            Tool
          </Link>
          <Link className="transition hover:text-glacier" href="/methodology">
            Methodology
          </Link>
          <Link className="transition hover:text-glacier" href="/sources">
            Sources
          </Link>
          <Link className="transition hover:text-glacier" href="/privacy">
            Privacy
          </Link>
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}
