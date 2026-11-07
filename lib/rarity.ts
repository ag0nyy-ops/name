import censusSurnames from "../data/generated/census_surnames.json";
import ssaFirstNames from "../data/generated/ssa_first_names.json";
import {
  DATASET_INFO,
  SCORING_MODEL_VERSION,
  detectSuffix as engineDetectSuffix,
  parseName as engineParseName,
  scoreNameEngine,
  type ConfidenceLabel,
  type DatasetCheck,
  type MatchStatus,
  type NameLabel,
  type NameParts,
  type PenaltyEntry,
  type PartResult
} from "./scoring/engine";

export type Confidence = ConfidenceLabel;
export type { NameLabel, NameParts, MatchStatus, DatasetCheck, PenaltyEntry };
export { DATASET_INFO, SCORING_MODEL_VERSION };

export type BreakdownEntry = {
  token: string;
  matchStatus: MatchStatus;
  source: "ssa" | "census" | "none";
  rarityTier: NameLabel | "none";
  notes: string[];
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

const SSA_TABLE = ssaFirstNames as FrequencyTable;
const CENSUS_TABLE = censusSurnames as FrequencyTable;

export const detectSuffix = engineDetectSuffix;
export const parseName = engineParseName;

const US_POPULATION_ESTIMATE = 335_000_000;

function roundSig(value: number, digits = 2): number {
  if (value === 0) return 0;
  const factor = Math.pow(10, digits - Math.floor(Math.log10(Math.abs(value))) - 1);
  return Math.round(value * factor) / factor;
}

function getEstimateDetail(options: {
  firstCount?: number;
  lastCount?: number;
  hasCaps: boolean;
  allowEstimate: boolean;
}): string {
  const unknown = "We don’t have enough data to estimate this reliably.";
  if (!options.allowEstimate || options.hasCaps) return unknown;
  if (!options.firstCount || !options.lastCount) return unknown;
  if (SSA_TABLE.totalCount === 0 || CENSUS_TABLE.totalCount === 0) return unknown;
  // Rough estimate: share of first name x share of surname x US population.
  // Assumes first and last names are independent; real names correlate.
  const rate =
    (options.firstCount / SSA_TABLE.totalCount) * (options.lastCount / CENSUS_TABLE.totalCount);
  const people = rate * US_POPULATION_ESTIMATE;
  if (people < 1) {
    return "Estimate: probably fewer than 1 person in the US has this exact name (assumes first and last names are independent).";
  }
  const rounded = roundSig(people).toLocaleString("en-US");
  return `Estimate: roughly ${rounded} ${people < 1.5 ? "person" : "people"} in the US share this exact name (assumes first and last names are independent).`;
}

function mapPartSource(part?: PartResult): "ssa" | "census" | "none" {
  if (!part) return "none";
  if (part.source === "ssa") return "ssa";
  if (part.source === "census") return "census";
  if (part.source === "special") {
    return part.role === "last" ? "census" : "ssa";
  }
  return "none";
}

function mapRarityTier(part?: PartResult): NameLabel | "none" {
  if (!part || part.match === "none") return "none";
  return part.rarityTier;
}

function buildDatasetChecks(parts: {
  first?: PartResult;
  middle?: PartResult;
  last?: PartResult;
},
flags: string[]
): DatasetCheck[] {
  if (flags.includes("script_not_supported")) return [];
  const checks: DatasetCheck[] = [];
  if (parts.first) {
    const phoneticNote = parts.first.match === "phonetic" ? "phonetic match (sound-based inference)" : undefined;
    checks.push({
      id: DATASET_INFO.ssa.id,
      name: DATASET_INFO.ssa.name,
      scope: "first",
      matchStatus: parts.first.match,
      note: phoneticNote ?? (parts.first.notes.includes("diacritics-normalized match") ? "diacritics-normalized match" : undefined)
    });
  }
  if (parts.middle) {
    const phoneticNote = parts.middle.match === "phonetic" ? "phonetic match (sound-based inference)" : undefined;
    checks.push({
      id: DATASET_INFO.ssa.id,
      name: DATASET_INFO.ssa.name,
      scope: "middle",
      matchStatus: parts.middle.match,
      note: phoneticNote ?? (parts.middle.notes.includes("diacritics-normalized match") ? "diacritics-normalized match" : undefined)
    });
  }
  if (parts.last) {
    const phoneticNote = parts.last.match === "phonetic" ? "phonetic match (sound-based inference)" : undefined;
    checks.push({
      id: DATASET_INFO.census.id,
      name: DATASET_INFO.census.name,
      scope: "last",
      matchStatus: parts.last.match,
      note: phoneticNote ?? (parts.last.notes.includes("diacritics-normalized match") ? "diacritics-normalized match" : undefined)
    });
  }
  return checks;
}

function buildBreakdown(parts: NameParts, engineParts: {
  first?: PartResult;
  middle?: PartResult;
  last?: PartResult;
  suffix?: PartResult;
}): BreakdownEntry[] {
  const firstPart = engineParts.first;
  const middlePart = engineParts.middle;
  const lastPart = engineParts.last;
  const suffixPart = engineParts.suffix;

  return [
    {
      token: parts.first ?? "—",
      matchStatus: parts.first ? firstPart?.match ?? "none" : "none",
      source: parts.first ? mapPartSource(firstPart) : "ssa",
      rarityTier: parts.first ? mapRarityTier(firstPart) : "none",
      notes: parts.first ? firstPart?.notes ?? [] : ["missing first name"]
    },
    {
      token: parts.middle ?? "—",
      matchStatus: parts.middle ? middlePart?.match ?? "none" : "none",
      source: parts.middle ? mapPartSource(middlePart) : "ssa",
      rarityTier: parts.middle ? mapRarityTier(middlePart) : "none",
      notes: parts.middle ? middlePart?.notes ?? [] : ["no middle name provided"]
    },
    {
      token: parts.last ?? "—",
      matchStatus: parts.last ? lastPart?.match ?? "none" : "none",
      source: parts.last ? mapPartSource(lastPart) : "census",
      rarityTier: parts.last ? mapRarityTier(lastPart) : "none",
      notes: parts.last ? lastPart?.notes ?? [] : ["missing last name"]
    },
    {
      token: parts.suffix ?? parts.suffixCandidate ?? "—",
      matchStatus: parts.suffix || parts.suffixCandidate ? suffixPart?.match ?? "none" : "none",
      source: "none",
      rarityTier: parts.suffix ? mapRarityTier(suffixPart) : "none",
      notes: parts.suffix || parts.suffixCandidate ? suffixPart?.notes ?? [] : ["no suffix provided"]
    }
  ];
}

export function scoreName(input: string): NameScore {
  const parts = parseName(input);
  const engine = scoreNameEngine(input);

  const estimate = getEstimateDetail({
    firstCount: engine.parts.first?.count,
    lastCount: engine.parts.last?.count,
    hasCaps: engine.capsApplied.length > 0,
    allowEstimate: engine.confidenceLabel === "high" && Boolean(engine.score)
  });

  return {
    parts,
    score: engine.score,
    label: engine.label,
    confidence: engine.confidenceLabel,
    confidenceValue: engine.confidenceValue,
    estimate,
    datasetsChecked: buildDatasetChecks(engine.parts, engine.flags),
    reasons: engine.reasons,
    flags: engine.flags,
    penaltiesApplied: engine.penaltiesApplied,
    capsApplied: engine.capsApplied,
    confidenceNotes: engine.confidenceNotes,
    breakdown: buildBreakdown(parts, engine.parts),
    scoringVersion: SCORING_MODEL_VERSION,
    datasetsUpdatedAt: {
      ssa: SSA_TABLE.generatedAt,
      census: CENSUS_TABLE.generatedAt
    }
  };
}
