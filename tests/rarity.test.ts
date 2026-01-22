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
      anne: { count: 12000, percentile: 300 }
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

import { detectSuffix, parseName, scoreName } from "../lib/rarity";

describe("detectSuffix", () => {
  it("detects roman numerals and jr/sr", () => {
    expect(detectSuffix("IV")).toBe("iv");
    expect(detectSuffix("jr")).toBe("jr");
    expect(detectSuffix("Sr")).toBe("sr");
    expect(detectSuffix("x")).toBe("x");
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

describe("scoreName", () => {
  it("scores common names with high confidence", () => {
    const result = scoreName("john smith");
    expect(["common", "uncommon"]).toContain(result.label);
    expect(result.confidence).toBe("high");
  });

  it("limits junk-heavy inputs and surfaces flags", () => {
    const result = scoreName("skibidi skibidi-skibidi skibidi-skibidi x");
    expect(result.score ?? 0).toBeLessThanOrEqual(45);
    expect(result.flags.length).toBeGreaterThan(0);
  });

  it("caps confidence when last names are missing", () => {
    const result = scoreName("aeon lucifer nightfall iii");
    expect(result.confidence).toBe("low");
    expect(result.score ?? 0).toBeLessThanOrEqual(45);
  });

  it("keeps hyphenated surnames reasonable", () => {
    const result = scoreName("maria anne garcia-lopez jr");
    expect(result.score ?? 0).toBeLessThan(90);
    expect(["common", "uncommon", "rare", "very rare"]).toContain(result.label);
  });

  it("rejects invalid suffixes", () => {
    const result = scoreName("john smith iix");
    expect(result.flags).toContain("invalid_suffix");
  });

  it("applies repetition penalties", () => {
    const result = scoreName("john john john");
    expect(result.flags).toContain("repetition_abuse");
    expect(result.confidence).toBe("low");
  });
});
