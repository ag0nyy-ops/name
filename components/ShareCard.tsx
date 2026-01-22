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

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-mist">
          Share card
        </div>
        <div className="flex items-center gap-2">
          {Object.entries(CARD_SIZES).map(([key, value]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSize(key as keyof typeof CARD_SIZES)}
              className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.2em] transition ${
                size === key
                  ? "border-aurora/60 bg-aurora/10 text-glacier"
                  : "border-white/10 text-mist hover:border-white/30"
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
          className="flex flex-col justify-between rounded-card border border-white/10 bg-[#0b0b0f] p-10 text-glacier"
          style={{ width: cardSize.width, height: cardSize.height }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-[0.4em] text-mist">Name Rarity</span>
            <span className="text-xs uppercase tracking-[0.4em] text-mist">{score.label}</span>
          </div>
          <div className="flex flex-col gap-6">
            <div>
              <p className="font-mono text-4xl uppercase tracking-[0.2em]">
                {score.parts.raw || "Your Name"}
              </p>
              <p className="mt-3 text-sm text-mist">Confidence: {score.confidence}</p>
            </div>
            <RarityMeter score={score.overallScore} />
            <div className="grid gap-3 text-sm text-mist sm:grid-cols-2">
              {score.partScores
                .filter((part) => part.value)
                .map((part) => (
                  <div key={part.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em]">
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
          <div className="text-xs text-mist">
            {score.estimateNote}
          </div>
        </div>
      </div>
    </div>
  );
}
