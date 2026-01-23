import { describe, expect, it, vi } from "vitest";

vi.mock("../data/generated/ssa_first_names.json", () => ({
  default: {
    source: "SSA baby names (test fixture)",
    generatedAt: "2024-01-01T00:00:00Z",
    totalNames: 100,
    totalCount: 1000000,
    percentileScale: 10000,
    names: {
      john: { count: 50000, percentile: 50 },
      james: { count: 42000, percentile: 60 },
      jay: { count: 2000, percentile: 1500 },
      joshua: { count: 18000, percentile: 250 },
      terrell: { count: 200, percentile: 9000 },
      jordan: { count: 9000, percentile: 500 },
      jose: { count: 11000, percentile: 450 },
      maria: { count: 8000, percentile: 600 },
      anne: { count: 12000, percentile: 300 },
      carter: { count: 2000, percentile: 1200 },
      aeon: { count: 400, percentile: 8500 },
      lucifer: { count: 120, percentile: 9400 }
    }
  }
}));

vi.mock("../data/generated/census_surnames.json", () => ({
  default: {
    source: "US Census surnames (test fixture)",
    generatedAt: "2024-01-01T00:00:00Z",
    totalNames: 100,
    totalCount: 500000,
    percentileScale: 10000,
    names: {
      smith: { count: 30000, percentile: 50 },
      jones: { count: 8000, percentile: 600 },
      garcia: { count: 20000, percentile: 200 },
      lopez: { count: 15000, percentile: 350 },
      rodriguez: { count: 14000, percentile: 320 }
    }
  }
}));

import { scoreName } from "../lib/rarity";

