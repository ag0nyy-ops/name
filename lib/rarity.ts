import specialCases from "../data/specialCases.json";

export type Confidence = "high" | "medium" | "low";

export type NameParts = {
  raw: string;
  first?: string;
  middle?: string;
  last?: string;
  suffix?: string;
};

export type PartScore = {
  label: string;
  value?: string;
  tier: number;
  tierLabel: "common" | "uncommon" | "rare" | "very rare" | "extreme";
  confidence: Confidence;
  notes: string[];
};

export type NameScore = {
  parts: NameParts;
  partScores: PartScore[];
  overallTier: number;
  overallScore: number;
  label: "common" | "uncommon" | "rare" | "very rare" | "extreme";
  confidence: Confidence;
  estimateNote: string;
};

const COMMON_FIRST_NAMES = new Set([
  "james",
  "john",
  "robert",
  "michael",
  "william",
  "david",
  "mary",
  "patricia",
  "jennifer",
  "linda",
  "elizabeth",
  "barbara",
  "susan",
  "joseph",
  "thomas",
  "charles"
]);

const ROMAN_SUFFIXES = new Set([
  "i",
  "ii",
  "iii",
  "iv",
  "v",
  "vi",
  "vii",
  "viii",
  "ix",
  "x",
  "xi",
  "xii",
  "xiii",
  "xiv",
  "xv",
  "xvi",
  "xvii",
  "xviii",
  "xix",
  "xx"
]);

export function detectSuffix(token?: string): string | undefined {
  if (!token) return undefined;
  const normalized = token.toLowerCase();
  if (normalized === "jr" || normalized === "sr") return token;
  if (ROMAN_SUFFIXES.has(normalized)) return token;
  return undefined;
}

const punctuationRegex = /[^\p{L}\p{N}\s-]/gu;

export function parseName(input: string): NameParts {
  const normalized = input
    .replace(punctuationRegex, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return { raw: "" };
  }

  const tokens = normalized.split(" ").filter(Boolean);
  let suffix: string | undefined;
  let lastIndex = tokens.length - 1;
  const possibleSuffix = tokens[lastIndex];
  const detected = detectSuffix(possibleSuffix);
  if (detected) {
    suffix = detected;
    lastIndex -= 1;
  }

  const first = tokens[0]?.replace(/-/g, "");
  const lastToken = tokens[lastIndex];
  const last = lastToken;
  const middleTokens = tokens.slice(1, lastIndex).map((token) => token.replace(/-/g, ""));
  const middle = middleTokens.length ? middleTokens.join(" ") : undefined;

  return {
    raw: normalized,
    first: first || undefined,
    middle,
    last: last || undefined,
    suffix
  };
}

function normalizeKey(value?: string): string | undefined {
  return value?.toLowerCase();
}

function applySpecialCase(
  type: keyof typeof specialCases,
  value?: string
): { tier?: number; confidence?: Confidence; note?: string } {
  if (!value) return {};
  const key = normalizeKey(value);
  if (!key) return {};
  const entry = specialCases[type][key as keyof (typeof specialCases)[typeof type]] as
    | { tier: number; confidence: Confidence; note?: string }
    | undefined;
  if (!entry) return {};
  return entry;
}

function isStylized(value: string): boolean {
  return /[zy]/i.test(value) && /[aeiou]/i.test(value);
}

function baseFirstTier(value?: string): { tier: number; confidence: Confidence; notes: string[] } {
  if (!value) {
    return { tier: 1, confidence: "low", notes: ["missing first name"] };
  }
  const key = normalizeKey(value);
  if (key && COMMON_FIRST_NAMES.has(key)) {
    return { tier: 2, confidence: "high", notes: ["very common first name"] };
  }
  const stylized = isStylized(value) ? 1 : 0;
  const tier = 4 + stylized;
  return {
    tier,
    confidence: stylized ? "medium" : "medium",
    notes: stylized ? ["stylized spelling adds rarity"] : ["not in common list"]
  };
}

function baseMiddleTier(value?: string): { tier: number; confidence: Confidence; notes: string[] } {
  if (!value) {
    return { tier: 1, confidence: "low", notes: ["no middle name"] };
  }
  const parts = value.split(" ").filter(Boolean);
  const multiPartBonus = parts.length > 1 ? 1 : 0;
  const stylized = isStylized(value) ? 1 : 0;
  const tier = 3 + multiPartBonus + stylized;
  return {
    tier,
    confidence: "medium",
    notes: [
      parts.length > 1 ? "multiple middle names" : "single middle name",
      stylized ? "stylized spelling adds rarity" : ""
    ].filter(Boolean)
  };
}

function hasUncommonPattern(value: string): boolean {
  return /(qx|zx|yj|yy|vv|aei|uo|aa|zz)/i.test(value);
}

