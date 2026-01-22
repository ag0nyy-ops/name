import censusSurnames from "../../data/generated/census_surnames.json";
import ssaFirstNames from "../../data/generated/ssa_first_names.json";
import specialCases from "../../data/specialCases.json";

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

export type MatchStatus = "match" | "partial" | "none";

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
  matched: boolean;
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

export const SCORING_MODEL_VERSION = "v3.0";

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
const fancyHyphenRegex = /[‐‑‒–—―]/g;
const keyboardSequences = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

const confidencePenaltyByFlag: Record<string, number> = {
  repetition_abuse: 0.2,
  gibberish_token: 0.25,
  hyphen_abuse: 0.15,
  suspicious_length: 0.1,
  unsupported_characters: 0.2,
  digits_present: 0.2
};

const rarityWeights = {
  last: 0.55,
  first: 0.3,
  middle: 0.1
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

function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").normalize("NFC");
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

function toRarityScore(percentile: number): number {
  return Math.round(Math.min(100, Math.max(0, percentile * 100)));
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
    return { boost: 1, tier: "common", note: "generational suffix (jr/sr)" };
  }
  const romanValue = ROMAN_SUFFIXES.get(value);
  if (!romanValue) return null;
  if (romanValue <= 3) return { boost: 3, tier: "uncommon", note: "roman numeral suffix (I–III)" };
  if (romanValue <= 6) return { boost: 5, tier: "rare", note: "roman numeral suffix (IV–VI)" };
  return { boost: 7, tier: "very rare", note: "roman numeral suffix (VII–X)" };
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
  const entries: Array<{ weight: number; score: number }> = [];
  if (inputs.first) {
    entries.push({
      weight: coverageWeights.first,
      score: inputs.first.match === "match" ? 1 : inputs.first.match === "partial" ? 0.5 : 0
    });
  }
  if (inputs.middle) {
    entries.push({
      weight: coverageWeights.middle,
      score: inputs.middle.match === "match" ? 1 : inputs.middle.match === "partial" ? 0.5 : 0
    });
  }
  if (inputs.last) {
    entries.push({
      weight: coverageWeights.last,
      score: inputs.last.match === "match" ? 1 : inputs.last.match === "partial" ? 0.5 : 0
    });
  }
  if (inputs.suffix) {
    entries.push({
      weight: coverageWeights.suffix,
      score: inputs.suffix.match === "match" ? 1 : inputs.suffix.match === "partial" ? 0.5 : 0
    });
  }
  const weightSum = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (weightSum === 0) return 0;
  return entries.reduce((sum, entry) => sum + entry.weight * entry.score, 0) / weightSum;
}

