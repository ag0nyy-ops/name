"use client";

import { AnimatePresence, animate, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { scoreName } from "../lib/rarity";
import { RarityMeter } from "./RarityMeter";
import { ShareCard } from "./ShareCard";

const placeholderExamples = [
  "John Smith",
  "Maria Anne Garcia-Lopez Jr",
  "Aeon Lucifer Nightfall III",
  "Skibidi Skibidi-Skibidi"
];

export function NameAnalyzer() {
  const [input, setInput] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setPlaceholderIndex((index) => (index + 1) % placeholderExamples.length);
    }, 3600);
    return () => window.clearInterval(interval);
  }, []);

  const result = useMemo(() => {
    if (!submitted.trim()) return null;
    return scoreName(submitted);
  }, [submitted]);

  useEffect(() => {
    if (!input.trim()) {
      setSubmitted("");
      setIsAnalyzing(false);
      return;
    }
    setIsAnalyzing(true);
    const timeout = window.setTimeout(() => {
      setSubmitted(input);
      setIsAnalyzing(false);
    }, 320);
    return () => window.clearTimeout(timeout);
  }, [input]);

  useEffect(() => {
    const target = result?.score ?? 0;
    const controls = animate(displayScore, target, {
      duration: 0.45,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (value) => setDisplayScore(Math.round(value))
    });
    return () => controls.stop();
  }, [result?.score]);

  const showAnalyzeButton = !isAnalyzing && input.trim().length > 0;

  return (
    <section className="flex flex-col gap-12">
      <div className="glass-card hero-card sticky top-6 flex flex-col gap-8 p-6 md:p-10">
        <div className="flex flex-col gap-4">
          <p className="label-text">Name rarity</p>
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
            A defensible, non-gameable name rarity score.
          </h1>
          <p className="section-subtitle">
            SSA baby names + US Census surnames, confidence-gated. No tracking. No personal lookups.
          </p>
        </div>
        <div className="flex flex-col gap-4">
          <div className="relative">
            <input
              className="input-field input-pill"
              placeholder={placeholderExamples[placeholderIndex]}
              aria-label="Enter a name"
              value={input}
              onChange={(event) => setInput(event.target.value)}
            />
            {input.length > 0 && (
              <button
                type="button"
                className="clear-button"
                aria-label="Clear input"
                onClick={() => setInput("")}
              >
                ×
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-mist/70">
            <span>No tracking · analyzed locally · no personal lookups</span>
            {showAnalyzeButton && (
              <motion.button
                className="button-primary button-compact"
                type="button"
                onClick={() => setSubmitted(input)}
                whileTap={{ scale: 0.97 }}
                transition={{ duration: 0.18 }}
              >
                Analyze now
              </motion.button>
            )}
          </div>
          <div className={`analyzing-bar ${isAnalyzing ? "is-active" : ""}`} aria-hidden="true" />
        </div>

        <AnimatePresence mode="wait">
          {result && (
            <motion.div
              key={result.parts.raw}
              className="mt-6 border-t border-white/10 pt-8"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 14 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                  <div className="flex flex-col gap-2">
                    <p className="label-text text-mist/80">Name</p>
                    <p className="name-display">{result.parts.display || "—"}</p>
                    {result.confidence === "low" && (
                      <span className="warning-pill">Low confidence</span>
                    )}
                  </div>
                  <div className="text-left md:text-right">
                    <p className="label-text text-mist/80">Rarity score</p>
                    {typeof result.score === "number" ? (
                      <p className="score-display text-glacier">{displayScore}</p>
                    ) : (
                      <p className="text-2xl font-semibold text-amber-200">Unknown</p>
                    )}
                    <p className="text-xs uppercase tracking-[0.3em] text-mist/80">
                      {result.label === "unknown"
                        ? "we don’t know"
                        : `${result.label} · confidence ${result.confidence}`}
                    </p>
                  </div>
                </div>

                <RarityMeter score={result.score} />

                {result.confidence !== "low" && result.estimate.includes("1 in") && (
                  <p className="text-xs text-mist/70">Estimated {result.estimate}</p>
                )}

                {(result.flags.length > 0 || result.reasons.length > 0) && (
                  <motion.div
                    className="flex flex-wrap gap-2"
                    initial="hidden"
                    animate="visible"
                    variants={{
                      hidden: {},
                      visible: { transition: { staggerChildren: 0.06 } }
                    }}
                  >
                    {[...result.flags, ...result.reasons].map((item) => (
                      <motion.span
                        key={item}
                        className="chip"
                        variants={{
                          hidden: { opacity: 0, y: 6 },
                          visible: { opacity: 1, y: 0 }
                        }}
                      >
                        {item}
                      </motion.span>
                    ))}
                  </motion.div>
                )}

                <motion.div
                  className="grid gap-4 md:grid-cols-2"
                  initial="hidden"
                  animate="visible"
                  variants={{
                    hidden: {},
                    visible: { transition: { staggerChildren: 0.08 } }
                  }}
                >
                  {result.breakdown.map((part, index) => {
                    const label = ["First", "Middle", "Last", "Suffix"][index] ?? "Part";
                    return (
                    <motion.div
                      key={`${part.token}-${part.source}-${index}`}
                      className="breakdown-card"
                      variants={{
                        hidden: { opacity: 0, y: 8 },
                        visible: { opacity: 1, y: 0 }
                      }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <div className="flex items-center justify-between text-[0.6rem] uppercase tracking-[0.25em] text-mist/80">
                        <span>{label}</span>
                        <span title={`Dataset: ${part.source}`}>
                          {part.matchStatus} · {part.rarityTier}
                        </span>
                      </div>
                      <div className="font-mono text-lg text-glacier">{part.token || "—"}</div>
                      <ul className="mt-2 space-y-1 text-xs text-mist/75">
                        {part.notes.map((note) => (
                          <li key={note}>{note}</li>
                        ))}
                      </ul>
                    </motion.div>
                  );
                  })}
                </motion.div>

                <details className="accordion">
                  <summary>Why this score?</summary>
                  <div className="accordion-body">
                    <div>
                      <p className="accordion-title">Datasets checked</p>
                      <ul>
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
                      <p className="accordion-title">Caps, penalties, flags</p>
                      <ul>
                        {result.capsApplied.length > 0 ? (
                          result.capsApplied.map((cap) => <li key={cap}>{cap}</li>)
                        ) : (
                          <li>No caps applied.</li>
                        )}
                        {result.penaltiesApplied.length > 0 ? (
                          result.penaltiesApplied.map((penalty) => (
                            <li key={penalty.id}>
                              −{penalty.points} · {penalty.detail}
                            </li>
                          ))
                        ) : (
                          <li>No penalties applied.</li>
                        )}
                        {result.flags.length > 0 ? (
                          result.flags.map((flag) => <li key={flag}>Flag: {flag}</li>)
                        ) : (
                          <li>No flags.</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </details>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {result && result.score !== null && (
        <div className="glass-card card-hover p-6 md:p-10">
          <ShareCard score={result} />
        </div>
      )}
    </section>
  );
}
