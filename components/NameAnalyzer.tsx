"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import type { ReasonCode } from "../lib/rarity";
import { scoreName } from "../lib/rarity";
import { RarityMeter } from "./RarityMeter";
import { ShareCard } from "./ShareCard";

const reasonCopy: Record<ReasonCode, string> = {
  NO_LAST_NAME: "No last name provided, so the score is capped and confidence is lower.",
  NOT_FOUND_IN_DATASETS: "We could not find the provided parts in the current datasets.",
  SPECIAL_CASE_OVERRIDE: "A documented special-case override was applied.",
  HYPHEN_COMPOSED: "Hyphenated surnames were composed from multiple parts.",
  SPAM_WARN: "Input looks unusual, so we lowered confidence but still scored it.",
  SPAM_BLOCK: "Input looks like spam, so we did not score it.",
  COMPLETENESS_CAP: "Completeness caps were applied to avoid fake precision.",
  DATASET_UNAVAILABLE: "Datasets are not loaded yet, so we cannot score reliably.",
  SINGLE_TOKEN: "Single-token names are capped to avoid overstating rarity.",
  SCRIPT_NOT_SUPPORTED: "The script is outside the current dataset coverage."
};

export function NameAnalyzer() {
  const [input, setInput] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const result = useMemo(() => {
    if (!submitted.trim()) return null;
    return scoreName(submitted);
  }, [submitted]);

  const handleAnalyze = () => {
    setIsLoading(true);
    window.setTimeout(() => {
      setSubmitted(input);
      setIsLoading(false);
    }, 320);
  };

  return (
    <section className="flex flex-col gap-10">
      <div className="glass-card card-hover flex flex-col gap-8 p-8 md:p-12">
        <div className="flex flex-col gap-4">
          <p className="label-text">Name rarity</p>
          <h1 className="text-5xl font-semibold tracking-tight md:text-6xl">
            Find the rarity signature of any name.
          </h1>
          <p className="section-subtitle">
            Transparent, tiered scoring built on US SSA baby names and US Census surnames — no
            tracking, no personal lookups.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <input
              className="input-field"
              placeholder="Enter a full name"
              aria-label="Enter a name"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleAnalyze();
              }}
            />
            <motion.button
              className="button-primary w-full md:w-auto"
              type="button"
              onClick={handleAnalyze}
              aria-busy={isLoading}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.18 }}
            >
              <span className="flex items-center gap-2">
                {isLoading && <span className="h-2 w-2 animate-pulse rounded-full bg-aurora/80" />}
                {isLoading ? "Analyzing" : "Analyze"}
              </span>
            </motion.button>
          </div>
          <p className="text-xs text-mist/70">
            Real human names are never rejected as fake. If we cannot score a name reliably, we say
            “we don’t know.” Raw inputs are never stored.
          </p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            key={result.parts.raw}
            className="flex flex-col gap-8"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="glass-card card-hover flex flex-col gap-8 p-8 md:p-12">
              <div className="flex flex-col gap-4">
                <p className="label-text">Results</p>
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="label-text text-mist/80">Name</p>
                    <p className="name-display">{result.parts.display || "—"}</p>
                  </div>
                  <div className="text-right">
                    <p className="label-text text-mist/80">Rarity score</p>
                    {typeof result.overallScore === "number" ? (
                      <p className="text-5xl font-semibold text-glacier">{result.overallScore}</p>
                    ) : (
                      <p className="text-2xl font-semibold text-amber-200">N/A</p>
                    )}
                    <p className="text-xs uppercase tracking-[0.3em] text-mist/80">
                      {result.status === "blocked"
                        ? "input looks like spam"
                        : result.status === "unknown"
                          ? "we don’t know yet"
                          : `${result.label} · confidence ${result.confidence}`}
                    </p>
                  </div>
                </div>
              </div>

              {result.status !== "blocked" && (
                <RarityMeter score={result.overallScore} />
              )}

              {result.status === "blocked" && (
                <div className="rounded-2xl border border-amber-200/20 bg-amber-200/10 p-5 text-sm text-amber-100">
                  <p className="font-semibold">Input looks like spam.</p>
                  <p className="mt-2 text-amber-100/80">
                    We did not score this name. Please try again with a real name.
                  </p>
                  {result.junkScore.reasons.length > 0 && (
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-amber-100/80">
                      {result.junkScore.reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {result.status !== "blocked" && (
                <motion.div
                  className="grid gap-4 md:grid-cols-2"
                  initial="hidden"
                  animate="visible"
                  variants={{
                    hidden: {},
                    visible: {
                      transition: { staggerChildren: 0.08 }
                    }
                  }}
                >
                  {result.partScores.map((part) => (
                    <motion.div
                      key={part.label}
                      className="glass-card card-hover flex flex-col gap-3 border border-white/10 bg-white/5 p-5"
                      variants={{
                        hidden: { opacity: 0, y: 8 },
                        visible: { opacity: 1, y: 0 }
                      }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <div className="flex items-center justify-between text-[0.6rem] uppercase tracking-[0.25em] text-mist/80">
                        <span>{part.label}</span>
                        <span>
                          Tier {part.tier} · {part.tierLabel}
                        </span>
                      </div>
                      <div className="font-mono text-xl text-glacier">{part.value || "—"}</div>
                      <div className="text-xs text-mist/80">Confidence: {part.confidence}</div>
                      <ul className="list-disc pl-4 text-xs text-mist/80">
                        {part.notes.map((note) => (
                          <li key={note}>{note}</li>
                        ))}
                      </ul>
                    </motion.div>
                  ))}
                </motion.div>
              )}

              {result.status !== "blocked" && (
                <div className="space-y-3 text-xs text-mist/70">
                  <p>{result.estimateNote}</p>
                  <p className="text-mist/80">{result.estimateDetail}</p>
                </div>
              )}

              {result.status !== "blocked" && (
                <details className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-mist/80">
                  <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.3em] text-glacier/80">
                    Why this score?
                  </summary>
                  <div className="mt-4 space-y-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-mist/70">
                        Datasets checked
                      </p>
                      <ul className="mt-2 space-y-1 text-xs text-mist/70">
                        {result.datasetsChecked.length > 0 ? (
                          result.datasetsChecked.map((dataset, index) => (
                            <li key={`${dataset.id}-${dataset.scope}-${index}`}>
                              {dataset.name} ({dataset.scope}) — {dataset.matched ? "match" : "no match"}
                              {dataset.note ? ` · ${dataset.note}` : ""}
                            </li>
                          ))
                        ) : (
                          <li>No dataset matched the script for this input.</li>
                        )}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-mist/70">
                        Caps applied
                      </p>
                      <ul className="mt-2 space-y-1 text-xs text-mist/70">
                        {result.capsApplied.length > 0 ? (
                          result.capsApplied.map((cap) => <li key={cap}>{cap}</li>)
                        ) : (
                          <li>None</li>
                        )}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-mist/70">
                        Confidence rationale
                      </p>
                      <ul className="mt-2 space-y-1 text-xs text-mist/70">
                        {result.confidenceNotes.length > 0 ? (
                          result.confidenceNotes.map((note) => <li key={note}>{note}</li>)
                        ) : (
                          <li>Confidence is based on dataset matches and completeness.</li>
                        )}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-mist/70">
                        Reason codes
                      </p>
                      <ul className="mt-2 space-y-1 text-xs text-mist/70">
                        {result.reasonCodes.length > 0 ? (
                          result.reasonCodes.map((code) => (
                            <li key={code}>{reasonCopy[code] ?? code}</li>
                          ))
                        ) : (
                          <li>No special flags.</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </details>
              )}
            </div>

            {result.status === "scored" && (
              <div className="glass-card card-hover p-8 md:p-12">
                <ShareCard score={result} />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
