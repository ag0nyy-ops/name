import censusSurnames from "../data/generated/census_surnames.json";
import ssaFirstNames from "../data/generated/ssa_first_names.json";
import specialCases from "../data/specialCases.json";

export type Confidence = "high" | "medium" | "low";
export type ScoreStatus = "scored" | "unknown" | "blocked";
export type NameLabel =
  | "common"
  | "uncommon"
  | "rare"
  | "very rare"
  | "extreme"
  | "unknown"
  | "blocked";

export type ReasonCode =
  | "NO_LAST_NAME"
  | "NOT_FOUND_IN_DATASETS"
  | "SPECIAL_CASE_OVERRIDE"
  | "HYPHEN_COMPOSED"
  | "SPAM_WARN"
  | "SPAM_BLOCK"
  | "COMPLETENESS_CAP"
  | "DATASET_UNAVAILABLE"
  | "SINGLE_TOKEN"
  | "SCRIPT_NOT_SUPPORTED";

export type JunkScore = {
  verdict: "ok" | "warn" | "block";
  score: number;
  reasons: string[];
};

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
  found: boolean;
};

export type DatasetCheck = {
  id: string;
  name: string;
  scope: "first" | "middle" | "last";
  matched: boolean;
  note?: string;
};

export type NameScore = {
  status: ScoreStatus;
  parts: NameParts;
  partScores: PartScore[];
  overallTier: number | null;
  overallScore: number | null;
  label: NameLabel;
  confidence: Confidence;
  estimateNote: string;
  estimateDetail: string;
  datasetsChecked: DatasetCheck[];
  reasonCodes: ReasonCode[];
  junkScore: JunkScore;
  capsApplied: string[];
  confidenceNotes: string[];
  scoringVersion: string;
  datasetsUpdatedAt: {
    ssa: string | null;
    census: string | null;
  };
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

export const SCORING_MODEL_VERSION = "v1.0";

const SSA_TABLE = ssaFirstNames as FrequencyTable;
const CENSUS_TABLE = censusSurnames as FrequencyTable;

export const DATASET_INFO = {
  ssa: {
    id: "ssa-baby-names",
    name: "US SSA baby names",
    source: SSA_TABLE.source,
    updatedAt: SSA_TABLE.generatedAt,
    totalNames: SSA_TABLE.totalNames
  },
  census: {
    id: "us-census-surnames",
    name: "US Census surnames",
    source: CENSUS_TABLE.source,
    updatedAt: CENSUS_TABLE.generatedAt,
    totalNames: CENSUS_TABLE.totalNames
  }
};

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
const disallowedCharsRegex = /[^\p{L}\s'-]/gu;
const keyboardSequences = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const rareBigrams = new Set([
  "qj",
  "jq",
  "qz",
  "zq",
  "xq",
  "qx",
  "zx",
  "xz",
  "vj",
  "jv",
  "kq",
  "qk",
  "wq",
  "qw"
]);
const rareClusters = ["qwr", "xq", "zx", "qz", "jq", "vj", "kq", "wq", "xj"];

export function detectSuffix(token?: string): string | undefined {
  if (!token) return undefined;
  const normalized = token.toLowerCase();
  if (normalized === "jr" || normalized === "sr") return normalized;
  if (ROMAN_SUFFIXES.has(normalized)) return normalized;
  return undefined;
}

export function normalizeInput(input: string) {
  const trimmed = input.replace(/\s+/g, " ").trim();
  const disallowed = trimmed.match(disallowedCharsRegex) ?? [];
  const disallowedChars = Array.from(new Set(disallowed));
  const display = trimmed.replace(disallowedCharsRegex, "").replace(/\s+/g, " ").trim();
  const normalized = display.toLowerCase();
  const tokens = normalized ? normalized.split(" ").filter(Boolean) : [];
  return {
    trimmed,
    normalized,
    display,
    tokens,
    disallowedChars
  };
}

export function parseName(input: string): NameParts {
  const normalized = normalizeInput(input);

  if (!normalized.normalized) {
    return { raw: "", display: "" };
  }

  const tokens = normalized.tokens;
  let suffix: string | undefined;
  let lastIndex = tokens.length - 1;
  const possibleSuffix = tokens[lastIndex];
  const detected = detectSuffix(possibleSuffix);
  if (detected) {
    suffix = detected;
    lastIndex -= 1;
  }

  const first = tokens[0];
  const lastToken = lastIndex > 0 ? tokens[lastIndex] : undefined;
  const last = lastToken;
  const middleTokens = lastIndex > 1 ? tokens.slice(1, lastIndex) : [];
  const middle = middleTokens.length ? middleTokens.join(" ") : undefined;

  return {
    raw: normalized.normalized,
    display: normalized.display || normalized.normalized,
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

type LookupResult = {
  tier: number;
  confidence: Confidence;
  notes: string[];
  found: boolean;
  count?: number;
};

function lookupFrequency(table: FrequencyTable, value?: string): LookupResult {
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
      notes: ["dataset unavailable (build data before deploy)"],
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
    found: true,
    count: entry.count
  };
}

function isStylized(value: string): boolean {
  const normalized = value.toLowerCase();
  return normalized.includes("z") || (normalized.includes("y") && /[aeiou]/.test(normalized));
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

function buildFirstScore(value?: string): LookupResult {
  if (!value) {
    return { tier: 1, confidence: "low", notes: ["missing first name"], found: false };
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

function buildMiddleScore(value?: string): LookupResult {
  if (!value) {
    return { tier: 1, confidence: "low", notes: ["no middle name"], found: false };
  }
  const tokens = value.split(" ").filter(Boolean);
  const tokenScores = tokens.map((token) => lookupFrequency(SSA_TABLE, token));
  const averageTier =
    tokenScores.reduce((sum, score) => sum + score.tier, 0) / Math.max(1, tokenScores.length);
  const stylizedBoost = tokens.some((token) => isStylized(token)) ? 0.5 : 0;
  const tier = clampTier(Math.round(averageTier + stylizedBoost));
  const foundAll = tokenScores.every((score) => score.found);
  const notes = [
    tokenScores.length > 1 ? "multiple middle names" : "single middle name",
    foundAll ? "found in dataset" : "one or more middle names not found"
  ];
  if (stylizedBoost) {
    notes.push("stylized spelling adds a small rarity bump");
  }
  const confidence: Confidence = tokenScores.length > 1 ? "medium" : foundAll ? "high" : "low";
  return { tier, confidence, notes, found: foundAll };
}

function buildLastScore(value?: string): LookupResult & { composed: boolean } {
  if (!value) {
    return { tier: 1, confidence: "low", notes: ["missing last name"], found: false, composed: false };
  }

  if (value.includes("-")) {
    const exact = lookupFrequency(CENSUS_TABLE, value);
    if (exact.found) {
      const tier = clampTier(Math.max(7, exact.tier));
      return {
        tier,
        confidence: "high",
        notes: ["hyphenated surname", ...exact.notes],
        found: true,
        composed: false,
        count: exact.count
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
      found: foundAll,
      composed: true
    };
  }

  const result = lookupFrequency(CENSUS_TABLE, value);
  return {
    tier: result.tier,
    confidence: result.confidence,
    notes: result.notes,
    found: result.found,
    count: result.count,
    composed: false
  };
}

function buildSuffixScore(value?: string): LookupResult {
  if (!value) {
    return { tier: 1, confidence: "low", notes: ["no suffix"], found: false };
  }
  const romanBoost = ROMAN_SUFFIXES.has(value.toLowerCase()) ? 0.5 : 0;
  const tier = clampTier(Math.round(4 + romanBoost));
  return {
    tier,
    confidence: "medium",
    notes: [ROMAN_SUFFIXES.has(value.toLowerCase()) ? "roman numeral suffix" : "generational suffix"],
    found: true
  };
}

function toLabel(score: number): NameLabel {
  if (score >= 81) return "extreme";
  if (score >= 61) return "very rare";
  if (score >= 41) return "rare";
  if (score >= 21) return "uncommon";
  return "common";
}

function capLabel(label: NameLabel, maxLabel: NameLabel): NameLabel {
  const order: NameLabel[] = ["common", "uncommon", "rare", "very rare", "extreme"];
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
    "Results are US-biased. No fake precision or global certainty.",
    ...notes
  ]
    .filter(Boolean)
    .join(" ");
}

function hasNonLatinScript(value: string): boolean {
  for (const char of value) {
    if (!/\p{L}/u.test(char)) continue;
    if (!/\p{Script=Latin}/u.test(char)) {
      return true;
    }
  }
  return false;
}

function hasDiacritics(value: string): boolean {
  const normalized = value.normalize("NFD");
  return /[\u0300-\u036f]/.test(normalized);
}

export function scoreJunk(input: string): JunkScore {
  const normalized = normalizeInput(input);
  const tokens = normalized.tokens;
  const reasons: string[] = [];
  let score = 0;
  let hardBlock = false;

  if (normalized.disallowedChars.length > 0) {
    hardBlock = true;
    reasons.push("contains unsupported characters");
  }

  if (/\d/.test(input)) {
    hardBlock = true;
    reasons.push("digits are not allowed in names");
  }

  if (tokens.length >= 9) {
    hardBlock = true;
    reasons.push("too many tokens");
  }

  if (tokens.some((token) => token.length > 30)) {
    hardBlock = true;
    reasons.push("a token is longer than 30 characters");
  }

  if (tokens.some((token) => (token.match(/-/g) ?? []).length >= 3)) {
    hardBlock = true;
    reasons.push("a token contains too many hyphens");
  }

  for (const token of tokens) {
    if (/(.)\1{5,}/.test(token)) {
      score += 65;
      reasons.push("excessive repeated characters");
      break;
    }
  }

  for (const token of tokens) {
    if (token.length >= 7 && !/[aeiou]/.test(token)) {
      const hasCluster = rareClusters.some((cluster) => token.includes(cluster));
      if (hasCluster) {
        score += 20;
        reasons.push("unusual consonant clusters with no vowels");
        break;
      }
    }
  }

  for (const token of tokens) {
    const lower = token.toLowerCase();
    const sequences = keyboardSequences
      .concat(keyboardSequences.map((sequence) => sequence.split("").reverse().join("")));
    const hasRun = sequences.some((sequence) => {
      for (let i = 0; i <= sequence.length - 8; i += 1) {
        if (lower.includes(sequence.slice(i, i + 8))) {
          return true;
        }
      }
      return false;
    });
    if (hasRun) {
      score += 25;
      reasons.push("keyboard pattern run");
      break;
    }
  }

  for (const token of tokens) {
    let rareCount = 0;
    for (let i = 0; i < token.length - 1; i += 1) {
      const pair = token.slice(i, i + 2).toLowerCase();
      if (rareBigrams.has(pair)) {
        rareCount += 1;
      }
    }
    if (rareCount >= 2) {
      score += 15;
      reasons.push("excessive rare letter pairs");
      break;
    }
  }

  for (const token of tokens) {
    const punctuationCount = (token.match(/['-]/g) ?? []).length;
    if (token.length >= 5 && punctuationCount / token.length >= 0.3) {
      score += 10;
      reasons.push("punctuation density is high");
      break;
    }
  }

  if (hardBlock) {
    score = Math.max(score, 90);
  } else if (score >= 85) {
    score = 84;
  }

  let verdict: JunkScore["verdict"] = "ok";
  if (score >= 85 && hardBlock) {
    verdict = "block";
  } else if (score >= 60) {
    verdict = "warn";
  }

  return { verdict, score: Math.min(100, score), reasons };
}

function getEstimateDetail(options: {
  firstCount?: number;
  lastCount?: number;
  hasCaps: boolean;
  allowEstimate: boolean;
}): string {
  if (!options.allowEstimate || options.hasCaps) {
    return "We don’t have enough data to estimate this reliably.";
  }
  if (!options.firstCount || !options.lastCount) {
    return "We don’t have enough data to estimate this reliably.";
  }
  if (SSA_TABLE.totalCount === 0 || CENSUS_TABLE.totalCount === 0) {
    return "We don’t have enough data to estimate this reliably.";
  }
  const firstRate = SSA_TABLE.totalCount / options.firstCount;
  const lastRate = CENSUS_TABLE.totalCount / options.lastCount;
  const combined = firstRate * lastRate;
  const magnitude = Math.pow(10, Math.round(Math.log10(combined)));
  const rounded = magnitude.toLocaleString("en-US");
  return `On the order of 1 in ~${rounded} (based on US datasets).`;
}

export function scoreName(input: string): NameScore {
  const parts = parseName(input);
  const normalized = normalizeInput(input);
  const tokens = normalized.tokens;
  const hasLast = Boolean(parts.last);
  const isSingleToken = tokens.length === 1;

  const junkScore = scoreJunk(input);

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
      notes: [specialFirst.note, ...firstScore.notes].filter(Boolean),
      found: Boolean(specialFirst.tier) || firstScore.found
    },
    {
      label: "Middle",
      value: parts.middle,
      tier: middleTier,
      tierLabel: partTierLabel(middleTier),
      confidence: specialMiddle.confidence ?? middleScore.confidence,
      notes: [specialMiddle.note, ...middleScore.notes].filter(Boolean),
      found: Boolean(specialMiddle.tier) || middleScore.found
    },
    {
      label: "Last",
      value: parts.last,
      tier: lastTier,
      tierLabel: partTierLabel(lastTier),
      confidence: specialLast.confidence ?? lastScore.confidence,
      notes: [specialLast.note, ...lastScore.notes].filter(Boolean),
      found: Boolean(specialLast.tier) || lastScore.found
    },
    {
      label: "Suffix",
      value: parts.suffix,
      tier: suffixTier,
      tierLabel: partTierLabel(suffixTier),
      confidence: suffixScore.confidence,
      notes: suffixScore.notes,
      found: suffixScore.found
    }
  ];

  const datasetChecks: DatasetCheck[] = [];
  const scriptUnsupported = parts.raw ? hasNonLatinScript(parts.raw) : false;
  if (!scriptUnsupported) {
    if (parts.first) {
      datasetChecks.push({
        id: DATASET_INFO.ssa.id,
        name: DATASET_INFO.ssa.name,
        scope: "first",
        matched: partScores[0].found,
        note: hasDiacritics(parts.first) ? "diacritics present" : undefined
      });
    }
    if (parts.middle) {
      datasetChecks.push({
        id: DATASET_INFO.ssa.id,
        name: DATASET_INFO.ssa.name,
        scope: "middle",
        matched: partScores[1].found,
        note: hasDiacritics(parts.middle) ? "diacritics present" : undefined
      });
    }
    if (parts.last) {
      datasetChecks.push({
        id: DATASET_INFO.census.id,
        name: DATASET_INFO.census.name,
        scope: "last",
        matched: partScores[2].found,
        note: hasDiacritics(parts.last) ? "diacritics present" : undefined
      });
    }
  }

  const activeTiers = [
    parts.first ? firstTier : undefined,
    parts.middle ? middleTier : undefined,
    parts.last ? lastTier : undefined,
    parts.suffix ? suffixTier : undefined
  ].filter((tier): tier is number => typeof tier === "number");

  const base = 1.7;
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
  const capsApplied: string[] = [];

  if (isSingleToken) {
    overallScore = Math.min(overallScore, 45);
    overallTier = Math.min(overallTier, 5);
    confidence = "low";
    capNotes.push("Single-token inputs are capped to avoid false precision.");
    capsApplied.push("Single-token cap (≤45)");
  }

  if (!hasLast) {
    overallScore = Math.min(overallScore, 60);
    overallTier = Math.min(overallTier, 6);
    if (confidence !== "low") confidence = "medium";
    capNotes.push("Missing last names cap the score to prevent overstating rarity.");
    capsApplied.push("Missing-last-name cap (≤60)");
  }

  const allowExtreme =
    hasLast && (lastTier >= 9 || Boolean(specialLast.tier) || Boolean(specialFull.tier));
  if (!allowExtreme && overallScore >= 81) {
    overallScore = 80;
    overallTier = Math.min(overallTier, 8);
    capNotes.push("Extreme labels require a top-tier last name or special-case match.");
    capsApplied.push("Extreme-label cap");
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

  if (junkScore.verdict === "warn") {
    confidence = confidence === "high" ? "medium" : "low";
  }

  const reasons: ReasonCode[] = [];
  if (junkScore.verdict === "warn") reasons.push("SPAM_WARN");
  if (junkScore.verdict === "block") reasons.push("SPAM_BLOCK");
  if (isSingleToken) reasons.push("SINGLE_TOKEN");
  if (!hasLast) reasons.push("NO_LAST_NAME");
  if (lastScore.composed) reasons.push("HYPHEN_COMPOSED");
  if (hasSpecialCase) reasons.push("SPECIAL_CASE_OVERRIDE");
  if (capsApplied.length > 0) reasons.push("COMPLETENESS_CAP");

  const missingDataset =
    (parts.first && SSA_TABLE.totalNames === 0 && !specialFirst.tier) ||
    (parts.middle && SSA_TABLE.totalNames === 0 && !specialMiddle.tier) ||
    (parts.last && CENSUS_TABLE.totalNames === 0 && !specialLast.tier);

  if (missingDataset) {
    reasons.push("DATASET_UNAVAILABLE");
  }

  const unsupportedScript = scriptUnsupported && Boolean(parts.raw);
  if (unsupportedScript) {
    reasons.push("SCRIPT_NOT_SUPPORTED");
  }

  const hasDatasetCoverage =
    hasSpecialCase ||
    specialFull.tier ||
    partScores.some((score) => score.found) ||
    (hasFirstFound && hasLastFound);
  if (!hasDatasetCoverage) {
    reasons.push("NOT_FOUND_IN_DATASETS");
  }

  const confidenceNotes: string[] = [];
  if (!hasLast) confidenceNotes.push("Missing last name lowers confidence.");
  if (unknownParts > 0) confidenceNotes.push("One or more parts are not found in datasets.");
  if (junkScore.verdict === "warn") confidenceNotes.push("Input flagged as likely junk, so confidence was reduced.");
  if (hasFirstFound && hasLastFound) confidenceNotes.push("First and last names found in datasets.");
  if (unsupportedScript) confidenceNotes.push("Script is outside current dataset coverage.");

  let status: ScoreStatus = "scored";
  if (junkScore.verdict === "block") {
    status = "blocked";
  } else if (unsupportedScript || missingDataset || !hasDatasetCoverage) {
    status = "unknown";
  }

  const allowEstimate =
    status === "scored" &&
    hasFirstFound &&
    hasLastFound &&
    confidence === "high" &&
    capsApplied.length === 0 &&
    junkScore.verdict === "ok";

  const estimateDetail = getEstimateDetail({
    firstCount: firstScore.count,
    lastCount: lastScore.count,
    hasCaps: capsApplied.length > 0,
    allowEstimate
  });

  const overallScoreValue = status === "scored" ? overallScore : null;
  const overallTierValue = status === "scored" ? overallTier : null;
  const labelValue: NameLabel = status === "blocked" ? "blocked" : status === "unknown" ? "unknown" : label;

  if (status === "unknown") {
    confidence = "low";
  }

  return {
    status,
    parts,
    partScores,
    overallTier: overallTierValue,
    overallScore: overallScoreValue,
    label: labelValue,
    confidence,
    estimateNote: buildEstimateNote([specialFull.note, ...capNotes].filter(Boolean)),
    estimateDetail,
    datasetsChecked: datasetChecks,
    reasonCodes: Array.from(new Set(reasons)),
    junkScore,
    capsApplied,
    confidenceNotes,
    scoringVersion: SCORING_MODEL_VERSION,
    datasetsUpdatedAt: {
      ssa: SSA_TABLE.generatedAt,
      census: CENSUS_TABLE.generatedAt
    }
  };
}
