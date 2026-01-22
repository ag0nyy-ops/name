"use client";

import { motion, useReducedMotion } from "framer-motion";

type RarityMeterProps = {
  score?: number | null;
  compact?: boolean;
};

const SCALE_LABELS = ["common", "uncommon", "rare", "very rare", "extreme"];

export function RarityMeter({ score, compact = false }: RarityMeterProps) {
  const reduceMotion = useReducedMotion();
  const hasScore = typeof score === "number";
  const displayScore = hasScore ? `${score}/100` : "N/A";
  const width = hasScore ? `${score}%` : "0%";

  return (
    <div className={`flex flex-col ${compact ? "gap-2" : "gap-3"}`}>
      <div
        className={`flex items-center justify-between uppercase tracking-[0.3em] text-mist ${
          compact ? "text-[0.6rem]" : "text-xs"
        }`}
      >
        <span>Rarity Meter</span>
        <span>{displayScore}</span>
      </div>
      <div className="meter-shell" aria-hidden="true">
        <div className="relative h-full overflow-hidden rounded-full">
          <motion.div
            className="relative h-full rounded-full bg-gradient-to-r from-aurora/30 via-aurora/80 to-white/95"
            initial={{ width: 0 }}
            animate={{ width }}
            transition={{
              duration: reduceMotion ? 0 : 0.65,
              ease: [0.22, 1, 0.36, 1]
            }}
          >
            <div className="absolute right-0 top-1/2 h-3 w-3 -translate-y-1/2 translate-x-1/2 rounded-full bg-white/90 shadow-[0_0_18px_rgba(255,255,255,0.7)]" />
            <div className="absolute right-0 top-1/2 h-6 w-10 -translate-y-1/2 translate-x-1/2 bg-white/20 blur-xl" />
          </motion.div>
        </div>
        <div
          className="absolute top-1/2 h-3 w-[2px] -translate-y-1/2 rounded-full bg-white/70 shadow-[0_0_12px_rgba(255,255,255,0.5)]"
          style={{ left: width }}
        />
        <div
          className="absolute top-1/2 h-2 w-2 -translate-y-1/2 -translate-x-1/2 rounded-full border border-white/70 bg-obsidian shadow-[0_0_12px_rgba(255,255,255,0.4)]"
          style={{ left: width }}
        />
      </div>
      <div
        className={`grid grid-cols-5 text-[0.55rem] uppercase tracking-[0.3em] text-mist/70 ${
          compact ? "gap-1" : "gap-2"
        }`}
      >
        {SCALE_LABELS.map((label) => (
          <span key={label} className="text-center">
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
