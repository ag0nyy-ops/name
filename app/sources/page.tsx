// jay. — © 2026 Jay — https://ag0nyy-ops.github.io/ — source viewable, not reusable by others (LICENSE)
import type { Metadata } from "next";
import { FileHeader } from "../../components/FileHeader";
import Link from "next/link";
import specialCases from "../../data/specialCases.json";
import { DATASETS } from "../../lib/engine";
import { formatCount } from "../../lib/format";

export const metadata: Metadata = { title: "Sources · Name rarity" };

function formatDate(value: string | null) {
  if (!value) return "unknown";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "unknown"
    : date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC"
      });
}

export default function SourcesPage() {
  const specialCount =
    Object.keys(specialCases.first).length +
    Object.keys(specialCases.last).length;
  return (
    <section className="file enter">
      <FileHeader number="03" label="Sources" title="Sources">
        <p className="lede">
          <strong className="font-medium text-fg">Where the numbers come from.</strong>{" "}
          Two US government datasets, both public domain. They&apos;re
          downloaded ahead of time and served as static files, so the site makes
          no calls to anyone while you use it.
        </p>
      </FileHeader>
      <div className="prose-block">
        <h2>First and middle names: SSA baby names</h2>
        <p>
          The Social Security Administration&apos;s national baby-name files,
          every year from 1880 on, added together:{" "}
          {formatCount(DATASETS.first.totalNames)} names across{" "}
          {formatCount(DATASETS.first.totalCount)} birth records. SSA leaves out
          any name given to fewer than 5 babies in a year, so a name missing
          here has been very rare in every single year. Built{" "}
          {formatDate(DATASETS.first.generatedAt)}.
        </p>
        <p>
          Source:{" "}
          <a
            href="https://www.ssa.gov/oact/babynames/limits.html"
            rel="noreferrer"
          >
            ssa.gov/oact/babynames/limits.html
          </a>{" "}
          (national data).
        </p>

        <h2>Last names: 2010 Census surnames</h2>
        <p>
          The Census Bureau&apos;s list of surnames held by at least 100 people
          in the 2010 Census: {formatCount(DATASETS.last.totalNames)} surnames
          covering {formatCount(DATASETS.last.totalCount)} people. Surnames
          below 100 people aren&apos;t published, which is why a missing surname
          is scored as &ldquo;fewer than 100&rdquo; rather than unknown. Built{" "}
          {formatDate(DATASETS.last.generatedAt)}.
        </p>
        <p>
          Source:{" "}
          <a
            href="https://www.census.gov/topics/population/genealogy/data/2010_surnames.html"
            rel="noreferrer"
          >
            census.gov 2010 surnames
          </a>
          .
        </p>

        <h2>Hand-checked entries</h2>
        <p>
          {specialCount} documented exception{specialCount === 1 ? "" : "s"}{" "}
          live in <code>data/specialCases.json</code> for real names the lists
          can&apos;t confirm. Each one shows its note next to the result.
        </p>

        <h2>Limits</h2>
        <ul>
          <li>
            US records only. Names common elsewhere but rare in the US score as
            rare.
          </li>
          <li>
            The SSA totals here aren&apos;t split by sex, so a name&apos;s count
            covers everyone given it, and &ldquo;unisex&rdquo; names aren&apos;t
            treated differently.
          </li>
          <li>
            Both lists store names without accents, spaces, hyphens or
            apostrophes, so those are ignored when matching.
          </li>
          <li>
            Names written in non-Latin scripts can&apos;t be scored; a romanized
            spelling can.
          </li>
        </ul>
        <p>
          See the <Link href="/methodology/">methodology</Link> for how the
          counts become a score.
        </p>
      </div>
    </section>
  );
}
