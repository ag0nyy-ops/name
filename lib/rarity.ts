import censusSurnames from "../data/generated/census_surnames.json";
import ssaFirstNames from "../data/generated/ssa_first_names.json";
import specialCases from "../data/specialCases.json";

export type Confidence = "high" | "medium" | "low";

export type NameParts = {
  raw: string;
  display: string;
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

type FrequencyEntry = {
  count: number;
  percentile: number;
};

type FrequencyTable = {
  source: string;
  generatedAt: string | null;
  totalNames: number;
  totalCount: number;
  percentileScale: number;
  names: Record<string, FrequencyEntry>;
};

const SSA_TABLE = ssaFirstNames as FrequencyTable;
const CENSUS_TABLE = censusSurnames as FrequencyTable;

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

const percentileBins = [0.01, 0.05, 0.15, 0.35, 0.65, 0.85, 0.95, 0.99];

export function detectSuffix(token?: string): string | undefined {
  if (!token) return undefined;
  const normalized = token.toLowerCase();
  if (normalized === "jr" || normalized === "sr") return normalized;
  if (ROMAN_SUFFIXES.has(normalized)) return normalized;
  return undefined;
}

const punctuationRegex = /[^\p{L}\p{N}\s-]/gu;

export function parseName(input: string): NameParts {
  const cleanedDisplay = input
    .replace(punctuationRegex, " ")
    .replace(/\s+/g, " ")
    .trim();
  const normalized = cleanedDisplay.toLowerCase();

  if (!normalized) {
    return { raw: "", display: "" };
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
  const lastToken = lastIndex > 0 ? tokens[lastIndex] : undefined;
  const last = lastToken;
  const middleTokens =
    lastIndex > 1 ? tokens.slice(1, lastIndex).map((token) => token.replace(/-/g, "")) : [];
  const middle = middleTokens.length ? middleTokens.join(" ") : undefined;

  return {
    raw: normalized,
    display: cleanedDisplay || normalized,
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

function tierFromPercentile(percentile: number): number {
  if (percentile <= percentileBins[0]) return 2;
  if (percentile <= percentileBins[1]) return 3;
  if (percentile <= percentileBins[2]) return 4;
  if (percentile <= percentileBins[3]) return 5;
  if (percentile <= percentileBins[4]) return 6;
  if (percentile <= percentileBins[5]) return 7;
  if (percentile <= percentileBins[6]) return 8;
  if (percentile <= percentileBins[7]) return 9;
  return 10;
}

function lookupFrequency(
  table: FrequencyTable,
  value?: string
): { tier: number; confidence: Confidence; notes: string[]; found: boolean } {
  if (!value) {
    return { tier: 1, confidence: "low", notes: ["missing"], found: false };
  }
  const key = normalizeKey(value);
  if (!key) {
    return { tier: 1, confidence: "low", notes: ["missing"], found: false };
  }
  const entry = table.names[key];
  if (table.totalNames === 0 || table.percentileScale === 0) {
    return {
      tier: 4,
      confidence: "low",
      notes: ["dataset not loaded; run the data build script"],
      found: false
    };
  }
  if (!entry) {
    return {
      tier: 4,
      confidence: "low",
      notes: ["not found in dataset"],
      found: false
    };
  }
  const percentile = entry.percentile / table.percentileScale;
  const tier = tierFromPercentile(percentile);
  return {
    tier,
    confidence: "high",
    notes: ["found in dataset"],
    found: true
  };
}

function isStylized(value: string): boolean {
  const normalized = value.toLowerCase();
  return normalized.endsWith("z") || (/y/.test(normalized) && /[aeiou]/.test(normalized));
}

function clampTier(tier: number): number {
  return Math.min(10, Math.max(1, tier));
}

function partTierLabel(tier: number): PartScore["tierLabel"] {
  if (tier >= 9) return "extreme";
  if (tier >= 7) return "very rare";
  if (tier >= 5) return "rare";
  if (tier >= 3) return "uncommon";
  return "common";
}

function buildFirstScore(value?: string) {
  if (!value) {
    return { tier: 1, confidence: "low" as const, notes: ["missing first name"], found: false };
  }
  const result = lookupFrequency(SSA_TABLE, value);
  const stylizedBoost = isStylized(value) ? 0.5 : 0;
  const tier = clampTier(Math.round(result.tier + stylizedBoost));
  const notes = [...result.notes];
  if (stylizedBoost) {
    notes.push("stylized spelling adds a small rarity bump");
  }
  return { ...result, tier, notes };
}

function buildMiddleScore(value?: string) {
  if (!value) {
    return { tier: 1, confidence: "low" as const, notes: ["no middle name"], found: false };
  }
  const tokens = value.split(" ").filter(Boolean);
  const tokenScores = tokens.map((token) => lookupFrequency(SSA_TABLE, token));
  const averageTier =
    tokenScores.reduce((sum, score) => sum + score.tier, 0) / Math.max(1, tokenScores.length);
  const tier = clampTier(Math.round(averageTier));
  const foundAll = tokenScores.every((score) => score.found);
  const notes = [
    tokenScores.length > 1 ? "multiple middle names" : "single middle name",
    foundAll ? "found in dataset" : "one or more middle names not found"
  ];
  const confidence: Confidence = tokenScores.length > 1 ? "medium" : foundAll ? "high" : "low";
  return { tier, confidence, notes, found: foundAll };
}

function buildLastScore(value?: string) {
  if (!value) {
    return { tier: 1, confidence: "low" as const, notes: ["missing last name"], found: false };
  }

  if (value.includes("-")) {
    const exact = lookupFrequency(CENSUS_TABLE, value);
    if (exact.found) {
      const tier = clampTier(Math.max(7, exact.tier));
      return {
        tier,
        confidence: "high" as const,
        notes: ["hyphenated surname", ...exact.notes],
        found: true
      };
    }

    const parts = value.split("-").filter(Boolean);
    const partScores = parts.map((part) => lookupFrequency(CENSUS_TABLE, part));
    const maxTier = Math.max(...partScores.map((score) => score.tier));
    const foundAll = partScores.every((score) => score.found);
    const tier = clampTier(Math.max(7, maxTier + 1));
    const confidence: Confidence = foundAll ? "medium" : "low";
    return {
      tier,
      confidence,
      notes: [
        "hyphenated surname combined from parts",
        foundAll ? "all parts found in dataset" : "one or more parts not found"
      ],
      found: foundAll
    };
  }

  const result = lookupFrequency(CENSUS_TABLE, value);
  return {
    tier: result.tier,
    confidence: result.confidence,
    notes: result.notes,
    found: result.found
  };
}

function buildSuffixScore(value?: string) {
  if (!value) {
    return { tier: 1, confidence: "low" as const, notes: ["no suffix"], found: false };
  }
  const romanBoost = ROMAN_SUFFIXES.has(value.toLowerCase()) ? 0.5 : 0;
  const tier = clampTier(Math.round(4 + romanBoost));
  return {
    tier,
    confidence: "medium" as const,
    notes: [ROMAN_SUFFIXES.has(value.toLowerCase()) ? "roman numeral suffix" : "generational suffix"],
    found: true
  };
}

function toLabel(score: number): NameScore["label"] {
  if (score >= 81) return "extreme";
  if (score >= 61) return "very rare";
  if (score >= 41) return "rare";
  if (score >= 21) return "uncommon";
  return "common";
}

function capLabel(label: NameScore["label"], maxLabel: NameScore["label"]): NameScore["label"] {
  const order: NameScore["label"][] = ["common", "uncommon", "rare", "very rare", "extreme"];
  const labelIndex = order.indexOf(label);
  const maxIndex = order.indexOf(maxLabel);
  if (labelIndex === -1 || maxIndex === -1) return label;
  return order[Math.min(labelIndex, maxIndex)];
}

function weightFromTier(tier: number, base: number): number {
  return Math.pow(base, tier - 1);
}

function buildEstimateNote(notes: string[]) {
  return [
    "Score is an estimate based on US frequency tables (SSA baby names and Census surnames).",
    "Results are US-biased. No 1-in-N claims or fake precision — tiers and confidence only.",
    ...notes
  ]
    .filter(Boolean)
    .join(" ");
}

export function scoreName(input: string): NameScore {
  const parts = parseName(input);
  const tokens = parts.raw.split(" ").filter(Boolean);
  const hasLast = Boolean(parts.last);
  const isSingleToken = tokens.length === 1;

  const specialFirst = applySpecialCase("firstExact", parts.first);
  const specialMiddle = applySpecialCase("middleExact", parts.middle);
  const specialLast = applySpecialCase("lastExact", parts.last);
  const specialFull = applySpecialCase("fullExact", parts.raw);
  const hasSpecialCase = Boolean(
    specialFirst.tier || specialMiddle.tier || specialLast.tier || specialFull.tier
  );

  const firstScore = buildFirstScore(parts.first);
  const middleScore = buildMiddleScore(parts.middle);
  const lastScore = buildLastScore(parts.last);
  const suffixScore = buildSuffixScore(parts.suffix);

  const firstTier = clampTier(specialFirst.tier ?? firstScore.tier);
  const middleTier = clampTier(specialMiddle.tier ?? middleScore.tier);
  const lastTier = clampTier(specialLast.tier ?? lastScore.tier);
  const suffixTier = clampTier(suffixScore.tier);

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
      tier: suffixTier,
      tierLabel: partTierLabel(suffixTier),
      confidence: suffixScore.confidence,
      notes: suffixScore.notes
    }
  ];

  const activeTiers = [
    parts.first ? firstTier : undefined,
    parts.middle ? middleTier : undefined,
    parts.last ? lastTier : undefined,
    parts.suffix ? suffixTier : undefined
  ].filter((tier): tier is number => typeof tier === "number");

  const base = 1.75;
  const product = activeTiers.reduce((acc, tier) => acc * weightFromTier(tier, base), 1);
  const scaledScore = Math.round(24 * Math.log10(product || 1));
  let overallScore = Math.min(100, Math.max(0, scaledScore));
  let overallTier = clampTier(
    Math.round(activeTiers.reduce((sum, tier) => sum + tier, 0) / Math.max(1, activeTiers.length))
  );

  if (specialFull.tier) {
    overallTier = clampTier(specialFull.tier);
    overallScore = Math.max(overallScore, Math.round((overallTier / 10) * 100));
  }

  const partConfidences = partScores
    .filter((score) => score.value)
    .map((score) => score.confidence);
  const unknownParts = partScores.filter((score) => score.value && score.confidence === "low").length;
  const hasFirstFound =
    (specialFirst.tier ? true : firstScore.found) && Boolean(parts.first?.length);
  const hasLastFound = (specialLast.tier ? true : lastScore.found) && Boolean(parts.last?.length);

  let confidence: Confidence = "medium";
  if (isSingleToken || !hasLast || unknownParts >= 2) {
    confidence = "low";
  } else if (hasFirstFound && hasLastFound && tokens.length >= 2 && !partConfidences.includes("low")) {
    confidence = "high";
  }

  const capNotes: string[] = [];

  if (isSingleToken) {
    overallScore = Math.min(overallScore, 45);
    overallTier = Math.min(overallTier, 5);
    confidence = "low";
    capNotes.push("Single-token inputs are capped to avoid false precision.");
  }

  if (!hasLast) {
    overallScore = Math.min(overallScore, 60);
    overallTier = Math.min(overallTier, 6);
    if (confidence !== "low") confidence = "medium";
    capNotes.push("Missing last names cap the score to prevent overstating rarity.");
  }

  const allowExtreme =
    hasLast && (lastTier >= 9 || Boolean(specialLast.tier) || Boolean(specialFull.tier));
  if (!allowExtreme && overallScore >= 81) {
    overallScore = 80;
    overallTier = Math.min(overallTier, 8);
    capNotes.push("Extreme labels require a top-tier last name or special-case match.");
  }

  let label = toLabel(overallScore);
  if (isSingleToken) {
    label = capLabel(label, "uncommon");
  }
  if (!hasLast) {
    label = capLabel(label, "rare");
  }
  if (label === "extreme" && !allowExtreme) {
    label = "very rare";
  }
  if (label === "very rare" && !hasLast) {
    label = "rare";
  }

  return {
    parts,
    partScores,
    overallTier,
    overallScore,
    label,
    confidence,
    estimateNote: buildEstimateNote([specialFull.note, ...capNotes].filter(Boolean))
  };
}
