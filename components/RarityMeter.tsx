// jay. — © 2026 Jay — https://ag0nyy-ops.github.io/ — source viewable, not reusable by others (LICENSE)

// Five boxed bands with a solid fill. The fill grows in on CSS (meter__fill) and
// glides to a new score on a transition; reduced motion turns both off.
type RarityMeterProps = {
  score: number;
};

const BANDS = ["common", "uncommon", "rare", "very rare", "extreme"];

export function RarityMeter({ score }: RarityMeterProps) {
  const band = Math.min(4, Math.floor(score / 20));
  return (
    <div className="flex flex-col">
      <div
        className="meter"
        role="meter"
        aria-label="Rarity score"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={score}
      >
        <div
          className="meter__fill"
          style={{ transform: `scaleX(${score / 100})` }}
        />
        <div className="meter__ticks" aria-hidden="true">
          {[20, 40, 60, 80].map((tick) => (
            <span key={tick} style={{ left: `${tick}%` }} />
          ))}
        </div>
      </div>
      <div className="meter__bands" aria-hidden="true">
        {BANDS.map((name, index) => (
          <span key={name} data-on={index === band}>
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}
