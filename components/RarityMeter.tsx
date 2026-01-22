type RarityMeterProps = {
  score: number;
};

export function RarityMeter({ score }: RarityMeterProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-mist">
        <span>Rarity Meter</span>
        <span>{score}/100</span>
      </div>
      <div className="meter-shell" aria-hidden="true">
        <div
          className="h-full rounded-full bg-gradient-to-r from-aurora/40 via-aurora/80 to-white/90 transition-all duration-200 ease-out-smooth"
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}
