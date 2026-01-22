export default function MethodologyPage() {
  return (
    <section className="glass-card flex flex-col gap-6 p-8 md:p-12">
      <div className="flex flex-col gap-3">
        <p className="label-text">Methodology</p>
        <h1 className="section-title">Transparent tiers, no hidden stats.</h1>
        <p className="section-subtitle">
          This tool uses a deterministic tier system to estimate how structurally rare a name looks.
          It does not claim population facts, and it never searches for people.
        </p>
      </div>
      <div className="space-y-6 text-sm text-mist">
        <div>
          <h2 className="text-base font-semibold text-glacier">Parsing rules</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Whitespace is normalized and punctuation is removed.</li>
            <li>Suffixes include Jr/Sr and roman numerals I–XX (case-insensitive).</li>
            <li>First token becomes first name, last token becomes last name, middle tokens join.</li>
            <li>Hyphens are preserved only for last names.</li>
          </ul>
        </div>
        <div>
          <h2 className="text-base font-semibold text-glacier">Tier system (1–10)</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Very common first names map to tier 2–3.</li>
            <li>Stylized spellings (z/y substitutions) add +1 tier.</li>
            <li>Multi-part middle names add +1 tier.</li>
            <li>Hyphenated last names start at tier 7.</li>
            <li>Long or uncommon-pattern last names start around tier 6.</li>
            <li>Roman numeral suffixes map to tier 6.</li>
          </ul>
        </div>
        <div>
          <h2 className="text-base font-semibold text-glacier">Special cases</h2>
          <p className="mt-2">
            We support local, explicit overrides in <code>/data/specialCases.json</code> for exact
            matches on first, middle, last, or full names. These entries include a tier, confidence,
            and note so the exception is always visible.
          </p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-glacier">Combining tiers</h2>
          <p className="mt-2">
            We multiply the active tiers and compress them into a 0–100 score using logarithmic
            scaling. This creates a stacking effect while keeping the score readable. The output is
            paired with a label (common → extreme) and a confidence level.
          </p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-glacier">Input completeness caps</h2>
          <p className="mt-2">
            To avoid fake precision, incomplete inputs are capped. Single-token inputs (only a
            first name) max out at 45 and show low confidence. Missing last names are capped at 60,
            and they cannot reach the “extreme” label. “Very rare” requires at least a first and
            last name, while “extreme” requires a last-name tier of 8+ or a special-case match.
          </p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-glacier">Confidence levels</h2>
          <p className="mt-2">
            Confidence is high when a rule is explicit (for example, a special case), medium when a
            heuristic is applied, and low when a part is missing. This is displayed per part and for
            the overall score.
          </p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-glacier">Important disclaimer</h2>
          <p className="mt-2">
            These results are estimates based on name structure. We do not infer identity, ethnicity,
            or demographic statistics. No “1 in N” claims are shown.
          </p>
        </div>
      </div>
    </section>
  );
}
