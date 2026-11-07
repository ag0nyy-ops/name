import censusSurnames from "../../data/generated/census_surnames.json";
import ssaFirstNames from "../../data/generated/ssa_first_names.json";
import specialCases from "../../data/specialCases.json";
import {
  buildPhoneticIndex,
  findPhoneticMatch,
  stripDiacritics,
  type PhoneticIndex,
  type PhoneticMatch
} from "./phonetic";

export type ConfidenceLabel = "high" | "medium" | "low";
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

export type MatchStatus = "match" | "partial" | "phonetic" | "none";

export type PartResult = {
  raw: string;
  normalized: string;
  role: "first" | "middle" | "last" | "suffix";
  match: MatchStatus;
  source: "ssa" | "census" | "special" | "none";
  count?: number;
  percentile?: number;
  rarityTier: "common" | "uncommon" | "rare" | "very rare" | "extreme" | "unknown";
  notes: string[];
  flags: string[];
  phoneticBase?: {
    code: string;
    name: string;
    similarity: number;
    distance: number;
    threshold: number;
    gateSummary: string;
  };
  spellingVariant?: {
    type: "exact" | "diacritics" | "phonetic" | "none";
    boost: number;
    note?: string;
  };
};

export type EngineDebug = {
  baseScore: number;
  multiplier: number;
  penalties: number;
  tokenCoverage: number;
  completeness: number;
  junkSignals: string[];
  structureSignals: string[];
};

export type EngineScoreResult = {
  score: number | null;
  label: NameLabel;
  confidenceValue: number;
  confidenceLabel: ConfidenceLabel;
  estimatedGlobalCount?: number;
  estimatedUSCount?: number;
  reasons: string[];
  flags: string[];
  parts: {
    first?: PartResult;
    middle?: PartResult;
    last?: PartResult;
    suffix?: PartResult;
  };
  penaltiesApplied: PenaltyEntry[];
  capsApplied: string[];
  confidenceNotes: string[];
  debug: EngineDebug;
};

export type DatasetCheck = {
  id: string;
  name: string;
  scope: "first" | "middle" | "last";
  matchStatus: MatchStatus;
  note?: string;
};

