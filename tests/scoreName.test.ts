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
      jay: { count: 2000, percentile: 1500 },
      jaymz: { count: 50, percentile: 9800 },
      terrell: { count: 200, percentile: 9000 },
      maria: { count: 8000, percentile: 600 },
      anne: { count: 12000, percentile: 300 },
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
      lopez: { count: 15000, percentile: 350 }
    }
  }
}));

import { scoreName } from "../lib/rarity";

describe("scoreName", () => {
  it("scores common names with high confidence", () => {
    const result = scoreName("john smith");
    expect(result.confidence).toBe("high");
    expect(result.score ?? 0).toBeLessThanOrEqual(19);
    expect(result.label).toBe("common");
  });

  it("limits junk-heavy inputs and surfaces flags", () => {
    const result = scoreName("skibidi skibidi-skibidi skibidi-skibidi x");
    expect(result.score ?? 0).toBeLessThanOrEqual(45);
    expect(result.confidence).toBe("low");
    expect(result.flags).toEqual(expect.arrayContaining([
      expect.stringMatching(/repetition_abuse|gibberish_token|hyphen_abuse/)
    ]));
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

  it("applies repetition penalties", () => {
    const result = scoreName("john john john");
    expect(result.flags).toContain("repetition_abuse");
    expect(result.score ?? 0).toBeLessThanOrEqual(45);
  });

  it("honors special-case overrides with high confidence", () => {
    const result = scoreName("jaymz terrell ayde-hueg iv");
    expect(result.confidence).toBe("high");
    expect(["very rare", "extreme"]).toContain(result.label);
  });
});
