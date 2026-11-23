"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Tool" },
  { href: "/methodology/", label: "Methodology" },
  { href: "/sources/", label: "Sources" },
  { href: "/privacy/", label: "Privacy" }
];

export function SiteNav() {
  const pathname = usePathname() ?? "/";
  const normalized = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return (
    <nav
      aria-label="Site"
      className="flex items-center gap-4 overflow-x-auto sm:gap-5"
    >
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="nav-link whitespace-nowrap"
          aria-current={normalized === link.href ? "page" : undefined}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
