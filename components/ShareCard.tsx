// jay. — © 2026 Jay — https://ag0nyy-ops.github.io/ — source viewable, not reusable by others (LICENSE)
"use client";

import { toPng } from "html-to-image";
import { useEffect, useRef, useState } from "react";
import type { NameResult, PartResult } from "../lib/engine";
import { KIND_TEXT, LABEL_TEXT, formatPeople } from "../lib/format";
import { RarityMeter } from "./RarityMeter";

const CARD_SIZES = {
  square: { width: 1080, height: 1080, label: "Square" },
  wide: { width: 1200, height: 630, label: "Wide" }
} as const;

type Size = keyof typeof CARD_SIZES;

export function ShareCard({ result }: { result: NameResult }) {
  const [size, setSize] = useState<Size>("square");
  const [isDownloading, setIsDownloading] = useState(false);
  const [scale, setScale] = useState(0.3);
  const frameRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const card = CARD_SIZES[size];

  // The card is drawn at full export size and scaled down to fit the screen.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const update = () => setScale(Math.min(1, frame.clientWidth / card.width));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [card.width]);

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setIsDownloading(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        width: card.width,
        height: card.height
      });
      const link = document.createElement("a");
      const slug =
        result.display
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || "name";
      link.download = `${slug}-rarity-${size}.png`;
      link.href = dataUrl;
      link.click();
    } finally {
      setIsDownloading(false);
    }
  };

  const parts = [result.first, result.last].filter(
    (p): p is PartResult => p !== null
  );

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="label">Exhibit / share card</h2>
        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Card size"
        >
          {(Object.keys(CARD_SIZES) as Size[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={size === key}
              onClick={() => setSize(key)}
              className="btn btn--quiet"
            >
              {CARD_SIZES[key].label}
            </button>
          ))}
          <button
            type="button"
            onClick={handleDownload}
            className="btn btn--solid"
            disabled={isDownloading}
          >
            {isDownloading ? "Preparing…" : "Download PNG"}
          </button>
        </div>
      </div>
      <div ref={frameRef} className="w-full">
        <div
          style={{ width: card.width * scale, height: card.height * scale }}
          className="overflow-hidden"
        >
          <div
            style={{
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              width: card.width
            }}
          >
            <div
              ref={cardRef}
              className={`share-card flex flex-col justify-between overflow-hidden ${size === "wide" ? "p-14" : "p-20"}`}
              style={{ width: card.width, height: card.height }}
            >
              <div className="flex items-center justify-between gap-6">
                <span className="label text-2xl">File / name rarity</span>
                <span className="stamp">{LABEL_TEXT[result.label]}</span>
              </div>
              <div className={`flex flex-col ${size === "wide" ? "gap-6" : "gap-10"}`}>
                <p
                  className="share-card__name"
                  style={{
                    fontSize: nameSize(result.display, size === "wide" ? 7 : 9)
                  }}
                >
                  {result.display}
                </p>
                <p
                  className={`score-display ${size === "wide" ? "text-[9rem]" : "text-[13rem]"}`}
                >
                  {result.score}
                  <span className="score-display__of">/100</span>
                </p>
                <RarityMeter score={result.score ?? 0} />
              </div>
              <div className="flex items-end justify-between gap-6 font-mono text-2xl uppercase tracking-[0.14em] text-muted">
                <span>
                  {result.estimate
                    ? `${formatPeople(result.estimate.people)} in the US`
                    : parts
                        .map(
                          (p) =>
                            `${KIND_TEXT[p.kind]}: ${LABEL_TEXT[p.label].toLowerCase()}`
                        )
                        .join(" · ")}
                </span>
                <span>SSA + Census data</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Long names shrink so they stay on the card; short ones fill it.
function nameSize(name: string, maxRem: number) {
  const length = Math.max(name.length, 1);
  return `${Math.max(3.2, Math.min(maxRem, 46 / length))}rem`;
}