describe("scoreName", () => {
  it("scores common names with high confidence", () => {
    const result = scoreName("john smith");
    expect(result.confidence).toBe("high");
    expect(result.score ?? 0).toBeGreaterThan(0);
    expect(result.score ?? 0).toBeLessThanOrEqual(25);
    expect(result.label).toBe("common");
  });

  it("recognizes phonetic spelling variants without treating them as unrelated", () => {
    const base = scoreName("james smith");
    const variant = scoreName("jaymz smith");
    expect(variant.score ?? 0).toBeGreaterThan(base.score ?? 0);
    expect(variant.label).toBe(base.label);
    expect(variant.breakdown[0].matchStatus).toBe("phonetic");
    expect(variant.confidenceNotes.join(" ")).toMatch(/sounds like/i);
    expect(variant.confidenceNotes.join(" ")).toMatch(/james/i);
    expect(variant.confidenceNotes.join(" ")).toMatch(/jaymz/i);
    expect(variant.confidenceNotes.join(" ")).toMatch(/phonetic inference reduces confidence/i);
    expect({
      notes: variant.confidenceNotes,
      flags: variant.flags,
      firstBreakdown: variant.breakdown[0]
    }).toMatchInlineSnapshot(`
      {
        "firstBreakdown": {
          "matchStatus": "phonetic",
          "notes": [
            "phonetic match (double metaphone JMS)",
            "sounds like "james", but spelling is uncommon",
            "similarity 0.40 · edit distance 1 (≤2 for length 5)",
            "passed gates: length within ±2 and same first two letters",
          ],
          "rarityTier": "common",
          "source": "ssa",
          "token": "jaymz",
        },
        "flags": [
          "phonetic_match",
        ],
        "notes": [
          "Sounds like “james”, but spelling is uncommon (jaymz). Phonetic code JMS · similarity 0.40 · edit distance 1 (≤2). Passed gates: length within ±2 and same first two letters. The spelling itself is rare, even though the base name is common. That makes it a uniquely spelled james.",
          "Phonetic inference reduces confidence.",
        ],
      }
    `);
  });

  it("does not map jackson to john via phonetic shortcuts", () => {
    const result = scoreName("jackson smith");
    expect(result.breakdown[0].matchStatus).toBe("none");
    expect(result.confidenceNotes.join(" ")).not.toMatch(/sounds like/i);
    expect(result.flags).not.toContain("phonetic_match");
  });

  it("does not treat jay as a variant of joshua", () => {
    const result = scoreName("jay smith");
    expect(result.breakdown[0].matchStatus).toBe("match");
    expect(result.confidenceNotes.join(" ")).not.toMatch(/sounds like/i);
    expect(result.flags).not.toContain("phonetic_match");
  });

  it("does not describe john as a unique spelling of itself", () => {
    const result = scoreName("john smith");
    expect(result.confidenceNotes.join(" ")).not.toMatch(/unique/i);
    expect(result.breakdown[0].notes.join(" ")).not.toMatch(/unique/i);
  });

  it("limits junk-heavy inputs and surfaces flags", () => {
    const result = scoreName("skibidi skibidi-skibidi skibidi-skibidi x");
    expect(result.score ?? 0).toBeLessThanOrEqual(45);
    expect(result.confidence).toBe("low");
    expect(result.flags).toEqual(expect.arrayContaining([
      expect.stringMatching(/repetition_abuse|gibberish_token|hyphen_abuse/)
    ]));
  });

  it("caps score and confidence when last names are unknown", () => {
    const result = scoreName("jordan carter hallow");
    expect(result.score ?? 0).toBeLessThanOrEqual(45);
    expect(["common", "uncommon"]).toContain(result.label);
    expect(result.confidence).not.toBe("high");
    expect(result.flags).toEqual(expect.arrayContaining(["last_name_unmatched"]));
  });

  it("caps confidence when last names are missing", () => {
    const result = scoreName("aeon lucifer nightfall iii");
    expect(result.score ?? 0).toBeLessThanOrEqual(45);
    expect(result.label).not.toBe("extreme");
  });

  it("keeps hyphenated surnames reasonable and rewards coverage", () => {
    const result = scoreName("maria anne garcia-lopez jr");
    expect(result.label).not.toBe("extreme");
    expect(result.confidence).toBe("high");
    expect(result.flags).not.toContain("hyphen_abuse");
  });

  it("rejects invalid suffixes", () => {
    const result = scoreName("john smith iix");
    expect(result.flags).toContain("invalid_suffix");
    const suffixBreakdown = result.breakdown[3];
    expect(suffixBreakdown.matchStatus).toBe("none");
  });

  it("treats suffixes as minor modifiers", () => {
    const base = scoreName("john smith");
    const withSuffix = scoreName("john smith iv");
    expect(labelRank(withSuffix.label)).toBe(labelRank(base.label));
    expect(withSuffix.score ?? 0).toBeGreaterThanOrEqual(base.score ?? 0);
  });

  it("applies repetition penalties", () => {
    const result = scoreName("john john john");
    expect(result.flags).toContain("repetition_abuse");
    expect(result.score ?? 0).toBeLessThanOrEqual(45);
    expect(result.confidence).toBe("low");
  });

  it("prevents hyphen splitting from increasing rarity", () => {
    const base = scoreName("maria garcia");
    const mutated = scoreName("maria gar-cia");
    expect(mutated.score ?? 0).toBeLessThanOrEqual(base.score ?? 0);
    expect(labelRank(mutated.label)).toBeLessThanOrEqual(labelRank(base.label));
  });

  it("prevents hyphen splitting on rodriguez from increasing rarity", () => {
    const base = scoreName("jose rodriguez");
    const mutated = scoreName("jose rodr-iguez");
    expect(mutated.score ?? 0).toBeLessThanOrEqual(base.score ?? 0);
    expect(labelRank(mutated.label)).toBeLessThanOrEqual(labelRank(base.label));
  });

  it("honors special-case overrides with high confidence", () => {
    const result = scoreName("jaymz terrell ayde-hueg iv");
    expect(result.confidence).toBe("high");
    expect(["very rare", "extreme"]).toContain(result.label);
  });
});

function labelRank(label: string): number {
  if (label === "common") return 0;
  if (label === "uncommon") return 1;
  if (label === "rare") return 2;
  if (label === "very rare") return 3;
  if (label === "extreme") return 4;
  return -1;
}
