// jay. — © 2026 Jay — https://ag0nyy-ops.github.io/ — source viewable, not reusable by others (LICENSE)
import Link from "next/link";
import { EyeMark } from "./EyeMark";
import { SiteNav } from "./SiteNav";

export function SiteHeader() {
  return (
    <header className="site-head">
      <a
        href="#main"
        className="sr-only-focusable btn btn--solid absolute left-4 top-2 z-[60]"
      >
        Skip to content
      </a>
      <div className="page flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/" className="brand" aria-label="Name rarity, home">
          <EyeMark className="brand__eye" />
          <span className="brand__word">Name rarity</span>
        </Link>
        <SiteNav />
      </div>
    </header>
  );
}
