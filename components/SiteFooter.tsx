// jay. — © 2026 Jay — https://ag0nyy-ops.github.io/ — source viewable, not reusable by others (LICENSE)
import Link from "next/link";
import { DATASETS, MODEL_VERSION } from "../lib/engine";

function formatDate(value: string | null) {
  if (!value) return "unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  });
}

export function SiteFooter() {
  return (
    <footer className="site-foot mt-24">
      <div className="page flex flex-col gap-6 pb-12 pt-10">
        <p className="site-foot__word hollow" aria-hidden="true">
          Name rarity
        </p>
        <div className="grid gap-6 text-sm text-muted sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <p className="label">Terms of the file</p>
            <p>
              Estimates, not lookups. This never searches for real people, and
              names you type never leave your browser.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <p className="label">Model {MODEL_VERSION}</p>
            <p>
              Data built {formatDate(DATASETS.first.generatedAt)} from{" "}
              <Link className="text-link" href="/sources/">
                SSA and Census public data
              </Link>
              . See{" "}
              <Link className="text-link" href="/methodology/">
                how it works
              </Link>
              .
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <p className="label">Filed by</p>
            <p>
              <a className="text-link" href="https://ag0nyy-ops.github.io/">
                Jay
              </a>
              . No tracking, no cookies.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
