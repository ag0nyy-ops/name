"use client";

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
    }, 180);
  };

  return (
    <section className="flex flex-col gap-10">
      <div className="glass-card flex flex-col gap-8 p-8 md:p-12">
        <div className="flex flex-col gap-4">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-mist">Name rarity</p>
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
            Find the rarity signature of any name.
          </h1>
          <p className="section-subtitle">
            Transparent, tiered scoring based on structural patterns — no tracking, no lookups, no
            personal data.
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
          <button
            className="button-primary w-full md:w-auto"
            type="button"
            onClick={handleAnalyze}
            aria-busy={isLoading}
          >
            {isLoading ? "Analyzing" : "Analyze"}
          </button>
        </div>
      </div>

      {result && (
        <div className="flex flex-col gap-8">
          <div className="glass-card flex flex-col gap-8 p-8 md:p-12">
            <div className="flex flex-col gap-4">
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-mist">
                Results
              </p>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-mist">Name</p>
                  <p className="font-mono text-3xl uppercase tracking-[0.2em]">
                    {result.parts.raw}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm uppercase tracking-[0.3em] text-mist">Rarity score</p>
                  <p className="text-4xl font-semibold text-glacier">
                    {result.overallScore}
                  </p>
                  <p className="text-xs uppercase tracking-[0.3em] text-mist">
                    {result.label} · confidence {result.confidence}
                  </p>
                </div>
              </div>
            </div>
            <RarityMeter score={result.overallScore} />
            <div className="grid gap-4 md:grid-cols-2">
              {result.partScores.map((part, index) => (
                <div
                  key={part.label}
                  className="glass-card fade-in flex flex-col gap-3 border border-white/10 bg-white/5 p-5"
                  style={{ animationDelay: `${index * 70}ms` }}
                >
                  <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-mist">
                    <span>{part.label}</span>
                    <span>
                      Tier {part.tier} · {part.tierLabel}
                    </span>
                  </div>
                  <div className="font-mono text-xl text-glacier">
                    {part.value || "—"}
                  </div>
                  <div className="text-xs text-mist">Confidence: {part.confidence}</div>
                  <ul className="list-disc pl-4 text-xs text-mist">
                    {part.notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="text-xs text-mist">{result.estimateNote}</div>
          </div>
          <div className="glass-card p-8 md:p-12">
            <ShareCard score={result} />
          </div>
        </div>
      )}
    </section>
  );
}
