import Link from "next/link";
import { SiteNav } from "./SiteNav";
import { ThemeToggle } from "./ThemeToggle";

export function SiteHeader() {
  return (
    <header className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 pt-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 md:px-10">
      <a
        href="#main"
        className="sr-only-focusable button-quiet absolute left-4 top-2 z-50"
      >
        Skip to content
      </a>
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-3">
          <span
            className="h-2.5 w-2.5 rounded-full bg-aurora/80 shadow-glow"
            aria-hidden="true"
          />
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-mist">
            whatsmynamerarity
          </span>
        </Link>
        <div className="sm:hidden">
          <ThemeToggle />
        </div>
      </div>
      <div className="flex items-center gap-5">
        <SiteNav />
        <div className="hidden sm:block">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
