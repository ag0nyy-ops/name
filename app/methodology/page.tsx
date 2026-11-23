// jay. — © 2026 Jay — https://ag0nyy-ops.github.io/ — source viewable, not reusable by others (LICENSE)
import type { Metadata } from "next";
import { FileHeader } from "../../components/FileHeader";
import Link from "next/link";
import { MODEL_VERSION } from "../../lib/engine";

export const metadata: Metadata = { title: "Methodology · Name rarity" };

export default function MethodologyPage() {
  return (
    <section className="file enter">
      <FileHeader number="02" label={`Methodology · model ${MODEL_VERSION}`} title="Methodology">
        <p className="lede">
          <strong className="font-medium text-fg">One estimate, shown in full.</strong>{" "}
          The score comes from a single number: how many people in the US
          you&apos;d expect to have your first and last name. Everything below
          is visible in each result.
        </p>
      </FileHeader>
      <div className="prose-block">
        <h2>1. Reading the name</h2>
        <ul>
          <li>
            The first word is the first name, the last word is the last name,
            anything between is a middle name. &ldquo;Last, First&rdquo; is
            flipped.
          </li>
          <li>
            Titles (Dr, Mr, Ms…) and suffixes (Jr, Sr, II, III…) are set aside.
            A suffix doesn&apos;t change the count.
          </li>
          <li>
            Surname particles join the last name: &ldquo;Ana de la Cruz&rdquo;
            looks up &ldquo;delacruz&rdquo;, the way the Census stores it.
          </li>
          <li>
            Accents, hyphens and apostrophes are removed for matching (José →
            jose, Jean-Luc → jeanluc, O&apos;Brien → obrien), because
            that&apos;s how both lists store names. These matches count as
            exact.
          </li>
        </ul>

        <h2>2. Looking up each part</h2>
        <p>
          First and middle names are looked up in SSA baby names, last names in
          the 2010 Census list. A part&apos;s share is its count divided by the
          list&apos;s total.
        </p>
        <ul>
          <li>
            <strong>Not listed:</strong> both lists have a cutoff (5 babies a
            year, 100 people), so a missing name is counted at half the cutoff
            instead of being thrown out. The estimate is then marked as an upper
            end.
          </li>
          <li>
            <strong>Hyphenated, not listed whole:</strong> if each half is
            listed, the name is real but below the cutoff, so it&apos;s counted
            the same way.
          </li>
          <li>
            <strong>Particle surname, not listed whole:</strong> falls back to
            the final word, which overcounts, so confidence drops.
          </li>
          <li>
            <strong>Rare spellings:</strong> for missing names, a sound-alike
            search names the closest listed spelling (Braydyn → Brayden). It
            explains the result; it doesn&apos;t change the count.
          </li>
          <li>
            <strong>Unusual input:</strong> only names that aren&apos;t listed
            are checked for keyboard runs, no vowels and similar. A listed name
            is never flagged.
          </li>
        </ul>

        <h2>3. The estimate</h2>
        <p>
          <code>people = 335 million × first-name share × last-name share</code>
        </p>
        <p>
          This treats first and last names as independent. They aren&apos;t
          quite: some pairs cluster by culture and era, so real counts can be
          several times higher or lower. Read it as an order of magnitude.
          Middle names get their own, narrower estimate and don&apos;t change
          the score.
        </p>

        <h2>4. The score</h2>
        <p>
          A log scale from 10,000 people (0) to a thousandth of a person (100).
          About one expected person scores 57.
        </p>
        <ul>
          <li>
            0–19 common · 20–39 uncommon · 40–59 rare · 60–79 very rare · 80–100
            extremely rare
          </li>
          <li>
            A single name gets its own score instead: its list&apos;s most
            common name is 0 and a count of one is 100.
          </li>
        </ul>

        <h2>5. Confidence</h2>
        <ul>
          <li>
            <strong>High:</strong> both names were found.
          </li>
          <li>
            <strong>Medium:</strong> one part was missing, partial or
            hyphen-split, or only one name was entered.
          </li>
          <li>
            <strong>Low:</strong> a missing part looks like it isn&apos;t a
            name, or the input had characters that had to be ignored.
          </li>
        </ul>
        <p>
          If neither name is in the data, or the name isn&apos;t in the Latin
          alphabet, there&apos;s no score at all.
        </p>

        <h2>Engine</h2>
        <p>
          The scoring engine is written in Rust and compiled to WebAssembly, so
          the same tested code runs in your browser. It never looks anyone up:
          it only reads the two public lists described on the{" "}
          <Link href="/sources/">sources page</Link>.
        </p>
      </div>
    </section>
  );
}
