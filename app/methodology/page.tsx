import Link from "next/link";

export default function MethodologyPage() {
  return (
    <section className="glass-card flex flex-col gap-6 p-8 md:p-12">
      <div className="flex flex-col gap-3">
        <p className="label-text">Methodology</p>
        <h1 className="section-title">Transparent tiers, visible limits.</h1>
        <p className="section-subtitle">
          whatsmynamerarity estimates structural rarity using offline US datasets. We show confidence
          and say “we don’t know” when data is insufficient.
        </p>
      </div>
      <div className="space-y-6 text-sm text-mist">
        <div>
          <h2 className="text-base font-semibold text-glacier">Input normalization</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Lowercase, trim, and collapse whitespace.</li>
            <li>Strip punctuation except hyphen and apostrophe.</li>
            <li>Do not strip diacritics or non-Latin scripts.</li>
          </ul>
        </div>
        <div>
          <h2 className="text-base font-semibold text-glacier">Parsing rules</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Suffixes include Jr/Sr and Roman numerals I–XX (case-insensitive).</li>
            <li>First token becomes first name, last token becomes last name, middle tokens join.</li>
          </ul>
        </div>
        <div>
          <h2 className="text-base font-semibold text-glacier">Dataset routing</h2>
          <p className="mt-2">
            The engine detects script and diacritics, then routes to datasets in priority order. In
            v1, we only check US SSA baby names for first/middle and US Census surnames for last.
            The UI lists every dataset checked. If no dataset matches the script, we mark the part
            as “not found,” lower confidence, and show “we don’t know.”
          </p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-glacier">Junk score (conservative)</h2>
          <p className="mt-2">
            We never reject real-looking names. Instead, we use a junk score to flag likely spam.
            Hard blocks only trigger for disallowed characters, digits, excessive token length, or
            extreme hyphen density. Warnings still produce a score, but confidence is reduced.
          </p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-glacier">Tier system (1–10)</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Percentile bins map to tiers (top 1% → tier 2, bottom 1% → tier 10).</li>
            <li>Stylized spelling adds a small +0.5 tier bump (max).</li>
            <li>Multi-token middle names use an average tier with lower confidence.</li>
            <li>Hyphenated last names have a baseline tier ≥7.</li>
            <li>Roman numeral suffixes add a +0.5 tier bump (max).</li>
            <li>Tier 1 is reserved for missing middle/suffix.</li>
          </ul>
        </div>
        <div>
          <h2 className="text-base font-semibold text-glacier">Combining tiers</h2>
          <p className="mt-2">
            We convert tiers to weights using a base (~1.7), multiply the weights, and compress the
            result with logarithmic scaling into a 0–100 score. Labels (common → extreme) are derived
            from score bins and adjusted for caps.
          </p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-glacier">Credibility caps</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Single-token inputs cap at 45 and label ≤ uncommon.</li>
            <li>Missing last names cap at 60 and label ≤ rare.</li>
            <li>“Very rare” requires first + last.</li>
            <li>“Extreme” requires last tier ≥9 or a special-case last/full match.</li>
          </ul>
        </div>
        <div>
          <h2 className="text-base font-semibold text-glacier">Special cases</h2>
          <p className="mt-2">
            We support explicit overrides in <code>/data/specialCases.json</code> for exact matches on
            first, middle, last, or full names. These entries include a tier, confidence, and note so
            the exception is always visible. See documented examples on the{" "}
            <Link className="text-glacier underline underline-offset-4" href="/sources">
              sources page
            </Link>
            .
          </p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-glacier">Confidence levels</h2>
          <p className="mt-2">
            Confidence is high when first and last names are found in datasets, medium when partial
            matches exist, and low when parts are missing or unknown. Spam warnings also lower
            confidence.
          </p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-glacier">“1 in N” estimates</h2>
          <p className="mt-2">
            We only show order-of-magnitude estimates when first and last names are present, both are
            found in datasets, confidence is high, and no caps are applied. Otherwise we explicitly
            say we don’t have enough data.
          </p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-glacier">Reason codes</h2>
          <p className="mt-2">
            The engine emits reason codes (like <code>NO_LAST_NAME</code>,{" "}
            <code>NOT_FOUND_IN_DATASETS</code>, and <code>SPAM_WARN</code>) that the UI translates into
            plain-language explanations.
          </p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-glacier">Important disclaimer</h2>
          <p className="mt-2">
            Results are estimates based on the listed US datasets. We do not infer identity,
            ethnicity, or demographics, and we never use personal lookups.
          </p>
        </div>
      </div>
    </section>
  );
}
