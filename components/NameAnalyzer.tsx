"use client";

import {
  AnimatePresence,
  animate,
  motion,
  useReducedMotion
} from "framer-motion";
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
    <section className="flex flex-col gap-10">
      <div className="glass-card flex flex-col gap-8 p-5 sm:p-8 md:p-10">
        <div className="flex flex-col gap-3">
          <p className="label-text">Name rarity</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
            How many people share your name?
          </h1>
          <p className="section-subtitle max-w-2xl">
            An estimate from 145 years of SSA baby names and the 2010 Census
            surname list. Everything runs in your browser: nothing you type is
            sent anywhere.
          </p>
        </div>

        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => event.preventDefault()}
          role="search"
        >
          <label htmlFor={inputId} className="label-text">
            Full name
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
            className={`analyzing-bar ${isWaiting ? "is-active" : ""}`}
            aria-hidden="true"
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-mist">Try</span>
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                className="example-chip"
                onClick={() => setInput(example)}
              >
                {example}
              </button>
            ))}
          </div>
          {engine.status === "loading" && (
            <p className="text-xs text-mist">
              Loading name data (about 1.3 MB, once)…
            </p>
          )}
          {engine.status === "error" && (
            <p className="text-sm text-caution" role="alert">
              Couldn&apos;t load the name data ({engine.message}). Check your
              connection and reload.
            </p>
          )}
        </form>

        <p className="sr-only" aria-live="polite">
          {result ? summarize(result) : ""}
        </p>

        <AnimatePresence mode="wait">
          {result && result.status !== "empty" && (
            <motion.div
              key={result.status === "ok" ? "ok" : result.status}
              className="border-t border-line/10 pt-8"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <Result result={result} onCopy={copyLink} copied={copied} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {result && result.score !== null && (
        <div className="glass-card p-5 sm:p-8 md:p-10">
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
      <div className="flex flex-col gap-4">
        <p className="name-display">{result.display || "—"}</p>
        <p className="text-lg font-semibold text-caution">No score</p>
        <ul className="space-y-2 text-sm text-mist">
          {result.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
        {[result.first, result.last].some(Boolean) && <Parts result={result} />}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <p className="label-text">Name</p>
          <p className="name-display">{result.display}</p>
        </div>
        <div className="flex flex-col gap-1 sm:items-end">
          <p className="label-text">Rarity score</p>
          <p className="score-display text-glacier">
            <AnimatedScore value={result.score} />
            <span className="text-xl text-mist">/100</span>
          </p>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-aurora">
            {LABEL_TEXT[result.label]}
          </p>
        </div>
      </div>

      <RarityMeter score={result.score} />

      {result.estimate ? (
        <p className="text-base text-glacier">
          {result.estimate.isUpperBound ? "At most " : "Estimated "}
          <strong>{formatPeople(result.estimate.people)}</strong> in the US with
          this first and last name
          {result.estimate.people < 0.5 ? ", so the name is likely unique" : ""}
          .
          {result.estimate.withMiddle !== null && (
            <span className="text-mist">
              {" "}
              With the middle name too:{" "}
              {formatPeople(result.estimate.withMiddle)}.
            </span>
          )}
        </p>
      ) : (
        result.notes.map((note) => (
          <p key={note} className="text-sm text-mist">
            {note}
          </p>
        ))
      )}

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`pill pill-${result.confidence}`}>
            {result.confidence} confidence
          </span>
          <button type="button" className="button-quiet" onClick={onCopy}>
            {copied ? "Link copied" : "Copy link to this result"}
          </button>
        </div>
        <ul className="space-y-1 text-sm text-mist">
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
        <div className="mt-3 space-y-2 leading-relaxed">
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
    <ul className="grid gap-3 md:grid-cols-2">
      {parts.map((part, index) => (
        <li key={`${part.kind}-${part.text}-${index}`} className="part-card">
          <div className="flex items-center justify-between gap-2">
            <span className="label-text">{KIND_TEXT[part.kind]}</span>
            <span
              className={`pill ${part.match === "exact" ? "pill-high" : "pill-medium"}`}
            >
              {MATCH_TEXT[part.match]}
            </span>
          </div>
          <p className="break-words text-xl font-semibold text-glacier">
            {part.text}
          </p>
          <p className="text-sm text-mist">
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
            {" · "}
            {LABEL_TEXT[part.label].toLowerCase()} on its own ({part.score}/100)
          </p>
          {part.notes.length > 0 && (
            <ul className="space-y-1 text-xs leading-relaxed text-mist">
              {part.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}
