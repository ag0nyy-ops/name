import censusSurnames from "../data/generated/census_surnames.json";
import ssaFirstNames from "../data/generated/ssa_first_names.json";
import specialCases from "../data/specialCases.json";

export type Confidence = "high" | "medium" | "low";
export type NameLabel =
  | "common"
  | "uncommon"
  | "rare"
  | "very rare"
  | "extreme"
  | "unknown";

export type NameParts = {
  raw: string;
  display: string;
  first?: string;
  middle?: string;
  last?: string;
  suffix?: string;
  suffixCandidate?: string;
};

export type MatchStatus = "match" | "partial" | "none";
export type BreakdownEntry = {
  token: string;
  matchStatus: MatchStatus;
  source: "ssa" | "census" | "none";
  rarityTier: NameLabel | "none";
  notes: string[];
};

export type DatasetCheck = {
  id: string;
  name: string;
  scope: "first" | "middle" | "last";
  matched: boolean;
  note?: string;
};

export type PenaltyEntry = {
  id: string;
  points: number;
  detail: string;
};

export type NameScore = {
  parts: NameParts;
  score: number | null;
  label: NameLabel;
  confidence: Confidence;
  confidenceValue: number;
  estimate: string;
  datasetsChecked: DatasetCheck[];
  reasons: string[];
  flags: string[];
  penaltiesApplied: PenaltyEntry[];
  capsApplied: string[];
  confidenceNotes: string[];
  breakdown: BreakdownEntry[];
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

export const SCORING_MODEL_VERSION = "v2.0";

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

const ROMAN_SUFFIXES = new Map<string, number>([
  ["i", 1],
  ["ii", 2],
  ["iii", 3],
  ["iv", 4],
  ["v", 5],
  ["vi", 6],
  ["vii", 7],
  ["viii", 8],
  ["ix", 9],
  ["x", 10]
]);

const disallowedCharsRegex = /[^\p{L}\s'-]/gu;
const keyboardSequences = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

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

function isRomanCandidate(value?: string): boolean {
  if (!value) return false;
  return /^(jr|sr|[ivx]+)$/i.test(value.trim());
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
  let suffixCandidate: string | undefined;
  if (detected) {
    suffix = detected;
    lastIndex -= 1;
  } else if (isRomanCandidate(possibleSuffix)) {
    suffixCandidate = possibleSuffix;
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
    suffix,
    suffixCandidate
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

type LookupResult = {
  percentile: number;
  notes: string[];
  found: boolean;
  count?: number;
};

function lookupFrequency(table: FrequencyTable, value?: string): LookupResult {
  if (!value) {
    return { percentile: 0, notes: ["missing"], found: false };
  }
  const key = normalizeKey(value);
  if (!key) {
    return { percentile: 0, notes: ["missing"], found: false };
  }
  const entry = table.names[key];
  if (table.totalNames === 0 || table.percentileScale === 0) {
    return {
      notes: ["dataset unavailable (build data before deploy)"],
      found: false,
      percentile: 0
    };
  }
  if (!entry) {
    return {
      notes: ["not found in dataset"],
      found: false,
      percentile: 0
    };
  }
  const percentile = entry.percentile / table.percentileScale;
  return {
    notes: ["found in dataset"],
    found: true,
    percentile,
    count: entry.count
  };
}

function tierLabelFromScore(score: number): NameLabel {
  if (score >= 81) return "extreme";
  if (score >= 61) return "very rare";
  if (score >= 41) return "rare";
  if (score >= 21) return "uncommon";
  return "common";
}

function percentileToScore(percentile: number): number {
  return Math.round(Math.min(100, Math.max(0, percentile * 100)));
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

function countVowels(value: string): number {
  return (value.match(/[aeiou]/gi) ?? []).length;
}

function consonantRatio(value: string): number {
  const letters = value.match(/[a-z]/gi) ?? [];
  if (letters.length === 0) return 0;
  const vowels = countVowels(value);
  return (letters.length - vowels) / letters.length;
}

function hasKeyboardMash(value: string): boolean {
  const lower = value.toLowerCase();
  const sequences = keyboardSequences
    .concat(keyboardSequences.map((sequence) => sequence.split("").reverse().join("")));
  return sequences.some((sequence) => {
    for (let i = 0; i <= sequence.length - 6; i += 1) {
      if (lower.includes(sequence.slice(i, i + 6))) {
        return true;
      }
    }
    return false;
  });
}

function isGibberishToken(token: string): boolean {
  if (token.length < 4) return false;
  const vowelCount = countVowels(token);
  if (vowelCount === 0 && token.length >= 6) return true;
  if (token.length >= 6 && consonantRatio(token) >= 0.85) return true;
  if (hasKeyboardMash(token)) return true;
  return false;
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

function getConfidenceMultiplier(value: number): number {
  if (value >= 0.85) return 1;
  if (value >= 0.7) return 0.85;
  if (value >= 0.5) return 0.65;
  if (value >= 0.3) return 0.4;
  return 0.2;
}

function confidenceLabelFromValue(value: number): Confidence {
  if (value >= 0.85) return "high";
  if (value >= 0.5) return "medium";
  return "low";
}

function buildSuffixInfo(value?: string) {
  if (!value) return null;
  if (value === "jr" || value === "sr") {
    return { tier: "common" as const, boost: 1, note: "generational suffix (jr/sr)" };
  }
  const romanValue = ROMAN_SUFFIXES.get(value);
  if (!romanValue) return null;
  if (romanValue <= 3) return { tier: "uncommon" as const, boost: 4, note: "roman numeral suffix (I–III)" };
  if (romanValue <= 6) return { tier: "rare" as const, boost: 7, note: "roman numeral suffix (IV–VI)" };
  return { tier: "very rare" as const, boost: 10, note: "roman numeral suffix (VII–X)" };
}

export function scoreName(input: string): NameScore {
  const parts = parseName(input);
  const normalized = normalizeInput(input);
  const tokens = normalized.tokens;
  const tokensWithoutSuffix = parts.suffix
    ? tokens.slice(0, Math.max(0, tokens.length - 1))
    : tokens;
  const hasFirst = Boolean(parts.first);
  const hasLast = Boolean(parts.last);
  const hasMiddle = Boolean(parts.middle);

  const specialFirst = applySpecialCase("firstExact", parts.first);
  const specialMiddle = applySpecialCase("middleExact", parts.middle);
  const specialLast = applySpecialCase("lastExact", parts.last);
  const specialFull = applySpecialCase("fullExact", parts.raw);
  const hasSpecialCase = Boolean(
    specialFirst.tier || specialMiddle.tier || specialLast.tier || specialFull.tier
  );

  const scriptUnsupported = parts.raw ? hasNonLatinScript(parts.raw) : false;
  const datasetChecks: DatasetCheck[] = [];

  const middleTokens = parts.middle ? parts.middle.split(" ").filter(Boolean) : [];
  const firstLookup = lookupFrequency(SSA_TABLE, parts.first);
  const middleLookups = middleTokens.map((token) => lookupFrequency(SSA_TABLE, token));
  const lastToken = parts.last;
  const lastHasHyphen = Boolean(lastToken && lastToken.includes("-"));
  const lastParts = lastHasHyphen ? (lastToken ?? "").split("-").filter(Boolean) : [];
  const lastExact = lastToken ? lookupFrequency(CENSUS_TABLE, lastToken) : { found: false, notes: ["missing"], percentile: 0 };
  const lastPartLookups = lastParts.map((part) => lookupFrequency(CENSUS_TABLE, part));

  const firstMatched = Boolean(specialFirst.tier) || firstLookup.found;
  const middleMatchedCount = middleLookups.filter((lookup) => lookup.found).length;
  const middleMatched = Boolean(specialMiddle.tier) || middleMatchedCount === middleLookups.length && middleLookups.length > 0;
  const lastMatched =
    Boolean(specialLast.tier) ||
    (!lastHasHyphen && lastExact.found) ||
    (lastHasHyphen && lastPartLookups.length > 0 && lastPartLookups.every((lookup) => lookup.found));
  const lastPartial =
    lastHasHyphen &&
    !lastMatched &&
    lastPartLookups.some((lookup) => lookup.found);

  if (!scriptUnsupported) {
    if (parts.first) {
      datasetChecks.push({
        id: DATASET_INFO.ssa.id,
        name: DATASET_INFO.ssa.name,
        scope: "first",
        matched: firstMatched,
        note: hasDiacritics(parts.first) ? "diacritics present" : undefined
      });
    }
    if (parts.middle) {
      datasetChecks.push({
        id: DATASET_INFO.ssa.id,
        name: DATASET_INFO.ssa.name,
        scope: "middle",
        matched: middleMatched,
        note: hasDiacritics(parts.middle) ? "diacritics present" : undefined
      });
    }
    if (parts.last) {
      datasetChecks.push({
        id: DATASET_INFO.census.id,
        name: DATASET_INFO.census.name,
        scope: "last",
        matched: lastMatched || lastPartial,
        note: hasDiacritics(parts.last) ? "diacritics present" : undefined
      });
    }
  }

  const firstScore = specialFirst.tier
    ? Math.round((specialFirst.tier / 10) * 100)
    : firstLookup.found
      ? percentileToScore(firstLookup.percentile)
      : 0;
  const middleScores = middleLookups.filter((lookup) => lookup.found).map((lookup) => percentileToScore(lookup.percentile));
  const middleScore = specialMiddle.tier
    ? Math.round((specialMiddle.tier / 10) * 100)
    : middleScores.length > 0
      ? Math.round(middleScores.reduce((sum, value) => sum + value, 0) / middleScores.length)
      : 0;

  let lastScore = 0;
  const lastNotes: string[] = [];
  if (specialLast.tier) {
    lastScore = Math.round((specialLast.tier / 10) * 100);
    lastNotes.push(specialLast.note ?? "special-case override");
  } else if (lastHasHyphen) {
    const foundParts = lastPartLookups.filter((lookup) => lookup.found);
    if (foundParts.length === lastPartLookups.length && foundParts.length > 0) {
      const average = Math.round(
        foundParts.reduce((sum, lookup) => sum + percentileToScore(lookup.percentile), 0) / foundParts.length
      );
      lastScore = Math.min(100, average + 5);
      lastNotes.push("hyphen parts matched in census (+small boost)");
    } else if (foundParts.length === 1) {
      lastScore = percentileToScore(foundParts[0].percentile);
      lastNotes.push("partial hyphen match (no boost)");
    } else {
      lastScore = 0;
      lastNotes.push("hyphen surname not found");
    }
  } else if (lastExact.found) {
    lastScore = percentileToScore(lastExact.percentile);
    lastNotes.push(...lastExact.notes);
  }

  const weights = {
    first: 0.3,
    middle: 0.2,
    last: 0.5
  };
  const flags: string[] = [];
  const penaltiesApplied: PenaltyEntry[] = [];
  const reasons: string[] = [];
  const capsApplied: string[] = [];
  const confidenceNotes: string[] = [];

  const weightedScores: Array<{ score: number; weight: number }> = [];
  if (firstScore > 0) weightedScores.push({ score: firstScore, weight: weights.first });
  if (middleScore > 0) weightedScores.push({ score: middleScore, weight: weights.middle });
  if (lastScore > 0) weightedScores.push({ score: lastScore, weight: weights.last });
  const weightSum = weightedScores.reduce((sum, entry) => sum + entry.weight, 0);
  let baseScore = weightSum
    ? Math.round(weightedScores.reduce((sum, entry) => sum + entry.score * entry.weight, 0) / weightSum)
    : 0;
  if (specialFull.tier) {
    const fullScore = Math.round((specialFull.tier / 10) * 100);
    baseScore = Math.max(baseScore, fullScore);
    reasons.push("Special-case full name override applied.");
  }

  const suffixInfo = buildSuffixInfo(parts.suffix ?? undefined);
  const hasValidSuffix = Boolean(parts.suffix && suffixInfo);
  const suffixAllowed = hasValidSuffix && hasFirst && hasLast && (firstMatched || lastMatched || lastPartial);
  const suffixBoost = suffixAllowed && suffixInfo ? suffixInfo.boost : 0;

  const totalTokens = tokensWithoutSuffix.length;
  const matchedTokens = [
    firstMatched ? 1 : 0,
    ...middleLookups.map((lookup) => (lookup.found ? 1 : 0)),
    ...(lastHasHyphen ? lastPartLookups.map((lookup) => (lookup.found ? 1 : 0)) : [lastExact.found ? 1 : 0])
  ].reduce((sum, value) => sum + value, 0);
  const matchedTokenSet = new Set<string>();
  if (parts.first && firstMatched) matchedTokenSet.add(parts.first);
  middleLookups.forEach((lookup, index) => {
    if (lookup.found) matchedTokenSet.add(middleTokens[index]);
  });
  if (lastHasHyphen) {
    lastPartLookups.forEach((lookup, index) => {
      if (lookup.found) matchedTokenSet.add(lastParts[index]);
    });
  } else if (parts.last && lastExact.found) {
    matchedTokenSet.add(parts.last);
  }
  const tokenCoverage = totalTokens > 0 ? matchedTokens / totalTokens : 0;
  const weightTotal = (hasFirst ? weights.first : 0) + (hasMiddle ? weights.middle : 0) + (hasLast ? weights.last : 0);
  const weightedCoverage =
    weightTotal > 0
      ? ((firstMatched ? weights.first : 0) + (middleMatched ? weights.middle : 0) + (lastMatched ? weights.last : 0)) /
        weightTotal
      : 0;
  let confidenceValue = 0.15 + 0.5 * weightedCoverage + 0.35 * tokenCoverage;
  if (!hasFirst) confidenceValue *= 0.55;
  if (!hasLast) confidenceValue *= 0.55;
  const unknownTokens = totalTokens - matchedTokens;
  if (unknownTokens > 0) {
    const unknownRatio = unknownTokens / Math.max(1, totalTokens);
    confidenceValue *= 1 - Math.min(0.35, unknownRatio * 0.4);
  }
  if (lastHasHyphen && lastMatched) {
    confidenceValue = Math.min(1, confidenceValue + 0.05);
  }
  confidenceValue = Math.min(1, Math.max(0, confidenceValue));

  const tokensToCheck = tokensWithoutSuffix;
  if (normalized.disallowedChars.length > 0) {
    flags.push("unsupported_characters");
    penaltiesApplied.push({
      id: "unsupported_characters",
      points: 25,
      detail: "Unsupported characters detected in input."
    });
  }
  if (/\d/.test(input)) {
    flags.push("digits_present");
    penaltiesApplied.push({
      id: "digits_present",
      points: 25,
      detail: "Digits are not expected in real names."
    });
  }
  const gibberishTokens = tokensToCheck.filter((token) => isGibberishToken(token));
  if (gibberishTokens.length > 0) {
    flags.push("gibberish_token");
    const penalty = Math.min(70, gibberishTokens.length * 35);
    penaltiesApplied.push({
      id: "gibberish_token",
      points: penalty,
      detail: `Gibberish patterns detected (${gibberishTokens.join(", ")}).`
    });
  }

  const tokenCounts = tokensToCheck.reduce<Record<string, number>>((acc, token) => {
    acc[token] = (acc[token] ?? 0) + 1;
    return acc;
  }, {});
  const maxCount = Math.max(0, ...Object.values(tokenCounts));
  const repeatedAcrossFields =
    Boolean(parts.first && parts.last && parts.first === parts.last) ||
    (parts.first && middleTokens.includes(parts.first)) ||
    (parts.last && middleTokens.includes(parts.last));
  if (maxCount > 2 || repeatedAcrossFields) {
    flags.push("repetition_abuse");
    const penalty = maxCount >= 4 ? 40 : maxCount >= 3 ? 30 : 20;
    penaltiesApplied.push({
      id: "repetition_abuse",
      points: penalty,
      detail: "Repeated tokens detected across fields."
    });
  }

  const hyphenTriggers: string[] = [];
  if (tokensToCheck.some((token) => (token.match(/-/g) ?? []).length > 1)) {
    hyphenTriggers.push("multiple_hyphens_in_token");
  }
  if (lastHasHyphen && !lastMatched) {
    hyphenTriggers.push("hyphen_side_unknown");
  }
  if (lastHasHyphen && lastParts.some((part) => tokensToCheck.slice(0, -1).includes(part))) {
    hyphenTriggers.push("hyphen_repeats_prior_token");
  }
  if (hyphenTriggers.length > 0) {
    flags.push("hyphen_abuse");
    const penalty = hyphenTriggers.length > 1 ? 30 : 15;
    penaltiesApplied.push({
      id: "hyphen_abuse",
      points: penalty,
      detail: `Hyphen patterns flagged (${hyphenTriggers.join(", ")}).`
    });
  }
  if (lastPartial) {
    flags.push("partial_hyphen_match");
  }

  if (tokensToCheck.length >= 5 && tokenCoverage < 0.6) {
    flags.push("too_many_tokens");
    penaltiesApplied.push({
      id: "too_many_tokens",
      points: 15,
      detail: "Five or more tokens with weak dataset coverage."
    });
  }

  const longTokens = tokensToCheck.filter((token) => token.length > 18 && !matchedTokenSet.has(token));
  if (longTokens.length > 0) {
    flags.push("suspicious_length");
    penaltiesApplied.push({
      id: "suspicious_length",
      points: 15,
      detail: `Unusually long tokens (${longTokens.join(", ")}).`
    });
  }

  const hasDatasetCoverage =
    hasSpecialCase ||
    specialFull.tier ||
    firstMatched ||
    middleMatchedCount > 0 ||
    lastMatched ||
    lastPartial;
  if (scriptUnsupported) {
    flags.push("script_not_supported");
    reasons.push("Script is outside dataset coverage.");
  }
  if (!hasDatasetCoverage) {
    flags.push("all_unknown");
    reasons.push("No dataset matches found, so we cannot score this name.");
  }
  if (hasSpecialCase) {
    reasons.push("Special-case dataset override applied.");
  }

  if (!hasFirst) {
    confidenceNotes.push("Missing first name lowers confidence.");
  }
  if (!hasLast) {
    confidenceNotes.push("Missing last name lowers confidence.");
  }
  if (unknownTokens > 0) {
    confidenceNotes.push("Unknown tokens reduce confidence.");
  }
  if (lastPartial) {
    confidenceNotes.push("Hyphenated surname has a partial census match.");
  }
  if (scriptUnsupported) {
    confidenceNotes.push("Script is outside dataset coverage.");
  }
  if (suffixInfo && !suffixAllowed) {
    flags.push("unsupported_suffix_context");
    reasons.push("Suffix ignored because first/last context was missing or unmatched.");
  }
  if (parts.suffixCandidate && !parts.suffix) {
    flags.push("invalid_suffix");
    reasons.push("Invalid suffix format detected (no boost applied).");
  }

  if (flags.includes("repetition_abuse")) {
    confidenceValue *= 0.6;
    confidenceNotes.push("Repetition patterns reduce confidence.");
  }
  if (flags.includes("gibberish_token")) {
    confidenceValue *= 0.7;
    confidenceNotes.push("Gibberish patterns reduce confidence.");
  }
  if (flags.includes("hyphen_abuse") || flags.includes("too_many_tokens") || flags.includes("suspicious_length")) {
    confidenceValue *= 0.85;
  }
  if (flags.includes("unsupported_characters") || flags.includes("digits_present")) {
    confidenceValue *= 0.7;
    confidenceNotes.push("Unsupported characters reduce confidence.");
  }
  confidenceValue = Math.min(1, Math.max(0, confidenceValue));

  const confidenceMultiplier = getConfidenceMultiplier(confidenceValue);
  const penaltyPoints = penaltiesApplied.reduce((sum, entry) => sum + entry.points, 0);
  let finalScore = Math.round(baseScore * confidenceMultiplier + suffixBoost - penaltyPoints);
  finalScore = Math.min(100, Math.max(0, finalScore));

  if (confidenceValue < 0.35) {
    finalScore = Math.min(finalScore, 45);
    capsApplied.push("Confidence < 0.35 caps score at 45.");
    reasons.push("Confidence is too low for high rarity labels.");
  }

  const allowExtreme =
    confidenceValue >= 0.85 &&
    (lastScore >= 90 || Boolean(specialLast.tier) || Boolean(specialFull.tier));
  if (finalScore >= 90 && !allowExtreme) {
    finalScore = 89;
    capsApplied.push("Extreme scores require top-tier last name and high confidence.");
    reasons.push("Extreme label blocked without top-tier last name or high confidence.");
  }

  let label: NameLabel = finalScore === null ? "unknown" : tierLabelFromScore(finalScore);
  if (confidenceValue < 0.35 && label !== "unknown") {
    if (label === "extreme" || label === "very rare" || label === "rare") {
      label = "uncommon";
      reasons.push("Label capped to uncommon due to low confidence.");
    }
  }

  if (!hasDatasetCoverage || scriptUnsupported) {
    label = "unknown";
    finalScore = null;
  }

  const confidence = confidenceLabelFromValue(confidenceValue);
  const estimate = getEstimateDetail({
    firstCount: firstLookup.count,
    lastCount: lastExact.count,
    hasCaps: capsApplied.length > 0,
    allowEstimate: confidence !== "low" && Boolean(finalScore)
  });

  const breakdown: BreakdownEntry[] = [];
  breakdown.push({
    token: parts.first ?? "—",
    matchStatus: parts.first ? (firstMatched ? "match" : "none") : "none",
    source: "ssa",
    rarityTier: parts.first && firstMatched ? tierLabelFromScore(firstScore) : "none",
    notes: parts.first ? [specialFirst.note, ...firstLookup.notes].filter(Boolean) : ["missing first name"]
  });
  const middleMatches = middleMatchedCount;
  breakdown.push({
    token: parts.middle ?? "—",
    matchStatus: parts.middle
      ? middleMatches === 0
        ? "none"
        : middleMatches === middleTokens.length
          ? "match"
          : "partial"
      : "none",
    source: "ssa",
    rarityTier: parts.middle && middleMatches ? tierLabelFromScore(middleScore) : "none",
    notes: parts.middle
      ? [
          middleTokens.length > 1 ? "multiple middle tokens" : "single middle token",
          `${middleMatches}/${middleTokens.length} middle tokens matched`
        ]
      : ["no middle name provided"]
  });
  breakdown.push({
    token: parts.last ?? "—",
    matchStatus: parts.last ? (lastMatched ? "match" : lastPartial ? "partial" : "none") : "none",
    source: "census",
    rarityTier: parts.last && (lastMatched || lastPartial) ? tierLabelFromScore(lastScore) : "none",
    notes: parts.last ? (lastNotes.length > 0 ? lastNotes : lastExact.notes) : ["missing last name"]
  });
  breakdown.push({
    token: parts.suffix ?? parts.suffixCandidate ?? "—",
    matchStatus: parts.suffix || parts.suffixCandidate ? (suffixAllowed ? "match" : "none") : "none",
    source: "none",
    rarityTier: suffixAllowed && suffixInfo ? suffixInfo.tier : "none",
    notes:
      parts.suffix || parts.suffixCandidate
        ? suffixInfo
          ? [suffixInfo.note]
          : ["suffix not applied"]
        : ["no suffix provided"]
  });

  return {
    parts,
    score: finalScore,
    label,
    confidence,
    confidenceValue: Number(confidenceValue.toFixed(2)),
    estimate,
    datasetsChecked: datasetChecks,
    reasons: Array.from(new Set(reasons)),
    flags: Array.from(new Set(flags)),
    penaltiesApplied,
    capsApplied,
    confidenceNotes,
    breakdown,
    scoringVersion: SCORING_MODEL_VERSION,
    datasetsUpdatedAt: {
      ssa: SSA_TABLE.generatedAt,
      census: CENSUS_TABLE.generatedAt
    }
  };
}
