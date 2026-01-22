import { describe, expect, it } from "vitest";
import { detectSuffix, parseName, scoreName } from "../lib/rarity";

describe("detectSuffix", () => {
  it("detects roman numerals and jr/sr", () => {
    expect(detectSuffix("IV")).toBe("IV");
    expect(detectSuffix("jr")).toBe("jr");
    expect(detectSuffix("Sr")).toBe("Sr");
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
});

describe("scoreName", () => {
  it("returns stable score and label", () => {
    const result = scoreName("jaymz terrell ayde-hueg iv");
    expect(result.overallScore).toBe(74);
    expect(result.label).toBe("very rare");
    expect(result.partScores.find((part) => part.label === "Last")?.tier).toBe(10);
  });
});
