import { describe, expect, it } from "vitest";
import { scoreName } from "../lib/rarity";

// Runs against the real generated tables (no mocks).
describe("scoreName with real data", () => {
  it("rates very common names as common", () => {
    const r = scoreName("John Smith");
    expect(r.label).toBe("common");
    expect(r.confidence).toBe("high");
  });

  it("does not call a first name shared by a few thousand people common", () => {
    const common = scoreName("Emma Coleman").score ?? 0;
    const rarer = scoreName("Zendaya Coleman").score ?? 0;
    expect(rarer).toBeGreaterThan(common);
    expect(scoreName("Zendaya Coleman").label).not.toBe("common");
  });

  it("never claims more people than the US population", () => {
    const r = scoreName("Elon Musk");
    expect(r.estimate).not.toMatch(/1 in/);
    expect(r.estimate).toMatch(/fewer than 1|roughly [\d,.]+ (person|people)/);
  });

  it("refuses to score gibberish", () => {
    expect(scoreName("Qwerty Asdf").score).toBeNull();
  });
});
