// Renders the result views for every kind of result the engine returns,
// so a field the UI reads can't silently go missing.
import { readFileSync } from "node:fs";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Result } from "../components/NameAnalyzer";
import { ShareCard } from "../components/ShareCard";
import type { NameResult } from "../lib/engine";
import { Engine, initSync } from "../lib/wasm/engine.js";
import specialCases from "../data/specialCases.json";

const read = (path: string) => readFileSync(new URL(path, import.meta.url));
initSync({ module: read("../lib/wasm/engine_bg.wasm") });
const engine = new Engine(
  read("../public/data/ssa-first-names.json").toString(),
  read("../public/data/census-surnames.json").toString(),
  JSON.stringify(specialCases)
);
const score = (name: string) => JSON.parse(engine.score(name)) as NameResult;

const NAMES = [
  "John Smith",
  "Jay Q Patty",
  "Mary Garcia-Lopez",
  "Jan van der Brueggenkamp",
  "Mary Ayde-Hueg",
  "Taylor",
  "Braydyn",
  "asdfgh qwerty",
  "李 小龍",
  "Smith, John Jr."
];

describe("result views", () => {
  for (const name of NAMES) {
    it(`renders ${name}`, () => {
      const result = score(name);
      const html = renderToString(
        <Result result={result} onCopy={() => {}} copied={false} />
      );
      expect(html).toContain(result.display.replace(/'/g, "&#x27;"));
      if (result.score !== null) {
        expect(html).toContain("confidence");
        expect(renderToString(<ShareCard result={result} />)).toContain(
          "Download PNG"
        );
      } else {
        expect(html).toContain("No score");
      }
    });
  }
});
