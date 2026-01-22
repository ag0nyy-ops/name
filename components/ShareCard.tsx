"use client";

import { toPng } from "html-to-image";
import { useRef, useState } from "react";
import type { NameScore } from "../lib/rarity";
import { RarityMeter } from "./RarityMeter";

const CARD_SIZES = {
  square: { width: 1080, height: 1080, label: "1080 x 1080" },
  wide: { width: 1200, height: 630, label: "1200 x 630" }
};

type ShareCardProps = {
  score: NameScore;
};

export function ShareCard({ score }: ShareCardProps) {
  const [size, setSize] = useState<keyof typeof CARD_SIZES>("square");
  const [isDownloading, setIsDownloading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setIsDownloading(true);
    try {
      const dataUrl = await toPng(cardRef.current, { cacheBust: true, pixelRatio: 2 });
      const link = document.createElement("a");
      link.download = `name-rarity-${size}.png`;
      link.href = dataUrl;
      link.click();
    } finally {
      setIsDownloading(false);
    }
  };

  const cardSize = CARD_SIZES[size];
  const scoreValue = score.overallScore ?? 0;

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="label-text">Share card</div>
        <div className="flex items-center gap-2">
          {Object.entries(CARD_SIZES).map(([key, value]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSize(key as keyof typeof CARD_SIZES)}
              className={`rounded-full border px-4 py-2 text-[0.65rem] uppercase tracking-[0.25em] transition ${
                size === key
                  ? "border-aurora/60 bg-aurora/10 text-glacier"
                  : "border-white/10 text-mist/70 hover:border-white/30 hover:text-mist"
              }`}
            >
              {value.label}
            </button>
          ))}
          <button
            type="button"
            onClick={handleDownload}
            className="button-primary"
            aria-label="Download share card"
            disabled={isDownloading}
          >
            {isDownloading ? "Preparing" : "Download"}
          </button>
        </div>
      </div>
      <div className="w-full overflow-auto">
        <div
          ref={cardRef}
          className={`share-card relative flex flex-col justify-between overflow-hidden rounded-card border border-white/10 text-glacier ${
            size === "wide" ? "p-10" : "p-12"
          }`}
          style={{ width: cardSize.width, height: cardSize.height }}
        >
          <div className="share-card-noise pointer-events-none absolute inset-0 opacity-40" />
          <div className="pointer-events-none absolute inset-0 bg-white/5 opacity-30" />
          <div className="relative flex items-center justify-between">
            <span className="text-[0.65rem] font-semibold uppercase tracking-[0.4em] text-mist/80">
              Name Rarity
            </span>
            <span className="text-[0.65rem] font-semibold uppercase tracking-[0.4em] text-mist/80">
              {score.label}
            </span>
          </div>
          <div className="relative flex flex-col gap-6">
            <div>
              <p className="font-mono text-4xl uppercase tracking-[0.18em] text-glacier leading-tight">
                {score.parts.display || "Your Name"}
              </p>
              <p className="mt-3 text-sm text-mist/80">Confidence: {score.confidence}</p>
            </div>
            <RarityMeter score={scoreValue} compact />
            <div className="grid gap-3 text-sm text-mist/80 sm:grid-cols-2">
              {score.partScores
                .filter((part) => part.value)
                .map((part) => (
                  <div
                    key={part.label}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex items-center justify-between text-[0.6rem] uppercase tracking-[0.25em]">
                      <span>{part.label}</span>
                      <span>
                        Tier {part.tier} · {part.tierLabel}
                      </span>
                    </div>
                    <div className="mt-2 font-mono text-sm text-glacier">{part.value}</div>
                  </div>
                ))}
            </div>
          </div>
          <div className="relative text-xs text-mist/70">{score.estimateNote}</div>
        </div>
      </div>
    </div>
  );
}
