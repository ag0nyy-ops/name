import type { Label, NameResult, PartResult } from "./engine";

export function formatCount(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

/** "about 43,000 people", "about 2 people", "fewer than 1 person". */
export function formatPeople(people: number): string {
  if (people < 0.5) return "fewer than 1 person";
  if (people < 1.5) return "about 1 person";
  if (people < 100) return `about ${Math.round(people)} people`;
  const digits = Math.floor(Math.log10(people)) - 1;
  const rounded = Math.round(people / 10 ** digits) * 10 ** digits;
  return `about ${formatCount(rounded)} people`;
}

export const LABEL_TEXT: Record<Label, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  "very rare": "Very rare",
  extreme: "Extremely rare",
  unknown: "Unknown"
};

export const MATCH_TEXT: Record<PartResult["match"], string> = {
  exact: "Found",
  core: "Partly found",
  parts: "Halves found",
  special: "Hand-checked",
  missing: "Not listed"
};

export const KIND_TEXT: Record<PartResult["kind"], string> = {
  first: "First name",
  middle: "Middle name",
  last: "Last name"
};

export function datasetText(part: PartResult): string {
  return part.dataset === "ssa" ? "SSA baby names" : "2010 Census surnames";
}

/** One sentence for screen readers and the share text. */
export function summarize(result: NameResult): string {
  if (result.status === "empty") return "";
  if (result.status !== "ok" || result.score === null) {
    return `${result.display || "That name"}: no score. ${result.notes[0] ?? ""}`.trim();
  }
  const base = `${result.display} scores ${result.score} out of 100, ${LABEL_TEXT[result.label].toLowerCase()}`;
  if (result.estimate)
    return `${base}. Estimated ${formatPeople(result.estimate.people)} in the US share it.`;
  return `${base}.`;
}