export type PenaltyEntry = {
  id: string;
  points: number;
  detail: string;
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

type PhoneticBase = PhoneticMatch;

type PhoneticLookupResult = LookupResult & {
  matchType: "exact" | "diacritics" | "phonetic" | "none";
  phoneticBase?: PhoneticBase;
};

export const SCORING_MODEL_VERSION = "v3.2";

const SSA_TABLE = ssaFirstNames as FrequencyTable;
const CENSUS_TABLE = censusSurnames as FrequencyTable;

const SSA_PHONETIC_INDEX = buildPhoneticIndex(SSA_TABLE);
const CENSUS_PHONETIC_INDEX = buildPhoneticIndex(CENSUS_TABLE);

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
const fancyHyphenRegex = /[‐‑‒–—―]/g;
const keyboardSequences = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const PHONETIC_MATCH_CONFIDENCE_PENALTY = 0.06;
const PHONETIC_SIMILARITY_REPORT_DIGITS = 2;

const confidencePenaltyByFlag: Record<string, number> = {
  repetition_abuse: 0.2,
  gibberish_token: 0.25,
  hyphen_abuse: 0.15,
  hyphen_in_given_name: 0.12,
  suspicious_length: 0.1,
  unsupported_characters: 0.2,
  digits_present: 0.2
};

const RARITY_GAMMA = 1;

const rarityWeights = {
  last: 0.55,
  first: 0.3,
  middle: 0.05
};

const coverageWeights = {
  last: 0.45,
  first: 0.3,
  middle: 0.15,
  suffix: 0.1
};

type ParsedInput = {
  raw: string;
  rawTokens: string[];
};

type NormalizedInput = ParsedInput & {
  trimmed: string;
  display: string;
  normalized: string;
  tokens: string[];
  tokensNoDiacritics: string[];
  disallowedChars: string[];
};

type ValidatedInput = NormalizedInput & {
  tokensWithoutSuffix: string[];
  tokensWithoutSuffixNoDiacritics: string[];
  parts: NameParts;
};

type LookupResult = {
  found: boolean;
  match: MatchStatus;
  percentile: number;
  notes: string[];
  count?: number;
};

function parseInput(input: string): ParsedInput {
  const raw = input ?? "";
  const rawTokens = raw.trim() ? raw.trim().split(/\s+/) : [];
  return { raw, rawTokens };
}


function normalizeInput(parsed: ParsedInput): NormalizedInput {
  const nfc = parsed.raw.normalize("NFC");
  const hyphenNormalized = nfc.replace(fancyHyphenRegex, "-");
  const trimmed = hyphenNormalized.replace(/\s+/g, " ").trim();
  const disallowedMatches = trimmed.match(disallowedCharsRegex) ?? [];
  const disallowedChars = Array.from(new Set(disallowedMatches));
  const display = trimmed.replace(disallowedCharsRegex, "").replace(/\s+/g, " ").trim();
  const normalized = display.toLowerCase();
  const tokens = normalized ? normalized.split(" ").filter(Boolean) : [];
  const tokensNoDiacritics = tokens.map(stripDiacritics);
  return {
    ...parsed,
    trimmed,
    display,
    normalized,
    tokens,
    tokensNoDiacritics,
    disallowedChars
  };
}

function isRomanLike(value?: string): boolean {
  if (!value) return false;
  return /^[ivx]+$/i.test(value);
}

export function detectSuffix(token?: string): string | undefined {
  if (!token) return undefined;
  const normalized = token.toLowerCase();
  if (normalized === "jr" || normalized === "sr") return normalized;
  if (ROMAN_SUFFIXES.has(normalized)) return normalized;
  return undefined;
}

function validateInput(normalized: NormalizedInput): ValidatedInput {
  const tokens = [...normalized.tokens];
  const tokensNoDiacritics = [...normalized.tokensNoDiacritics];
  let suffix: string | undefined;
  let suffixCandidate: string | undefined;

  if (tokens.length > 0) {
    const lastToken = tokens[tokens.length - 1];
    const hasSuffixContext = tokens.length >= 3;
    const detected = detectSuffix(lastToken);
    if (detected && hasSuffixContext) {
      suffix = detected;
      tokens.pop();
      tokensNoDiacritics.pop();
    } else if (!detected && isRomanLike(lastToken) && hasSuffixContext) {
      suffixCandidate = lastToken;
      tokens.pop();
      tokensNoDiacritics.pop();
    }
  }

  const first = tokens[0];
  const lastIndex = tokens.length - 1;
  const last = lastIndex >= 1 ? tokens[lastIndex] : undefined;
  const middleTokens = lastIndex >= 2 ? tokens.slice(1, lastIndex) : [];
  const middle = middleTokens.length ? middleTokens.join(" ") : undefined;

  return {
    ...normalized,
    tokensWithoutSuffix: tokens,
    tokensWithoutSuffixNoDiacritics: tokensNoDiacritics,
    parts: {
      raw: normalized.normalized,
      display: normalized.display || normalized.normalized,
      first: first || undefined,
      middle,
      last: last || undefined,
      suffix,
      suffixCandidate
    }
  };
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

function lookupFrequency(table: FrequencyTable, value?: string, valueNoDiacritics?: string): LookupResult {
  if (!value) {
    return { percentile: 0, notes: ["missing"], found: false, match: "none" };
  }
  if (table.totalNames === 0 || table.percentileScale === 0) {
    return {
      notes: ["dataset unavailable (build data before deploy)"],
      found: false,
      match: "none",
      percentile: 0
    };
  }
  const entry = table.names[value];
  if (entry) {
    return {
      notes: ["found in dataset"],
      found: true,
      match: "match",
      percentile: entry.percentile / table.percentileScale,
      count: entry.count
    };
  }
  if (valueNoDiacritics && valueNoDiacritics !== value) {
    const fallback = table.names[valueNoDiacritics];
    if (fallback) {
      return {
        notes: ["diacritics-normalized match"],
        found: true,
        match: "partial",
        percentile: fallback.percentile / table.percentileScale,
        count: fallback.count
      };
    }
  }
  return { notes: ["not found in dataset"], found: false, match: "none", percentile: 0 };
}

function lookupFrequencyWithPhonetic(
  table: FrequencyTable,
  index: PhoneticIndex,
  value?: string,
  valueNoDiacritics?: string
): PhoneticLookupResult {
  const exact = lookupFrequency(table, value, valueNoDiacritics);
  if (exact.found) {
    return {
      ...exact,
      matchType: exact.match === "partial" ? "diacritics" : "exact",
      phoneticBase: undefined
    };
  }
  const phoneticMatch = valueNoDiacritics
    ? findPhoneticMatch(valueNoDiacritics, index)
    : value
      ? findPhoneticMatch(value, index)
      : undefined;
  if (phoneticMatch) {
    const similarityDisplay = phoneticMatch.similarity.toFixed(PHONETIC_SIMILARITY_REPORT_DIGITS);
    return {
      found: true,
      match: "phonetic",
      matchType: "phonetic",
      percentile: phoneticMatch.percentile,
      notes: [
        `phonetic match (double metaphone ${phoneticMatch.code})`,
        `sounds like "${phoneticMatch.name}", but spelling is uncommon`,
        `similarity ${similarityDisplay} · edit distance ${phoneticMatch.distance} (≤${phoneticMatch.threshold} for length ${valueNoDiacritics?.length ?? value?.length ?? 0})`,
        `passed gates: ${phoneticMatch.gateSummary}`
      ],
      count: phoneticMatch.count,
      phoneticBase: phoneticMatch
    };
  }
  return {
    ...exact,
    matchType: "none",
    phoneticBase: undefined
  };
}

function computeSpellingDeviationBoost(options: {
  token: string;
  baseName?: string;
  matchType: "exact" | "diacritics" | "phonetic" | "none";
  phoneticBase?: PhoneticBase;
}): { boost: number; note?: string; variant?: string } {
  if (!options.baseName || options.baseName === options.token) {
    if (options.matchType === "diacritics") {
      return { boost: 1, note: "diacritics-only spelling variation", variant: "diacritics" };
    }
    return { boost: 0, variant: options.matchType };
  }
  if (options.matchType === "phonetic") {
    const similarityBoost = options.phoneticBase?.similarity ? Math.round(options.phoneticBase.similarity * 2) : 0;
    const distanceBoost = options.phoneticBase?.distance === 0 ? 1 : 0;
    const boost = clamp(4 + similarityBoost + distanceBoost, 4, 6);
    return {
      boost,
      note: `sounds like "${options.baseName}", but spelling is uncommon`,
      variant: "phonetic"
    };
  }
  if (options.matchType === "exact") {
    return { boost: 0, variant: "exact" };
  }
  if (options.matchType === "diacritics") {
    return { boost: 1, note: `diacritics variation of "${options.baseName}"`, variant: "diacritics" };
  }
  return { boost: 0, variant: "none" };
}

function describeSpellingBoost(boost: number): { label: string; adjective: string } {
  if (boost >= 5) return { label: "rare", adjective: "rare" };
  if (boost >= 3) return { label: "uncommon", adjective: "uncommon" };
  if (boost >= 1) return { label: "slightly uncommon", adjective: "slightly uncommon" };
  return { label: "standard", adjective: "standard" };
}

function buildSpellingVariantExplanation(options: {
  token: string;
  baseName: string;
  boost: number;
  baseTier: NameLabel;
  phoneticBase?: PhoneticBase;
}): string {
  const descriptor = describeSpellingBoost(options.boost);
  if (options.phoneticBase) {
    const similarity = options.phoneticBase.similarity.toFixed(PHONETIC_SIMILARITY_REPORT_DIGITS);
    return `Sounds like “${options.baseName}”, but spelling is uncommon (${options.token}). Phonetic code ${options.phoneticBase.code} · similarity ${similarity} · edit distance ${options.phoneticBase.distance} (≤${options.phoneticBase.threshold}). Passed gates: ${options.phoneticBase.gateSummary}. The spelling itself is ${descriptor.adjective}, even though the base name is ${options.baseTier}. That makes it a uniquely spelled ${options.baseName}.`;
  }
  return `This name uses a ${descriptor.label} spelling variant (${options.token}) for “${options.baseName}”. The spelling itself is ${descriptor.adjective}, even though the base name is ${options.baseTier}. That makes it a uniquely spelled ${options.baseName}.`;
}

function maxScoreForLabel(label: NameLabel): number {
  if (label === "common") return 19;
  if (label === "uncommon") return 44;
  if (label === "rare") return 69;
  if (label === "very rare") return 89;
  return 100;
}

function toRarityScore(percentile: number): number {
  const normalized = Math.min(1, Math.max(0, percentile));
  const stretched = Math.pow(normalized, RARITY_GAMMA);
  return Math.round(Math.min(100, Math.max(0, stretched * 100)));
}

function labelFromScore(score: number): NameLabel {
  if (score >= 90) return "extreme";
  if (score >= 70) return "very rare";
  if (score >= 45) return "rare";
  if (score >= 20) return "uncommon";
  return "common";
}

function partLabelFromScore(score?: number, matched?: boolean): PartResult["rarityTier"] {
  if (!matched || score === undefined) return "unknown";
  return labelFromScore(score);
}

function getSuffixBoost(value?: string): { boost: number; tier: PartResult["rarityTier"]; note: string } | null {
  if (!value) return null;
  if (value === "jr" || value === "sr") {
    return { boost: 1, tier: "common", note: "common generational suffix (jr/sr, minor modifier)" };
  }
  const romanValue = ROMAN_SUFFIXES.get(value);
  if (!romanValue) return null;
  if (romanValue === 1) return { boost: 1, tier: "common", note: "common roman numeral suffix (I, minor modifier)" };
  if (romanValue <= 3) return { boost: 2, tier: "uncommon", note: "uncommon roman numeral suffix (II–III, minor modifier)" };
  if (romanValue <= 6) return { boost: 3, tier: "rare", note: "rare roman numeral suffix (IV–VI, minor modifier)" };
  return { boost: 4, tier: "very rare", note: "very rare roman numeral suffix (VII–X, minor modifier)" };
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

function hasTripleChar(value: string): boolean {
  return /(.)\1\1/i.test(value);
}

function isGibberishToken(token: string): boolean {
  if (token.length < 4) return false;
  const vowelCount = countVowels(token);
  if (vowelCount === 0 && token.length >= 6) return true;
  if (token.length >= 7 && consonantRatio(token) > 0.75) return true;
  if (token.length >= 5 && hasTripleChar(token)) return true;
  if (hasKeyboardMash(token)) return true;
  return false;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function confidenceLabelFromValue(value: number): ConfidenceLabel {
  if (value >= 0.85) return "high";
  if (value >= 0.5) return "medium";
  return "low";
}

function getConfidenceMultiplier(value: number): number {
  if (value >= 0.85) return 1;
  if (value >= 0.7) return 0.85;
  if (value >= 0.5) return 0.65;
  if (value >= 0.3) return 0.4;
  return 0.2;
}

function applySpecialCase(
  type: keyof typeof specialCases,
  value?: string
): { tier?: number; confidence?: ConfidenceLabel; note?: string } {
  if (!value) return {};
  const entry = specialCases[type][value as keyof (typeof specialCases)[typeof type]] as
    | { tier: number; confidence: ConfidenceLabel; note?: string }
    | undefined;
  if (!entry) return {};
  return entry;
}

function computeTokenCoverage(inputs: {
  first?: PartResult;
  middle?: PartResult;
  last?: PartResult;
  suffix?: PartResult;
}): number {
  const matchScore = (match?: MatchStatus): number => {
    if (!match || match === "none") return 0;
    if (match === "match") return 1;
    if (match === "phonetic") return 0.35;
    return 0.5;
  };
  const entries: Array<{ weight: number; score: number }> = [];
  if (inputs.first) {
    entries.push({
      weight: coverageWeights.first,
      score: matchScore(inputs.first.match)
    });
  }
  if (inputs.middle) {
    entries.push({
      weight: coverageWeights.middle,
      score: matchScore(inputs.middle.match)
    });
  }
  if (inputs.last) {
    entries.push({
      weight: coverageWeights.last,
      score: matchScore(inputs.last.match)
    });
  }
  if (inputs.suffix) {
    entries.push({
      weight: coverageWeights.suffix,
      score: matchScore(inputs.suffix.match)
    });
  }
  const weightSum = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (weightSum === 0) return 0;
  return entries.reduce((sum, entry) => sum + entry.weight * entry.score, 0) / weightSum;
}

const US_POPULATION_ESTIMATE = 335_000_000;

function getEstimateCounts(options: {
  firstCount?: number;
  lastCount?: number;
  allowEstimate: boolean;
}): { estimatedUSCount?: number; estimatedGlobalCount?: number } {
  if (!options.allowEstimate) return {};
  if (!options.firstCount || !options.lastCount) return {};
  if (SSA_TABLE.totalCount === 0 || CENSUS_TABLE.totalCount === 0) return {};
  const rate = (options.firstCount / SSA_TABLE.totalCount) * (options.lastCount / CENSUS_TABLE.totalCount);
  return { estimatedUSCount: rate * US_POPULATION_ESTIMATE };
}

export function parseName(input: string): NameParts {
  const parsed = parseInput(input);
  const normalized = normalizeInput(parsed);
  const validated = validateInput(normalized);
  return validated.parts;
}

export function scoreNameEngine(input: string): EngineScoreResult {
  const parsed = parseInput(input);
  const normalized = normalizeInput(parsed);
  const validated = validateInput(normalized);

  const missingDataReasons: string[] = [];
  const confidenceGateReasons: string[] = [];
  const penaltyReasons: string[] = [];
  const reasons: string[] = [];
  const flags: string[] = [];
  const penaltiesApplied: PenaltyEntry[] = [];
  const capsApplied: string[] = [];
  const confidenceNotes: string[] = [];
  let phoneticConfidenceNote: string | null = null;
  const datasetNotes: string[] = [];

  const scriptUnsupported = validated.normalized ? hasNonLatinScript(validated.normalized) : false;

  if (scriptUnsupported) {
    flags.push("script_not_supported");
    missingDataReasons.push("Script is outside dataset coverage.");
  }

  const specialFirst = applySpecialCase("firstExact", validated.parts.first);
  const specialMiddle = applySpecialCase("middleExact", validated.parts.middle);
  const specialLast = applySpecialCase("lastExact", validated.parts.last);
  const specialFull = applySpecialCase("fullExact", validated.parts.raw);

  const firstLookup = lookupFrequencyWithPhonetic(
    SSA_TABLE,
    SSA_PHONETIC_INDEX,
    validated.parts.first,
    validated.tokensWithoutSuffixNoDiacritics[0]
  );

  const middleTokens = validated.parts.middle ? validated.parts.middle.split(" ").filter(Boolean) : [];
  const middleTokensNoDiacritics = middleTokens.map(stripDiacritics);
  const middleLookups = middleTokens.map((token, index) =>
    lookupFrequencyWithPhonetic(SSA_TABLE, SSA_PHONETIC_INDEX, token, middleTokensNoDiacritics[index])
  );

  const lastToken = validated.parts.last;
  const lastHasHyphen = Boolean(lastToken && lastToken.includes("-"));
  const lastParts = lastHasHyphen ? (lastToken ?? "").split("-").filter(Boolean) : [];
  const lastPartsNoDiacritics = lastParts.map(stripDiacritics);
  const lastCollapsedToken = lastHasHyphen ? lastToken?.replace(/-/g, "") : undefined;
  const lastCollapsedLookup: LookupResult = lastCollapsedToken
    ? lookupFrequency(CENSUS_TABLE, lastCollapsedToken, stripDiacritics(lastCollapsedToken))
    : { found: false, match: "none", percentile: 0, notes: ["missing"], count: undefined };
  const lastExact = lookupFrequencyWithPhonetic(
    CENSUS_TABLE,
    CENSUS_PHONETIC_INDEX,
    lastToken,
    lastToken ? stripDiacritics(lastToken) : undefined
  );
  const lastPartLookups = lastParts.map((part, index) =>
    lookupFrequency(CENSUS_TABLE, part, lastPartsNoDiacritics[index])
  );

  const firstMatchStatus: MatchStatus = specialFirst.tier
    ? "partial"
    : firstLookup.match;
  const middleMatchedCount = middleLookups.filter((lookup) => lookup.found).length;
  const middleHasOnlyPhonetic =
    middleLookups.length > 0 &&
    middleLookups.every((lookup) => lookup.matchType === "phonetic");
  const middleMatchStatus: MatchStatus = specialMiddle.tier
    ? "partial"
    : middleMatchedCount === 0
      ? "none"
      : middleMatchedCount === middleLookups.length
        ? middleHasOnlyPhonetic
          ? "phonetic"
          : "match"
        : "partial";

  let lastMatchStatus: MatchStatus = "none";
  const lastNotes: string[] = [];
  let lastPercentile: number | undefined;
  let lastCount: number | undefined;
  let lastSource: PartResult["source"] = "none";

  if (specialLast.tier) {
    lastMatchStatus = "partial";
    lastSource = "special";
    lastNotes.push(specialLast.note ?? "special-case override");
  } else if (lastHasHyphen) {
    const foundParts = lastPartLookups.filter((lookup) => lookup.found);
    const partPercentile =
      foundParts.length > 0
        ? foundParts.reduce((sum, lookup) => sum + lookup.percentile, 0) / foundParts.length
        : undefined;
    const collapsedPercentile = lastCollapsedLookup.found ? lastCollapsedLookup.percentile : undefined;
    const percentiles = [partPercentile, collapsedPercentile].filter(
      (value): value is number => value !== undefined
    );
    if (percentiles.length > 0) {
      lastPercentile = Math.min(...percentiles);
      lastCount = lastCollapsedLookup.found ? lastCollapsedLookup.count : foundParts[0]?.count;
    }
    if (foundParts.length === lastPartLookups.length && foundParts.length > 0) {
      lastMatchStatus = "match";
      lastSource = "census";
      lastNotes.push("hyphen both parts found");
    } else if (foundParts.length > 0 || lastCollapsedLookup.found) {
      lastMatchStatus = "partial";
      lastSource = "census";
      lastNotes.push("partial_hyphen_match");
    } else {
      lastNotes.push("hyphen surname not found");
    }
    if (lastCollapsedLookup.found) {
      lastNotes.push("hyphen collapsed match");
      if (collapsedPercentile !== undefined && partPercentile !== undefined && partPercentile > collapsedPercentile) {
        lastNotes.push("hyphen_score_capped_by_collapsed");
      }
    }
  } else if (lastExact.found) {
    lastMatchStatus = lastExact.match;
    lastSource = "census";
    lastNotes.push(...lastExact.notes);
    lastPercentile = lastExact.percentile;
    lastCount = lastExact.count;
  } else if (lastToken) {
    lastNotes.push(...lastExact.notes);
  }

  const firstBasePercentile = firstLookup.phoneticBase?.percentile ?? firstLookup.percentile;
  const firstBaseScore = specialFirst.tier
    ? Math.round((specialFirst.tier / 10) * 100)
    : firstLookup.found
      ? toRarityScore(firstBasePercentile)
      : 0;
  const firstSpellingBoost = specialFirst.tier
    ? { boost: 0 }
    : computeSpellingDeviationBoost({
        token: validated.parts.first ?? "",
        baseName:
          firstLookup.matchType === "diacritics"
            ? validated.tokensWithoutSuffixNoDiacritics[0]
            : firstLookup.phoneticBase?.name,
        matchType: firstLookup.matchType,
        phoneticBase: firstLookup.phoneticBase
      });

  const middleBaseScores = middleLookups
    .filter((lookup) => lookup.found)
    .map((lookup) => toRarityScore(lookup.phoneticBase?.percentile ?? lookup.percentile));
  const middleBaseScore = specialMiddle.tier
    ? Math.round((specialMiddle.tier / 10) * 100)
    : middleBaseScores.length > 0
      ? Math.round(middleBaseScores.reduce((sum, value) => sum + value, 0) / middleBaseScores.length)
      : 0;
  const middleSpellingBoosts = middleLookups
    .map((lookup, index) => {
      if (!lookup.found) return { boost: 0, note: undefined };
      return computeSpellingDeviationBoost({
        token: middleTokens[index] ?? "",
        baseName:
          lookup.matchType === "diacritics"
            ? middleTokensNoDiacritics[index]
            : lookup.phoneticBase?.name,
        matchType: lookup.matchType,
        phoneticBase: lookup.phoneticBase
      });
    })
    .filter((entry) => entry.boost > 0);
  const middleSpellingBoost =
    middleSpellingBoosts.length > 0
      ? Math.round(middleSpellingBoosts.reduce((sum, entry) => sum + entry.boost, 0) / middleSpellingBoosts.length)
      : 0;

  const lastBaseScore = specialLast.tier
    ? Math.round((specialLast.tier / 10) * 100)
    : lastPercentile !== undefined
      ? toRarityScore(lastPercentile)
      : 0;
  const lastSpellingBoost =
    !specialLast.tier && lastToken && !lastHasHyphen && lastExact.found
      ? computeSpellingDeviationBoost({
          token: lastToken,
          baseName:
            lastExact.matchType === "diacritics"
              ? stripDiacritics(lastToken)
              : lastExact.phoneticBase?.name,
          matchType: lastExact.matchType,
          phoneticBase: lastExact.phoneticBase
        })
      : { boost: 0 };

  const firstPart: PartResult | undefined = validated.parts.first
    ? {
        raw: validated.parts.first,
        normalized: validated.parts.first,
        role: "first",
        match: firstMatchStatus,
        source: specialFirst.tier ? "special" : "ssa",
        count: firstLookup.count,
        percentile: firstLookup.found ? firstLookup.percentile : undefined,
        rarityTier: partLabelFromScore(firstBaseScore, firstMatchStatus !== "none"),
        notes: Array.from(
          new Set(
            [specialFirst.note, ...firstLookup.notes, firstSpellingBoost.note].filter(
              (note): note is string => Boolean(note)
            )
          )
        ),
        flags: [],
        phoneticBase: firstLookup.phoneticBase
          ? {
              code: firstLookup.phoneticBase.code,
              name: firstLookup.phoneticBase.name,
              similarity: firstLookup.phoneticBase.similarity,
              distance: firstLookup.phoneticBase.distance,
              threshold: firstLookup.phoneticBase.threshold,
              gateSummary: firstLookup.phoneticBase.gateSummary
            }
          : undefined,
        spellingVariant: {
          type: firstLookup.matchType,
          boost: firstSpellingBoost.boost,
          note: firstSpellingBoost.note
        }
      }
    : undefined;

  const middlePart: PartResult | undefined = validated.parts.middle
    ? {
        raw: validated.parts.middle,
        normalized: validated.parts.middle,
        role: "middle",
        match: middleMatchStatus,
        source: specialMiddle.tier ? "special" : "ssa",
        count: middleLookups[0]?.count,
        percentile: middleLookups.length > 0 ? middleLookups[0]?.percentile : undefined,
        rarityTier: partLabelFromScore(middleBaseScore, middleMatchStatus !== "none"),
        notes: validated.parts.middle
          ? [
              middleTokens.length > 1 ? "multiple middle tokens" : "single middle token",
              `${middleMatchedCount}/${middleTokens.length} middle tokens matched`,
              middleSpellingBoosts.length > 0 ? "spelling variants detected in middle tokens" : undefined
            ].filter((note): note is string => Boolean(note))
          : ["no middle name provided"],
        flags: []
      }
    : undefined;

  const lastPart: PartResult | undefined = validated.parts.last
    ? {
        raw: validated.parts.last,
        normalized: validated.parts.last,
        role: "last",
        match: lastMatchStatus,
        source: lastSource,
        count: lastCount,
        percentile: lastPercentile,
        rarityTier: partLabelFromScore(lastBaseScore, lastMatchStatus !== "none"),
        notes: Array.from(
          new Set([...lastNotes, lastSpellingBoost.note].filter((note): note is string => Boolean(note)))
        ),
        flags: [],
        phoneticBase: lastExact.phoneticBase
          ? {
              code: lastExact.phoneticBase.code,
              name: lastExact.phoneticBase.name,
              similarity: lastExact.phoneticBase.similarity,
              distance: lastExact.phoneticBase.distance,
              threshold: lastExact.phoneticBase.threshold,
              gateSummary: lastExact.phoneticBase.gateSummary
            }
          : undefined,
        spellingVariant: {
          type: lastExact.matchType,
          boost: lastSpellingBoost.boost,
          note: lastSpellingBoost.note
        }
      }
    : undefined;

  const suffixInfo = getSuffixBoost(validated.parts.suffix);
  const hasDatasetEvidence = Boolean(
    specialFull.tier ||
      specialLast.tier ||
      specialFirst.tier ||
      specialMiddle.tier ||
      firstMatchStatus !== "none" ||
      middleMatchStatus !== "none" ||
      lastMatchStatus !== "none"
  );
  const suffixAllowed = Boolean(
    validated.parts.suffix &&
      suffixInfo &&
      validated.parts.first &&
      validated.parts.last &&
      hasDatasetEvidence
  );

  const suffixPart: PartResult | undefined =
    validated.parts.suffix || validated.parts.suffixCandidate
      ? {
          raw: validated.parts.suffix ?? validated.parts.suffixCandidate ?? "",
          normalized: validated.parts.suffix ?? validated.parts.suffixCandidate ?? "",
          role: "suffix",
          match: suffixAllowed ? "match" : "none",
          source: "none",
          rarityTier: suffixAllowed && suffixInfo ? suffixInfo.tier : "unknown",
          notes:
            validated.parts.suffix || validated.parts.suffixCandidate
              ? suffixInfo
                ? [suffixInfo.note]
                : ["suffix not applied"]
              : ["no suffix provided"],
          flags: []
        }
      : undefined;

  const spellingExplanations: string[] = [];
  if (
    validated.parts.first &&
    firstSpellingBoost.boost > 0 &&
    firstLookup.phoneticBase?.name &&
    firstLookup.phoneticBase.name !== validated.parts.first
  ) {
    spellingExplanations.push(
      buildSpellingVariantExplanation({
        token: validated.parts.first,
        baseName: firstLookup.phoneticBase.name,
        boost: firstSpellingBoost.boost,
        baseTier: labelFromScore(firstBaseScore),
        phoneticBase: firstLookup.matchType === "phonetic" ? firstLookup.phoneticBase : undefined
      })
    );
  }
  middleLookups.forEach((lookup, index) => {
    const token = middleTokens[index];
    if (
      token &&
      lookup.phoneticBase?.name &&
      lookup.phoneticBase.name !== token &&
      lookup.found
    ) {
      const boost = computeSpellingDeviationBoost({
        token,
        baseName: lookup.phoneticBase.name,
        matchType: lookup.matchType,
        phoneticBase: lookup.phoneticBase
      });
      if (boost.boost > 0) {
        spellingExplanations.push(
          buildSpellingVariantExplanation({
            token,
            baseName: lookup.phoneticBase.name,
            boost: boost.boost,
            baseTier: labelFromScore(toRarityScore(lookup.phoneticBase.percentile)),
            phoneticBase: lookup.matchType === "phonetic" ? lookup.phoneticBase : undefined
          })
        );
      }
    }
  });
  if (
    lastToken &&
    !lastHasHyphen &&
    lastSpellingBoost.boost > 0 &&
    lastExact.phoneticBase?.name &&
    lastExact.phoneticBase.name !== lastToken
  ) {
    spellingExplanations.push(
      buildSpellingVariantExplanation({
        token: lastToken,
        baseName: lastExact.phoneticBase.name,
        boost: lastSpellingBoost.boost,
        baseTier: labelFromScore(lastBaseScore),
        phoneticBase: lastExact.matchType === "phonetic" ? lastExact.phoneticBase : undefined
      })
    );
  }

  if (specialFull.tier) {
    datasetNotes.push("Special-case full name override applied.");
  }
  if (specialLast.tier) {
    datasetNotes.push("Special-case surname override applied.");
  }
  const diacriticsMatch =
    firstLookup.matchType === "diacritics" ||
    middleLookups.some((lookup) => lookup.matchType === "diacritics") ||
    lastExact.matchType === "diacritics";
  const phoneticMatch =
    firstLookup.matchType === "phonetic" ||
    middleLookups.some((lookup) => lookup.matchType === "phonetic") ||
    lastExact.matchType === "phonetic";
  if (diacriticsMatch) {
    datasetNotes.push("diacritics-normalized match");
  }
  if (phoneticMatch) {
    datasetNotes.push("phonetic match (sound-based inference)");
    flags.push("phonetic_match");
    phoneticConfidenceNote = "Phonetic inference reduces confidence.";
  }
  if (lastNotes.includes("hyphen both parts found")) {
    datasetNotes.push("Hyphenated surname matched on both parts.");
  }
  if (lastNotes.includes("partial_hyphen_match")) {
    datasetNotes.push("Partial hyphenated surname match.");
  }

  if (spellingExplanations.length > 0) {
    confidenceNotes.push(...spellingExplanations);
  }
  if (phoneticConfidenceNote) {
    confidenceNotes.push(phoneticConfidenceNote);
  }

  const matchedTokens = new Set<string>();
  if (firstPart && firstPart.match !== "none") matchedTokens.add(firstPart.normalized);
  if (middleTokens.length > 0) {
    middleTokens.forEach((token, index) => {
      if (middleLookups[index]?.found) matchedTokens.add(token);
    });
  }
  if (lastHasHyphen) {
    lastParts.forEach((part, index) => {
      if (lastPartLookups[index]?.found) matchedTokens.add(part);
    });
  } else if (lastPart && lastPart.match !== "none") {
    matchedTokens.add(lastPart.normalized);
  }

  if (validated.disallowedChars.length > 0) {
    flags.push("unsupported_characters");
    penaltiesApplied.push({
      id: "unsupported_characters",
      points: 25,
      detail: "Unsupported characters detected in input."
    });
  }
  if (/\d/.test(parsed.raw)) {
    flags.push("digits_present");
    penaltiesApplied.push({
      id: "digits_present",
      points: 25,
      detail: "Digits are not expected in real names."
    });
  }

  const tokensForAnalysis = validated.tokensWithoutSuffix;
  const tokensForGibberish = tokensForAnalysis.flatMap((token) => token.split("-").filter(Boolean));

  const gibberishTokens = tokensForGibberish.filter((token) => isGibberishToken(token));
  if (gibberishTokens.length > 0) {
    flags.push("gibberish_token");
    const penalty = Math.min(70, gibberishTokens.length * 35);
    penaltiesApplied.push({
      id: "gibberish_token",
      points: penalty,
      detail: `Gibberish patterns detected (${gibberishTokens.join(", ")}).`
    });
  }

  const repetitionTokens = [
    validated.parts.first,
    ...middleTokens,
    ...(lastHasHyphen ? lastParts : [validated.parts.last])
  ].filter(Boolean) as string[];
  const tokenCounts = repetitionTokens.reduce<Record<string, number>>((acc, token) => {
    acc[token] = (acc[token] ?? 0) + 1;
    return acc;
  }, {});
  const maxCount = Math.max(0, ...Object.values(tokenCounts));
  const repeatedAcrossFields = Boolean(
    (validated.parts.first && validated.parts.last && validated.parts.first === validated.parts.last) ||
      (validated.parts.first && middleTokens.includes(validated.parts.first)) ||
      (validated.parts.last && middleTokens.includes(validated.parts.last)) ||
      (validated.parts.first && lastParts.includes(validated.parts.first))
  );
  if (maxCount > 2 || repeatedAcrossFields) {
    flags.push("repetition_abuse");
    const penalty = maxCount >= 4 ? 40 : maxCount >= 3 ? 30 : 20;
    penaltiesApplied.push({
      id: "repetition_abuse",
      points: penalty,
      detail: "Repeated tokens detected across fields."
    });
  }

  const givenNameHyphenTokens = [validated.parts.first, ...middleTokens].filter(
    (token): token is string => Boolean(token)
  ).filter((token) => token.includes("-"));
  if (givenNameHyphenTokens.length > 0) {
    flags.push("hyphen_in_given_name");
    penaltiesApplied.push({
      id: "hyphen_in_given_name",
      points: 20,
      detail: `Hyphen detected in given name token(s) (${givenNameHyphenTokens.join(", ")}).`
    });
  }

  const hyphenTriggers: string[] = [];
  if (tokensForAnalysis.some((token) => (token.match(/-/g) ?? []).length > 1)) {
    hyphenTriggers.push("multiple_hyphens_in_token");
  }
  if (lastHasHyphen && lastParts.length > 0) {
    const unknownShortSide = lastParts.some((part, index) => !lastPartLookups[index]?.found && part.length < 2);
    if (unknownShortSide) hyphenTriggers.push("hyphen_short_unknown");
    const otherTokens = [validated.parts.first, ...middleTokens].filter(Boolean) as string[];
    if (lastParts.some((part) => otherTokens.includes(part))) {
      hyphenTriggers.push("hyphen_repeats_other_part");
    }
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

  if (validated.parts.suffixCandidate && !validated.parts.suffix) {
    flags.push("invalid_suffix");
    missingDataReasons.push("Invalid suffix format detected (no boost applied).");
  }
  if (suffixInfo && !suffixAllowed) {
    flags.push("unsupported_suffix_context");
    missingDataReasons.push("Suffix ignored because first/last context was missing or unmatched.");
  }

  const longTokens = tokensForGibberish.filter(
    (token) => token.length > 18 && !matchedTokens.has(token)
  );
  if (longTokens.length > 0) {
    flags.push("suspicious_length");
    penaltiesApplied.push({
      id: "suspicious_length",
      points: 20,
      detail: `Unusually long tokens (${longTokens.join(", ")}).`
    });
  }

  const tokenCoverage = computeTokenCoverage({
    first: firstPart,
    middle: middlePart,
    last: lastPart,
    suffix: suffixPart
  });

  if (tokensForAnalysis.length > 5 && tokenCoverage < 0.6) {
    flags.push("too_many_tokens");
    penaltiesApplied.push({
      id: "too_many_tokens",
      points: 15,
      detail: "Five or more tokens with weak dataset coverage."
    });
  }

  if (!hasDatasetEvidence) {
    flags.push("all_unknown");
    missingDataReasons.push("No dataset matches found, so we cannot score this name.");
  }

  if (validated.parts.first === undefined) {
    confidenceNotes.push("Missing first name lowers confidence.");
    missingDataReasons.push("Missing first name limits scoring.");
  }
  if (validated.parts.last === undefined) {
    confidenceNotes.push("Missing last name lowers confidence.");
    missingDataReasons.push("Missing last name limits scoring.");
  }

  const structureSignals = [
    lastHasHyphen ? "hyphen_present" : null,
    tokensForAnalysis.length > 2 ? "multi_token" : null,
    validated.parts.suffix ? "suffix_present" : null
  ].filter(Boolean) as string[];

  const junkSignals = Array.from(new Set(flags.filter((flag) => flag !== "all_unknown")));

  const completeness = validated.parts.first && validated.parts.last ? 1 : 0;

  let confidenceValue = 0;
  if (lastPart) {
    confidenceValue += lastPart.match === "match" ? 0.55 : lastPart.match === "partial" ? 0.3 : lastPart.match === "phonetic" ? 0.2 : 0;
  }
  if (firstPart) {
    confidenceValue += firstPart.match === "match" ? 0.3 : firstPart.match === "partial" ? 0.15 : firstPart.match === "phonetic" ? 0.1 : 0;
  }
  if (middlePart) {
    confidenceValue += middlePart.match === "match" ? 0.12 : middlePart.match === "partial" ? 0.06 : middlePart.match === "phonetic" ? 0.04 : 0;
  }
  if (suffixPart && suffixPart.match === "match") {
    confidenceValue += 0.03;
  }

  const phoneticMatchCount = [firstPart, middlePart, lastPart].filter(
    (part) => part?.match === "phonetic"
  ).length;
  if (phoneticMatchCount > 0) {
    confidenceValue -= phoneticMatchCount * PHONETIC_MATCH_CONFIDENCE_PENALTY;
    phoneticConfidenceNote = "Phonetic inference reduces confidence.";
  }

  if (!validated.parts.first) confidenceValue -= 0.35;
  if (!validated.parts.last) confidenceValue -= 0.55;

  const junkPenalty = flags.reduce((sum, flag) => sum + (confidencePenaltyByFlag[flag] ?? 0), 0);
  confidenceValue -= junkPenalty;
  if (flags.includes("too_many_tokens")) {
    confidenceValue -= 0.15;
  }

  if (lastHasHyphen && lastMatchStatus === "match") {
    confidenceValue += 0.05;
  }

  if (specialLast.tier || specialFull.tier) {
    confidenceValue = Math.max(confidenceValue, 0.85);
    datasetNotes.push("Special-case dataset override applied.");
  }

  const hasSpecialOverride = Boolean(specialLast.tier || specialFull.tier);
  if (lastMatchStatus === "none" && !hasSpecialOverride) {
    confidenceValue = Math.min(confidenceValue, 0.55);
    confidenceGateReasons.push("Unmatched last name caps confidence.");
    flags.push("last_name_unmatched");
  }
  if (!validated.parts.first || !validated.parts.last) {
    confidenceValue = Math.min(confidenceValue, 0.35);
    confidenceGateReasons.push("Missing first or last name caps confidence.");
    flags.push("missing_core_name");
  }

  confidenceValue = clamp(confidenceValue, 0, 1);

  const confidenceLabel = confidenceLabelFromValue(confidenceValue);

  if (flags.includes("repetition_abuse")) {
    confidenceNotes.push("Repetition patterns reduce confidence.");
  }
  if (flags.includes("gibberish_token")) {
    confidenceNotes.push("Gibberish patterns reduce confidence.");
  }
  if (flags.includes("unsupported_characters") || flags.includes("digits_present")) {
    confidenceNotes.push("Unsupported characters reduce confidence.");
  }

  const middleScoreEligible = lastMatchStatus !== "none" || tokensForAnalysis.length < 3;
  if (!middleScoreEligible && middleBaseScore > 0) {
    confidenceGateReasons.push("Middle-name evidence de-emphasized because last name is not matched.");
  }

  const weightedBaseScores: Array<{ score: number; weight: number }> = [];
  if (firstBaseScore > 0) weightedBaseScores.push({ score: firstBaseScore, weight: rarityWeights.first });
  if (middleBaseScore > 0 && middleScoreEligible) {
    weightedBaseScores.push({ score: middleBaseScore, weight: rarityWeights.middle });
  }
  if (lastBaseScore > 0) weightedBaseScores.push({ score: lastBaseScore, weight: rarityWeights.last });
  const baseWeightSum = weightedBaseScores.reduce((sum, entry) => sum + entry.weight, 0);
  let baseScore = baseWeightSum
    ? Math.round(weightedBaseScores.reduce((sum, entry) => sum + entry.score * entry.weight, 0) / baseWeightSum)
    : 0;

  const weightedSpellingBoosts: Array<{ boost: number; weight: number }> = [];
  if (firstSpellingBoost.boost > 0) {
    weightedSpellingBoosts.push({ boost: firstSpellingBoost.boost, weight: rarityWeights.first });
  }
  if (middleSpellingBoost > 0 && middleScoreEligible) {
    weightedSpellingBoosts.push({ boost: middleSpellingBoost, weight: rarityWeights.middle });
  }
  if (lastSpellingBoost.boost > 0) {
    weightedSpellingBoosts.push({ boost: lastSpellingBoost.boost, weight: rarityWeights.last });
  }
  const spellingWeightSum = weightedSpellingBoosts.reduce((sum, entry) => sum + entry.weight, 0);
  const spellingBoost = spellingWeightSum
    ? Math.round(weightedSpellingBoosts.reduce((sum, entry) => sum + entry.boost * entry.weight, 0) / spellingWeightSum)
    : 0;

  let coreScore = clamp(baseScore + spellingBoost, 0, 100);

  if (specialFull.tier) {
    const fullScore = Math.round((specialFull.tier / 10) * 100);
    coreScore = Math.max(coreScore, fullScore);
  }

  const coreLabel = labelFromScore(coreScore);
  let structuralBoost = 0;
  if (validated.parts.middle && middleMatchStatus !== "none") {
    structuralBoost += middleTokens.length > 1 ? 2 : 1;
  }
  if (lastHasHyphen && lastMatchStatus !== "none") {
    structuralBoost += lastMatchStatus === "match" ? 2 : 1;
  }
  if (suffixAllowed && suffixInfo) {
    structuralBoost += suffixInfo.boost;
  }
  if (structuralBoost > 0) {
    confidenceNotes.push("Structural modifiers (middle names, hyphens, suffixes) add a small rarity bump.");
  }
  const structuralScore = clamp(coreScore + structuralBoost, 0, maxScoreForLabel(coreLabel));
  baseScore = structuralScore;

  const penaltyPoints = penaltiesApplied.reduce((sum, entry) => sum + entry.points, 0);
  const multiplier = getConfidenceMultiplier(confidenceValue);
  let finalScoreNumber = Math.round(baseScore * multiplier - penaltyPoints);
  finalScoreNumber = clamp(finalScoreNumber, 0, 100);

  if (lastMatchStatus === "none" && !hasSpecialOverride) {
    finalScoreNumber = Math.min(finalScoreNumber, 45);
    capsApplied.push("Unmatched last name caps score at 45.");
    confidenceGateReasons.push("Last name missing or unmatched blocks rare labels.");
    flags.push("last_name_score_cap");
  }

  if (confidenceValue < 0.35) {
    finalScoreNumber = Math.min(finalScoreNumber, 45);
    capsApplied.push("Confidence < 0.35 caps score at 45.");
    confidenceGateReasons.push("Confidence is too low for high rarity labels.");
    flags.push("confidence_cap");
  }

  const extremeAllowed =
    confidenceValue >= 0.85 &&
    ((lastPart && lastPart.rarityTier === "extreme") || Boolean(specialLast.tier) || Boolean(specialFull.tier));
  if (finalScoreNumber >= 90 && !extremeAllowed) {
    finalScoreNumber = 89;
    capsApplied.push("Extreme scores require top-tier last name and high confidence.");
    confidenceGateReasons.push("Extreme label blocked without top-tier last name or high confidence.");
    flags.push("extreme_cap");
  }

  if (finalScoreNumber === 0 && hasDatasetEvidence && confidenceLabel === "high") {
    finalScoreNumber = 1;
    confidenceNotes.push("Common names still receive a small baseline score.");
    reasons.push("Name is common in datasets; low rarity score reflects high frequency.");
  }

  let label: NameLabel = labelFromScore(finalScoreNumber);
  if (confidenceValue < 0.35 && label !== "unknown") {
    if (label === "extreme" || label === "very rare" || label === "rare") {
      label = "uncommon";
      confidenceGateReasons.push("Label capped to uncommon due to low confidence.");
      flags.push("label_cap");
    }
  }
  if (lastMatchStatus === "none" && !hasSpecialOverride && label !== "unknown") {
    if (label === "extreme" || label === "very rare" || label === "rare") {
      label = "uncommon";
      confidenceGateReasons.push("Label capped to uncommon due to unmatched last name.");
      flags.push("label_cap");
    }
  }

  let finalScore: number | null = finalScoreNumber;

  if (!hasDatasetEvidence || scriptUnsupported) {
    label = "unknown";
    finalScore = null;
  }

  penaltyReasons.push(...penaltiesApplied.map((penalty) => penalty.detail));
  reasons.push(...missingDataReasons, ...confidenceGateReasons, ...penaltyReasons, ...datasetNotes);
  const reasonOrder = reasons;
  const orderedReasons = Array.from(new Set(reasonOrder));

  const estimates = getEstimateCounts({
    firstCount: firstLookup.count,
    lastCount: lastCount,
    allowEstimate: confidenceLabel === "high" && Boolean(finalScore)
  });

  return {
    score: finalScore,
    label,
    confidenceValue: Number(confidenceValue.toFixed(2)),
    confidenceLabel,
    estimatedGlobalCount: estimates.estimatedGlobalCount,
    estimatedUSCount: estimates.estimatedUSCount,
    reasons: orderedReasons,
    flags: Array.from(new Set(flags)),
    parts: {
      first: firstPart,
      middle: middlePart,
      last: lastPart,
      suffix: suffixPart
    },
    penaltiesApplied,
    capsApplied,
    confidenceNotes,
    debug: {
      baseScore,
      multiplier,
      penalties: penaltyPoints,
      tokenCoverage,
      completeness,
      junkSignals,
      structureSignals
    }
  };
}
