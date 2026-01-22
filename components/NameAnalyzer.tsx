"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { scoreName } from "../lib/rarity";
import { RarityMeter } from "./RarityMeter";
import { ShareCard } from "./ShareCard";

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
                    <p className="name-display">{result.parts.display}</p>
                  </div>
                  <div className="text-right">
                    <p className="label-text text-mist/80">Rarity score</p>
                    <p className="text-5xl font-semibold text-glacier">
                      {result.overallScore}
                    </p>
                    <p className="text-xs uppercase tracking-[0.3em] text-mist/80">
                      {result.label} · confidence {result.confidence}
                    </p>
                  </div>
                </div>
              </div>
              <RarityMeter score={result.overallScore} />
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
              <div className="text-xs text-mist/70">{result.estimateNote}</div>
            </div>
            <div className="glass-card card-hover p-8 md:p-12">
              <ShareCard score={result} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
