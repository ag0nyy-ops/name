// jay. — © 2026 Jay — https://ag0nyy-ops.github.io/ — source viewable, not reusable by others (LICENSE)
"use client";

import { animate, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import {
  loadEngine,
  type NameResult,
  type PartResult,
  type Scorer
} from "../lib/engine";
import {
  KIND_TEXT,
  LABEL_TEXT,
  MATCH_TEXT,
  datasetText,
  formatCount,
  formatPeople,
  summarize
} from "../lib/format";
import { FileHeader } from "./FileHeader";
import { RarityMeter } from "./RarityMeter";
import { ShareCard } from "./ShareCard";

const EXAMPLES = [
  "John Smith",
  "José García",
  "Jean-Luc Picard",
  "Ana de la Cruz",
  "Elon Musk"
];
const HASH_KEY = "n";

function readHash(): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.hash.slice(1));
  return params.get(HASH_KEY) ?? "";
}

function writeHash(value: string) {
  const url = new URL(window.location.href);
  url.hash = value.trim()
    ? new URLSearchParams({ [HASH_KEY]: value.trim() }).toString()
    : "";
  window.history.replaceState(null, "", url.toString());
}

type EngineState =
  | { status: "loading" }
  | { status: "ready"; score: Scorer }
  | { status: "error"; message: string };

export function NameAnalyzer() {
  const inputId = useId();
  const [input, setInput] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [engine, setEngine] = useState<EngineState>({ status: "loading" });
  const [result, setResult] = useState<NameResult | null>(null);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Start loading the engine and tables right away, and pick up a shared name.
  useEffect(() => {
    const shared = readHash();
    if (shared) {
      setInput(shared);
      setSubmitted(shared);
    }
    let cancelled = false;
    loadEngine()
      .then((score) => !cancelled && setEngine({ status: "ready", score }))
      .catch(
        (error: Error) =>
          !cancelled && setEngine({ status: "error", message: error.message })
      );
    return () => {
      cancelled = true;
    };
  }, []);

  // Score after a short pause in typing.
  useEffect(() => {
    const timeout = window.setTimeout(
      () => setSubmitted(input),
      input.trim() ? 250 : 0
    );
    return () => window.clearTimeout(timeout);
  }, [input]);

  useEffect(() => {
    writeHash(submitted);
    setCopied(false);
    if (engine.status !== "ready" || !submitted.trim()) {
      setResult(null);
      return;
    }
    setResult(engine.score(submitted));
  }, [submitted, engine]);

  const isWaiting =
    input.trim() !== "" && (input !== submitted || engine.status === "loading");

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="file enter flex flex-col gap-12">
      <FileHeader number="01" label="Name rarity / US records" title="Name rarity">
        <p className="lede">
          <strong className="font-medium text-fg">
            How many people share your name?
          </strong>{" "}
          An estimate from 145 years of SSA baby names and the 2010 Census
          surname list. It all runs in your browser: nothing you type is sent
          anywhere.
        </p>
      </FileHeader>

      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => event.preventDefault()}
        role="search"
      >
        <label htmlFor={inputId} className="field-label">
          Subject / full name
        </label>
        <div className="relative">
          <input
            id={inputId}
            ref={inputRef}
            className="input-field"
            placeholder="First Middle Last"
            autoComplete="off"
            autoCapitalize="words"
            spellCheck={false}
            value={input}
            onChange={(event) => setInput(event.target.value)}
          />
          {input.length > 0 && (
            <button
              type="button"
              className="clear-button"
              aria-label="Clear name"
              onClick={() => {
                setInput("");
                inputRef.current?.focus();
              }}
            >
              ×
            </button>
          )}
        </div>
        <div
          className={`scan-bar ${isWaiting ? "is-active" : ""}`}
          aria-hidden="true"
        />
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="label label--bare mr-1">Try</span>
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              className="chip"
              onClick={() => setInput(example)}
            >
              {example}
            </button>
          ))}
        </div>
        {engine.status === "loading" && (
          <p className="label label--bare">
            Loading name data (about 1.3 MB, once)…
          </p>
        )}
        {engine.status === "error" && (
          <p className="text-sm text-fg" role="alert">
            Couldn&apos;t load the name data ({engine.message}). Check your
            connection and reload.
          </p>
        )}
      </form>

      <p className="sr-only" aria-live="polite">
        {result ? summarize(result) : ""}
      </p>

      {result && result.status !== "empty" && (
        <div
          key={result.status === "ok" ? "ok" : result.status}
          className="card card--marked enter p-5 sm:p-8 md:p-10"
        >
          <Result result={result} onCopy={copyLink} copied={copied} />
        </div>
      )}

      {result && result.score !== null && (
        <div className="card enter p-5 sm:p-8 md:p-10">
          <ShareCard result={result} />
        </div>
      )}
    </section>
  );
}

