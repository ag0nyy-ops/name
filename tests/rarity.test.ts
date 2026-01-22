import { describe, expect, it } from "vitest";
import { detectSuffix, parseName, scoreName } from "../lib/rarity";

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

  it("normalizes punctuation and whitespace", () => {
    const parsed = parseName("  JAYmz   Terrell,  Ayde-Hueg  IV  ");
    expect(parsed.raw).toBe("jaymz terrell ayde-hueg iv");
    expect(parsed.display).toBe("JAYmz Terrell Ayde-Hueg IV");
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
    const result = scoreName("jaymz terrell");
    expect(result.overallScore).toBeLessThanOrEqual(60);
    expect(result.label).not.toBe("very rare");
    expect(result.label).not.toBe("extreme");
  });

  it("handles hyphenated surnames with a baseline tier and lower confidence", () => {
    const result = scoreName("maria louise smith-jones");
    const last = result.partScores.find((part) => part.label === "Last");
    expect(last?.tier).toBeGreaterThanOrEqual(7);
    expect(last?.confidence).toBe("low");
  });

  it("keeps common names out of rare labels", () => {
    const result = scoreName("john smith");
    expect(["common", "uncommon"]).toContain(result.label);
  });

  it("returns a high score for rare full names", () => {
    const result = scoreName("jaymz terrell ayde-hueg iv");
    expect(result.overallScore).toBeGreaterThanOrEqual(70);
    expect(["very rare", "extreme"]).toContain(result.label);
    expect(result.partScores.find((part) => part.label === "Last")?.tier).toBe(10);
  });
});