function getEstimateCounts(options: {
  firstCount?: number;
  lastCount?: number;
  allowEstimate: boolean;
}): { estimatedUSCount?: number; estimatedGlobalCount?: number } {
  if (!options.allowEstimate) return {};
  if (!options.firstCount || !options.lastCount) return {};
  if (SSA_TABLE.totalCount === 0 || CENSUS_TABLE.totalCount === 0) return {};
  const rate = (options.firstCount / SSA_TABLE.totalCount) * (options.lastCount / CENSUS_TABLE.totalCount);
  const estimatedUSCount = Math.max(1, Math.round(rate * Math.min(SSA_TABLE.totalCount, CENSUS_TABLE.totalCount)));
  return { estimatedUSCount };
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

  const firstLookup = lookupFrequency(
    SSA_TABLE,
    validated.parts.first,
    validated.tokensWithoutSuffixNoDiacritics[0]
  );

  const middleTokens = validated.parts.middle ? validated.parts.middle.split(" ").filter(Boolean) : [];
  const middleTokensNoDiacritics = middleTokens.map(stripDiacritics);
  const middleLookups = middleTokens.map((token, index) =>
    lookupFrequency(SSA_TABLE, token, middleTokensNoDiacritics[index])
  );

  const lastToken = validated.parts.last;
  const lastHasHyphen = Boolean(lastToken && lastToken.includes("-"));
  const lastParts = lastHasHyphen ? (lastToken ?? "").split("-").filter(Boolean) : [];
  const lastPartsNoDiacritics = lastParts.map(stripDiacritics);
  const lastExact = lastToken
    ? lookupFrequency(CENSUS_TABLE, lastToken, stripDiacritics(lastToken))
    : { found: false, notes: ["missing"], percentile: 0, match: "none" };
  const lastPartLookups = lastParts.map((part, index) =>
    lookupFrequency(CENSUS_TABLE, part, lastPartsNoDiacritics[index])
  );

  const firstMatchStatus: MatchStatus = specialFirst.tier
    ? "partial"
    : firstLookup.match;
  const middleMatchedCount = middleLookups.filter((lookup) => lookup.found).length;
  const middleMatchStatus: MatchStatus = specialMiddle.tier
    ? "partial"
    : middleMatchedCount === 0
      ? "none"
      : middleMatchedCount === middleLookups.length
        ? "match"
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
    if (foundParts.length > 0) {
      lastPercentile =
        foundParts.reduce((sum, lookup) => sum + lookup.percentile, 0) / foundParts.length;
      lastCount = foundParts[0]?.count;
    }
    if (foundParts.length === lastPartLookups.length && foundParts.length > 0) {
      lastMatchStatus = "match";
      lastSource = "census";
      lastNotes.push("hyphen both parts found");
    } else if (foundParts.length === 1) {
      lastMatchStatus = "partial";
      lastSource = "census";
      lastNotes.push("partial_hyphen_match");
    } else {
      lastNotes.push("hyphen surname not found");
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

  const firstScore = specialFirst.tier
    ? Math.round((specialFirst.tier / 10) * 100)
    : firstLookup.found
      ? toRarityScore(firstLookup.percentile)
      : 0;
  const middleScores = middleLookups.filter((lookup) => lookup.found).map((lookup) => toRarityScore(lookup.percentile));
  const middleScore = specialMiddle.tier
    ? Math.round((specialMiddle.tier / 10) * 100)
    : middleScores.length > 0
      ? Math.round(middleScores.reduce((sum, value) => sum + value, 0) / middleScores.length)
      : 0;
  const lastScore = specialLast.tier
    ? Math.round((specialLast.tier / 10) * 100)
    : lastPercentile !== undefined
      ? toRarityScore(lastPercentile)
      : 0;

  const firstPart: PartResult | undefined = validated.parts.first
    ? {
        raw: validated.parts.first,
        normalized: validated.parts.first,
        role: "first",
        match: firstMatchStatus,
        source: specialFirst.tier ? "special" : "ssa",
        count: firstLookup.count,
        percentile: firstLookup.found ? firstLookup.percentile : undefined,
        rarityTier: partLabelFromScore(firstScore, firstMatchStatus !== "none"),
        notes: [specialFirst.note, ...firstLookup.notes].filter(Boolean),
        flags: []
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
        rarityTier: partLabelFromScore(middleScore, middleMatchStatus !== "none"),
        notes: validated.parts.middle
          ? [
              middleTokens.length > 1 ? "multiple middle tokens" : "single middle token",
              `${middleMatchedCount}/${middleTokens.length} middle tokens matched`
            ]
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
        rarityTier: partLabelFromScore(lastScore, lastMatchStatus !== "none"),
        notes: lastNotes,
        flags: []
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

  if (specialFull.tier) {
    datasetNotes.push("Special-case full name override applied.");
  }
  if (specialLast.tier) {
    datasetNotes.push("Special-case surname override applied.");
  }
  if (firstLookup.match === "partial" || middleLookups.some((lookup) => lookup.match === "partial") || lastExact.match === "partial") {
    datasetNotes.push("diacritics-normalized match");
  }
  if (lastNotes.includes("hyphen both parts found")) {
    datasetNotes.push("Hyphenated surname matched on both parts.");
  }
  if (lastNotes.includes("partial_hyphen_match")) {
    datasetNotes.push("Partial hyphenated surname match.");
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
    confidenceValue += lastPart.match === "match" ? 0.55 : lastPart.match === "partial" ? 0.3 : 0;
  }
  if (firstPart) {
    confidenceValue += firstPart.match === "match" ? 0.3 : firstPart.match === "partial" ? 0.15 : 0;
  }
  if (middlePart) {
    confidenceValue += middlePart.match === "match" ? 0.12 : middlePart.match === "partial" ? 0.06 : 0;
  }
  if (suffixPart && suffixPart.match === "match") {
    confidenceValue += 0.03;
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

  const weightedScores: Array<{ score: number; weight: number }> = [];
  if (firstScore > 0) weightedScores.push({ score: firstScore, weight: rarityWeights.first });
  if (middleScore > 0) weightedScores.push({ score: middleScore, weight: rarityWeights.middle });
  if (lastScore > 0) weightedScores.push({ score: lastScore, weight: rarityWeights.last });
  const weightSum = weightedScores.reduce((sum, entry) => sum + entry.weight, 0);
  let baseScore = weightSum
    ? Math.round(weightedScores.reduce((sum, entry) => sum + entry.score * entry.weight, 0) / weightSum)
    : 0;

  if (specialFull.tier) {
    const fullScore = Math.round((specialFull.tier / 10) * 100);
    baseScore = Math.max(baseScore, fullScore);
  }

  if (suffixAllowed && suffixInfo) {
    baseScore = clamp(baseScore + suffixInfo.boost, 0, 100);
  }

  const penaltyPoints = penaltiesApplied.reduce((sum, entry) => sum + entry.points, 0);
  const multiplier = getConfidenceMultiplier(confidenceValue);
  let finalScore = Math.round(baseScore * multiplier - penaltyPoints);
  finalScore = clamp(finalScore, 0, 100);

  if (confidenceValue < 0.35) {
    finalScore = Math.min(finalScore, 45);
    capsApplied.push("Confidence < 0.35 caps score at 45.");
    confidenceGateReasons.push("Confidence is too low for high rarity labels.");
    flags.push("confidence_cap");
  }

  const extremeAllowed =
    confidenceValue >= 0.85 &&
    ((lastPart && lastPart.rarityTier === "extreme") || Boolean(specialLast.tier) || Boolean(specialFull.tier));
  if (finalScore >= 90 && !extremeAllowed) {
    finalScore = 89;
    capsApplied.push("Extreme scores require top-tier last name and high confidence.");
    confidenceGateReasons.push("Extreme label blocked without top-tier last name or high confidence.");
    flags.push("extreme_cap");
  }

  let label: NameLabel = finalScore === null ? "unknown" : labelFromScore(finalScore);
  if (confidenceValue < 0.35 && label !== "unknown") {
    if (label === "extreme" || label === "very rare" || label === "rare") {
      label = "uncommon";
      confidenceGateReasons.push("Label capped to uncommon due to low confidence.");
      flags.push("label_cap");
    }
  }

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
