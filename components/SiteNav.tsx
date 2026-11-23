// jay. — © 2026 Jay — https://ag0nyy-ops.github.io/ — source viewable, not reusable by others (LICENSE)
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Tool" },
  { href: "/methodology/", label: "Method" },
  { href: "/sources/", label: "Sources" },
  { href: "/privacy/", label: "Privacy" }
];

export function SiteNav() {
  const pathname = usePathname() ?? "/";
  const normalized = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return (
    <nav aria-label="Site">
      <ul className="flex flex-wrap items-center gap-x-5 gap-y-0">
        {LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="nav-link whitespace-nowrap"
              aria-current={normalized === link.href ? "page" : undefined}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
