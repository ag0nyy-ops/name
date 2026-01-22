import Link from "next/link";
import { DATASET_INFO, SCORING_MODEL_VERSION } from "../lib/rarity";

function formatDate(value: string | null) {
  if (!value) return "not built yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit"
  });
}

export function SiteFooter() {
  return (
    <footer className="mx-auto w-full max-w-6xl px-6 pb-12 pt-6 text-xs text-mist md:px-10">
      <div className="flex flex-col gap-2 border-t border-white/10 pt-6">
        <span>
          Guarantees: real human names are never rejected as fake. If data is insufficient, we say
          “we don’t know.” Raw inputs are never stored.
        </span>
        <span>
          See the full methodology and caps on the{" "}
          <Link className="text-glacier underline underline-offset-4" href="/methodology">
            methodology page
          </Link>
          .
        </span>
        <span>
          Scoring model {SCORING_MODEL_VERSION} · SSA updated {formatDate(DATASET_INFO.ssa.updatedAt)} ·
          Census updated {formatDate(DATASET_INFO.census.updatedAt)}.
        </span>
        <span>© 2024 whatsmynamerarity. No tracking. No cookies.</span>
      </div>
    </footer>
  );
}
