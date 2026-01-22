import Link from "next/link";
import specialCases from "../../data/specialCases.json";
import { DATASET_INFO } from "../../lib/rarity";

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

export default function SourcesPage() {
  const specialCaseCount =
    Object.keys(specialCases.firstExact).length +
    Object.keys(specialCases.middleExact).length +
    Object.keys(specialCases.lastExact).length +
    Object.keys(specialCases.fullExact).length;

  return (
    <section className="glass-card flex flex-col gap-6 p-8 md:p-12">
      <div className="flex flex-col gap-3">
        <p className="label-text">Sources</p>
        <h1 className="section-title">Datasets & coverage.</h1>
        <p className="section-subtitle">
          v1 is US-only and offline. Datasets are fetched at build time and bundled into compact
          lookup tables for runtime use.
        </p>
      </div>
      <div className="space-y-6 text-sm text-mist">
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-glacier">US SSA baby names</h2>
          <p>{DATASET_INFO.ssa.source || "SSA baby names (1880-latest)."}</p>
          <p>
            Updated: {formatDate(DATASET_INFO.ssa.updatedAt)} · Scope: first + middle names.
          </p>
        </div>
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-glacier">US Census surnames</h2>
          <p>{DATASET_INFO.census.source || "US Census surnames (2010)."}</p>
          <p>
            Updated: {formatDate(DATASET_INFO.census.updatedAt)} · Scope: last names.
          </p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-glacier">Special cases</h2>
          <p className="mt-2">
            We maintain {specialCaseCount} documented overrides in <code>/data/specialCases.json</code>
            for exact matches that require manual notes (for example, “ayde-hueg”). These overrides
            always display their notes in the UI.
          </p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-glacier">Coverage limits</h2>
          <p className="mt-2">
            This release is US-biased and does not claim global certainty. Names outside the US
            datasets may return “we don’t know.” See the{" "}
            <Link className="text-glacier underline underline-offset-4" href="/methodology">
              methodology page
            </Link>
            {" "}for scoring details.
          </p>
        </div>
      </div>
    </section>
  );
}
