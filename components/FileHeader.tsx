// jay. — © 2026 Jay — https://ag0nyy-ops.github.io/ — source viewable, not reusable by others (LICENSE)
import type { ReactNode } from "react";

// A section is a file: a small label, a huge blackletter title with a hairline under it,
// and the file number in outline behind the title.
export function FileHeader({
  number,
  label,
  title,
  children,
  as: Heading = "h1"
}: {
  number: string;
  label: string;
  title: string;
  children?: ReactNode;
  as?: "h1" | "h2";
}) {
  return (
    <header className="file__head">
      <span className="file__ghost" aria-hidden="true">
        {number}
      </span>
      <p className="label">
        File {number} / {label}
      </p>
      <Heading className="title">{title}</Heading>
      {children}
    </header>
  );
}
