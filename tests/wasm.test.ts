// Runs the compiled engine (npm run build:engine) the way the browser does.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Engine, initSync, modelVersion } from "../lib/wasm/engine.js";
import { MODEL_VERSION, type NameResult } from "../lib/engine";
import specialCases from "../data/specialCases.json";

const read = (path: string) => readFileSync(new URL(path, import.meta.url));
initSync({ module: read("../lib/wasm/engine_bg.wasm") });
const engine = new Engine(
  read("../public/data/ssa-first-names.json").toString(),
  read("../public/data/census-surnames.json").toString(),
  JSON.stringify(specialCases)
);
const score = (name: string) => JSON.parse(engine.score(name)) as NameResult;

describe("wasm engine", () => {
  it("matches the model version the site shows", () => {
    expect(modelVersion()).toBe(MODEL_VERSION);
  });

  it("returns the fields the UI reads", () => {
    const result = score("José García");
    expect(result.status).toBe("ok");
    expect(result.mode).toBe("full");
    expect(result.confidence).toBe("high");
    expect(result.first?.match).toBe("exact");
    expect(result.last?.dataset).toBe("census");
    expect(result.estimate?.people).toBeGreaterThan(1000);
    expect(result.label).toBe("common");
  });

  it("orders names from common to rare", () => {
    const scores = ["John Smith", "Jay Patty", "Elon Musk", "Barack Obama"].map(
      (n) => score(n).score ?? 0
    );
    expect(scores).toEqual([...scores].sort((a, b) => a - b));
  });

  it("handles blank, non-Latin and nonsense input", () => {
    expect(score("").status).toBe("empty");
    expect(score("李 小龍").status).toBe("unsupported");
    expect(score("asdfgh qwerty").status).toBe("unknown");
  });

  it("rejects broken table JSON instead of crashing", () => {
    expect(() => new Engine("{", "{}", "")).toThrow();
  });
});
