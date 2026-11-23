// Thin wrapper around the Rust engine (engine/), compiled to WebAssembly.
// Types mirror the JSON that engine/src/score.rs serializes.
import specialCases from "../data/specialCases.json";
import datasets from "../data/datasets.json";

export type Label =
  | "common"
  | "uncommon"
  | "rare"
  | "very rare"
  | "extreme"
  | "unknown";
export type Confidence = "high" | "medium" | "low";
export type PartMatch = "exact" | "core" | "parts" | "special" | "missing";

export type PartResult = {
  kind: "first" | "middle" | "last";
  text: string;
  dataset: "ssa" | "census";
  match: PartMatch;
  count: number | null;
  rank: number | null;
  totalNames: number;
  countUsed: number;
  share: number;
  score: number;
  label: Label;
  soundsLike: { name: string; count: number; rank: number | null } | null;
  looksUnusual: string | null;
  notes: string[];
};

export type NameResult = {
  status: "empty" | "ok" | "unsupported" | "unknown";
  display: string;
  mode: "full" | "first-only" | "last-only" | "none";
  first: PartResult | null;
  middle: PartResult[];
  last: PartResult | null;
  suffix: string | null;
  estimate: {
    people: number;
    isUpperBound: boolean;
    withMiddle: number | null;
  } | null;
  score: number | null;
  label: Label;
  confidence: Confidence;
  confidenceReasons: string[];
  notes: string[];
  modelVersion: string;
};

export type Scorer = (input: string) => NameResult;

export const DATASETS = datasets;
export const MODEL_VERSION = "4.0";
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const DATA_FILES = {
  first: "data/ssa-first-names.json",
  last: "data/census-surnames.json"
} as const;

let pending: Promise<Scorer> | null = null;

/** Loads the wasm engine and both tables once (browser). Later calls reuse it. */
export function loadEngine(): Promise<Scorer> {
  if (!pending) {
    const text = async (path: string) => {
      const response = await fetch(`${BASE_PATH}/${path}`);
      if (!response.ok)
        throw new Error(`Could not load ${path} (${response.status})`);
      return response.text();
    };
    pending = (async () => {
      const [wasm, first, last] = await Promise.all([
        import("./wasm/engine.js"),
        text(DATA_FILES.first),
        text(DATA_FILES.last)
      ]);
      // The bundler emits engine_bg.wasm with a hashed name and resolves its URL.
      await wasm.default();
      const engine = new wasm.Engine(first, last, JSON.stringify(specialCases));
      return (input: string) => JSON.parse(engine.score(input)) as NameResult;
    })().catch((error) => {
      pending = null;
      throw error;
    });
  }
  return pending;
}