function AnimatedScore({ value }: { value: number }) {
  const reduceMotion = useReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (reduceMotion) {
      setShown(value);
      return;
    }
    const controls = animate(from.current, value, {
      duration: 0.45,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        from.current = v;
        setShown(Math.round(v));
      }
    });
    return () => controls.stop();
  }, [value, reduceMotion]);
  return <>{shown}</>;
}

export function Result({
  result,
  onCopy,
  copied
}: {
  result: NameResult;
  onCopy: () => void;
  copied: boolean;
}) {
  if (result.status !== "ok" || result.score === null) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-3">
            <p className="label">Subject</p>
            <p className="name-display">{result.display || "—"}</p>
          </div>
          <span className="stamp stamp--big stamp--wip">No score</span>
        </div>
        <ul className="notes">
          {result.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
        {[result.first, result.last].some(Boolean) && <Parts result={result} />}
      </div>
    );
  }

  const confident = result.confidence === "high";
  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div className="flex min-w-0 flex-col gap-3">
          <p className="label">Subject</p>
          <p className="name-display">{result.display}</p>
        </div>
        <div className="flex flex-col gap-3 md:items-end">
          <p className="label">Rarity score</p>
          <div className="flex flex-wrap items-center gap-5">
            <p className="score-display">
              <AnimatedScore value={result.score} />
              <span className="score-display__of">/100</span>
            </p>
            <span className="stamp stamp--big">{LABEL_TEXT[result.label]}</span>
          </div>
        </div>
      </div>

      <RarityMeter score={result.score} />

      {result.estimate ? (
        <p className="max-w-3xl text-lg leading-relaxed">
          {result.estimate.isUpperBound ? "At most " : "Estimated "}
          <strong className="redact figure">
            {formatPeople(result.estimate.people)}
          </strong>{" "}
          in the US with this first and last name
          {result.estimate.people < 0.5 ? ", so the name is likely unique" : ""}
          .
          {result.estimate.withMiddle !== null && (
            <span className="text-muted">
              {" "}
              With the middle name too:{" "}
              {formatPeople(result.estimate.withMiddle)}.
            </span>
          )}
        </p>
      ) : (
        <ul className="notes">
          {result.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <span className={`stamp ${confident ? "" : "stamp--wip"}`}>
            {result.confidence} confidence
          </span>
          <button type="button" className="btn btn--quiet" onClick={onCopy}>
            {copied ? "Link copied" : "Copy link to this result"}
          </button>
        </div>
        <ul className="notes">
          {result.confidenceReasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
          {result.estimate &&
            result.notes.map((note) => <li key={note}>{note}</li>)}
        </ul>
      </div>

      <Parts result={result} />

      <details className="accordion">
        <summary>How this was calculated</summary>
        <div className="accordion__body">
          {result.estimate ? (
            <>
              <p>
                Each name&apos;s share comes from its dataset: the first name
                out of every SSA baby-name record since 1880, the last name out
                of every person in the 2010 Census surname list.
              </p>
              <p>
                The estimate multiplies those two shares by the US population
                (335 million). That assumes first and last names are
                independent, which is roughly true but not exactly: some pairs
                cluster by culture, so treat it as an order-of-magnitude figure.
              </p>
              <p>
                The score is a log scale: 10,000 or more people scores 0, one
                person scores about 57, and a thousandth of a person scores 100.
              </p>
            </>
          ) : (
            <p>
              With one name, the score compares it to its own list: the most
              common name there scores 0 and a count of one scores 100. Add a
              last name for a full-name estimate.
            </p>
          )}
          <p>
            See the{" "}
            <Link className="text-link" href="/methodology/">
              methodology
            </Link>{" "}
            for the details.
          </p>
        </div>
      </details>
    </div>
  );
}

function Parts({ result }: { result: NameResult }) {
  const parts = [result.first, ...result.middle, result.last].filter(
    (p): p is PartResult => p !== null
  );
  if (parts.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      <p className="label">Evidence / each part</p>
      <ul className="grid gap-4 md:grid-cols-2">
        {parts.map((part, index) => (
          <li key={`${part.kind}-${part.text}-${index}`} className="card case">
            <div className="case__tab">
              <span className="label label--bare">
                Case {String(index + 1).padStart(3, "0")} /{" "}
                {KIND_TEXT[part.kind]}
              </span>
              <span
                className={`stamp ${part.match === "exact" ? "" : "stamp--wip"}`}
              >
                {MATCH_TEXT[part.match]}
              </span>
            </div>
            <p className="case__title">{part.text}</p>
            <p className="case__line">
              {part.count !== null ? (
                <>
                  {formatCount(part.count)} in {datasetText(part)}
                  {part.rank !== null && (
                    <>
                      {" "}
                      · #{formatCount(part.rank)} of{" "}
                      {formatCount(part.totalNames)}
                    </>
                  )}
                </>
              ) : (
                <>Below the {datasetText(part)} cutoff</>
              )}
            </p>
            {part.notes.length > 0 && (
              <ul className="notes text-sm">
                {part.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            )}
            <p className="case__foot">
              {LABEL_TEXT[part.label]} on its own · {part.score}/100
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
