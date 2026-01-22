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
    checks.push({
      id: DATASET_INFO.ssa.id,
      name: DATASET_INFO.ssa.name,
      scope: "first",
      matched: parts.first.match !== "none",
      note: parts.first.notes.includes("diacritics-normalized match") ? "diacritics-normalized match" : undefined
    });
  }
  if (parts.middle) {
    checks.push({
      id: DATASET_INFO.ssa.id,
      name: DATASET_INFO.ssa.name,
      scope: "middle",
      matched: parts.middle.match !== "none",
      note: parts.middle.notes.includes("diacritics-normalized match") ? "diacritics-normalized match" : undefined
    });
  }
  if (parts.last) {
    checks.push({
      id: DATASET_INFO.census.id,
      name: DATASET_INFO.census.name,
      scope: "last",
      matched: parts.last.match !== "none",
      note: parts.last.notes.includes("diacritics-normalized match") ? "diacritics-normalized match" : undefined
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
