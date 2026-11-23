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
    <footer className="mx-auto w-full max-w-6xl px-4 pb-12 pt-6 text-xs text-mist sm:px-6 md:px-10">
      <div className="flex flex-col gap-2 border-t border-line/10 pt-6">
        <span>
          Estimates, not lookups: this never searches for real people, and names
          you type never leave your browser.
        </span>
        <span>
          Scoring model {MODEL_VERSION} · data built{" "}
          {formatDate(DATASETS.first.generatedAt)} from{" "}
          <Link className="text-link" href="/sources/">
            SSA and Census public data
          </Link>{" "}
          ·{" "}
          <Link className="text-link" href="/methodology/">
            how it works
          </Link>
        </span>
        <span>whatsmynamerarity · no tracking, no cookies.</span>
      </div>
    </footer>
  );
}