function baseLastTier(value?: string): { tier: number; confidence: Confidence; notes: string[] } {
  if (!value) {
    return { tier: 1, confidence: "low", notes: ["missing last name"] };
  }
  const hyphenated = value.includes("-");
  if (hyphenated) {
    return {
      tier: 7,
      confidence: "medium",
      notes: ["hyphenated surname", "baseline high rarity"]
    };
  }
  const lengthBonus = value.length >= 9 ? 1 : 0;
  const uncommon = hasUncommonPattern(value) ? 1 : 0;
  const tier = 5 + lengthBonus + uncommon;
  return {
    tier,
    confidence: uncommon ? "medium" : "medium",
    notes: [
      value.length >= 9 ? "long surname" : "average length surname",
      uncommon ? "uncommon letter pattern" : ""
    ].filter(Boolean)
  };
}

function suffixTier(value?: string): { tier: number; confidence: Confidence; notes: string[] } {
  if (!value) {
    return { tier: 1, confidence: "low", notes: ["no suffix"] };
  }
  const normalized = value.toLowerCase();
  if (ROMAN_SUFFIXES.has(normalized)) {
    return { tier: 6, confidence: "medium", notes: ["roman numeral suffix"] };
  }
  return { tier: 4, confidence: "medium", notes: ["generational suffix"] };
}

function clampTier(tier: number): number {
  return Math.min(10, Math.max(1, tier));
}

function toLabel(score: number): NameScore["label"] {
  if (score >= 80) return "extreme";
  if (score >= 65) return "very rare";
  if (score >= 45) return "rare";
  if (score >= 25) return "uncommon";
  return "common";
}

function partTierLabel(tier: number): PartScore["tierLabel"] {
  if (tier >= 9) return "extreme";
  if (tier >= 7) return "very rare";
  if (tier >= 5) return "rare";
  if (tier >= 3) return "uncommon";
  return "common";
}

function combineConfidence(confidences: Confidence[]): Confidence {
  if (confidences.includes("low")) return "low";
  if (confidences.includes("medium")) return "medium";
  return "high";
}

export function scoreName(input: string): NameScore {
  const parts = parseName(input);

  const specialFirst = applySpecialCase("firstExact", parts.first);
  const specialMiddle = applySpecialCase("middleExact", parts.middle);
  const specialLast = applySpecialCase("lastExact", parts.last);
  const specialFull = applySpecialCase("fullExact", parts.raw);

  const firstScore = baseFirstTier(parts.first);
  const middleScore = baseMiddleTier(parts.middle);
  const lastScore = baseLastTier(parts.last);
  const suffixScore = suffixTier(parts.suffix);

  const firstTier = clampTier(specialFirst.tier ?? firstScore.tier);
  const middleTier = clampTier(specialMiddle.tier ?? middleScore.tier);
  const lastTier = clampTier(specialLast.tier ?? lastScore.tier);
  const suffixTierValue = clampTier(suffixScore.tier);

  const partScores: PartScore[] = [
    {
      label: "First",
      value: parts.first,
      tier: firstTier,
      tierLabel: partTierLabel(firstTier),
      confidence: specialFirst.confidence ?? firstScore.confidence,
      notes: [specialFirst.note, ...firstScore.notes].filter(Boolean)
    },
    {
      label: "Middle",
      value: parts.middle,
      tier: middleTier,
      tierLabel: partTierLabel(middleTier),
      confidence: specialMiddle.confidence ?? middleScore.confidence,
      notes: [specialMiddle.note, ...middleScore.notes].filter(Boolean)
    },
    {
      label: "Last",
      value: parts.last,
      tier: lastTier,
      tierLabel: partTierLabel(lastTier),
      confidence: specialLast.confidence ?? lastScore.confidence,
      notes: [specialLast.note, ...lastScore.notes].filter(Boolean)
    },
    {
      label: "Suffix",
      value: parts.suffix,
      tier: suffixTierValue,
      tierLabel: partTierLabel(suffixTierValue),
      confidence: suffixScore.confidence,
      notes: suffixScore.notes
    }
  ];

  const tiers = [firstTier, middleTier, lastTier, suffixTierValue];
  const activeTiers = tiers.filter((tier, index) => {
    if (index === 1) return Boolean(parts.middle);
    if (index === 3) return Boolean(parts.suffix);
    return true;
  });

  const rawProduct = activeTiers.reduce((product, tier) => product * tier, 1);
  const maxLog = Math.log10(Math.pow(10, activeTiers.length));
  const logScore = Math.log10(rawProduct) / maxLog;
  let overallScore = Math.round(logScore * 100);

  let overallTier = clampTier(
    Math.round(activeTiers.reduce((sum, tier) => sum + tier, 0) / activeTiers.length)
  );

  if (specialFull.tier) {
    overallTier = clampTier(specialFull.tier);
    overallScore = Math.max(overallScore, Math.round((overallTier / 10) * 100));
  }

  const confidences = partScores
    .filter((score) => score.value)
    .map((score) => score.confidence);

  return {
    parts,
    partScores,
    overallTier,
    overallScore,
    label: toLabel(overallScore),
    confidence: specialFull.confidence ?? combineConfidence(confidences),
    estimateNote: specialFull.note
      ? `${specialFull.note}. Score is a tiered estimate based on patterns, not population statistics.`
      : "Score is a tiered estimate based on patterns, not population statistics."
  };
}
