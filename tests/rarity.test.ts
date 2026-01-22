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
      terrell: { count: 200, percentile: 9000 }
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
      jones: { count: 8000, percentile: 600 }
    }
  }
}));

import { detectSuffix, parseName, scoreJunk, scoreName } from "../lib/rarity";

describe("detectSuffix", () => {
  it("detects roman numerals and jr/sr", () => {
    expect(detectSuffix("IV")).toBe("iv");
    expect(detectSuffix("jr")).toBe("jr");
    expect(detectSuffix("Sr")).toBe("sr");
    expect(detectSuffix("xx")).toBe("xx");
    expect(detectSuffix("abc")).toBeUndefined();
  });
});

describe("parseName", () => {
  it("splits first middle last and suffix", () => {
    const parsed = parseName("jaymz terrell ayde-hueg iv");
    expect(parsed.first).toBe("jaymz");
    expect(parsed.middle).toBe("terrell");
    expect(parsed.last).toBe("ayde-hueg");
    expect(parsed.suffix).toBe("iv");
  });

  it("normalizes punctuation and whitespace while keeping hyphens and apostrophes", () => {
    const parsed = parseName("  JAYmz   Terrell,  O'Neill  IV  ");
    expect(parsed.raw).toBe("jaymz terrell o'neill iv");
    expect(parsed.display).toBe("JAYmz Terrell O'Neill IV");
  });
});

describe("scoreJunk", () => {
  it("blocks digits and disallowed characters", () => {
    const result = scoreJunk("john 123");
    expect(result.verdict).toBe("block");
    expect(result.score).toBeGreaterThanOrEqual(85);
  });

  it("warns on repeated characters", () => {
    const result = scoreJunk("aaaaaa");
    expect(result.verdict).toBe("warn");
  });
});

describe("scoreName", () => {
  it("caps single-token inputs and marks low confidence", () => {
    const result = scoreName("jay");
    expect(result.overallScore).toBeLessThanOrEqual(45);
    expect(["common", "uncommon"]).toContain(result.label);
    expect(result.confidence).toBe("low");
  });

  it("caps missing last name inputs and avoids extreme labels", () => {
    const result = scoreName("jaymz iv");
    expect(result.overallScore).toBeLessThanOrEqual(60);
    expect(["common", "uncommon", "rare"]).toContain(result.label);
    expect(result.reasonCodes).toContain("NO_LAST_NAME");
  });

  it("keeps common names out of rare labels", () => {
    const result = scoreName("john smith");
    expect(["common", "uncommon"]).toContain(result.label);
  });

  it("returns a high score for rare full names with special-case last names", () => {
    const result = scoreName("jaymz terrell ayde-hueg iv");
    expect(result.status).toBe("scored");
    expect(result.overallScore).toBeGreaterThanOrEqual(70);
    expect(["very rare", "extreme"]).toContain(result.label);
    expect(result.partScores.find((part) => part.label === "Last")?.tier).toBe(10);
    expect(result.reasonCodes).toContain("SPECIAL_CASE_OVERRIDE");
  });
});
