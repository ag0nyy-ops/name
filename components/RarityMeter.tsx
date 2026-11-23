"use client";

import { motion, useReducedMotion } from "framer-motion";

type RarityMeterProps = {
  score: number;
  compact?: boolean;
};

const BANDS = ["common", "uncommon", "rare", "very rare", "extreme"];

export function RarityMeter({ score, compact = false }: RarityMeterProps) {
  const reduceMotion = useReducedMotion();
  return (
    <div className="flex flex-col gap-2">
      <div
        className="meter-shell"
        role="meter"
        aria-label="Rarity score"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={score}
      >
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-aurora/30 via-aurora/80 to-glacier"
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{
            duration: reduceMotion ? 0 : 0.6,
            ease: [0.22, 1, 0.36, 1]
          }}
        />
        <div className="meter-ticks">
          {[20, 40, 60, 80].map((tick) => (
            <span key={tick} style={{ left: `${tick}%` }} />
          ))}
        </div>
      </div>
      <div
        className={`grid grid-cols-5 uppercase text-mist ${
          compact
            ? "text-lg tracking-[0.2em]"
            : "text-[0.55rem] tracking-[0.15em] sm:tracking-[0.25em]"
        }`}
        aria-hidden="true"
      >
        {BANDS.map((band) => (
          <span key={band} className="text-center">
            {band}
          </span>
        ))}
      </div>
    </div>
  );
}
