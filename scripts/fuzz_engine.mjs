import crypto from "node:crypto";

console.log("[fuzz] starting fuzz_engine.mjs");
console.log("[fuzz] node", process.version, "runs", process.env.RUNS, "seed", process.env.SEED);

// try to locate the scoring export without you having to remember exact paths.
// tsx can import ts files directly.
const CANDIDATE_IMPORTS = [
  "../lib/rarity.ts",
  "../lib/rarity.js",
  "../lib/scoring/engine.ts",
  "../lib/scoring/engine.js",
];

async function loadScoreFn() {
  const errors = [];

  for (const spec of CANDIDATE_IMPORTS) {
    try {
      const mod = await import(spec);

      // common export names
      const fn =
        mod.scoreName ||
        mod.score ||
        mod.analyzeName ||
        mod.default?.scoreName ||
        mod.default?.score ||
        mod.default;

      if (typeof fn === "function") {
        return fn;
      }

      // sometimes exports are nested
      if (mod.default && typeof mod.default.scoreName === "function") {
        return mod.default.scoreName;
      }

      errors.push(`${spec}: no function export found`);
    } catch (e) {
      errors.push(`${spec}: ${e?.message || String(e)}`);
    }
  }

  throw new Error(
    `could not import a scoring function. tried:\n- ${CANDIDATE_IMPORTS.join(
      "\n- "
    )}\n\nerrors:\n- ${errors.join("\n- ")}\n\nfix: export scoreName() from lib/rarity.ts (or update CANDIDATE_IMPORTS).`
  );
}

function makeRng(seed) {
  // deterministic rng so you can reproduce failures
  let state = crypto.createHash("sha256").update(seed).digest();
  let idx = 0;
  return () => {
    const a = state[idx % state.length];
    const b = state[(idx + 7) % state.length];
    const c = state[(idx + 13) % state.length];
    const x = (a ^ (b << 1) ^ (c >> 1)) & 255;
    state[idx % state.length] = x;
    idx++;
    return x / 255;
  };
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function normalizeSpaces(s) {
  return s.replace(/\s+/g, " ").trim();
}

function consonantMash(r, len) {
  const chars = "bcdfghjklmnpqrstvwxz";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(r() * chars.length)];
  return out;
}

function randomWord(r, minLen = 3, maxLen = 10) {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  const len = Math.floor(minLen + r() * (maxLen - minLen + 1));
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(r() * chars.length)];
  return out;
}

function unknownToken(r) {
  return consonantMash(r, randInt(r, 7, 12));
}

function pick(r, arr) {
  return arr[Math.floor(r() * arr.length)];
}

function coin(r, p = 0.5) {
  return r() < p;
}

function repeatToken(token, n) {
  return Array.from({ length: n }, () => token).join(" ");
}

const COMMON_FIRST = [
  "john",
  "james",
  "michael",
  "david",
  "robert",
  "maria",
  "anna",
  "emma",
  "sarah",
  "jose",
  "li",
  "mohammed",
  "alex",
  "jordan",
];

const COMMON_LAST = [
  "smith",
  "johnson",
  "williams",
  "brown",
  "jones",
  "garcia",
  "miller",
  "davis",
  "rodriguez",
  "martinez",
  "lopez",
  "nguyen",
];

const WEIRD = [
  "skibidi",
  "diddy",
  "aeon",
  "lucifer",
  "nightfall",
  "xqzpt",
  "vvvvvv",
  "orion",
  "calyx",
  "hallow",
  "gpt",
];

const ROMAN_OK = ["jr", "sr", "i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"];
const ROMAN_BAD = ["iix", "vx", "iiv", "xiix", "iiii", "vv", "srjr", "xviii"];

// seed corpus: real-looking inputs we will mutate aggressively
const SEED_CORPUS = [
  "john smith",
  "maria garcia",
  "maria anne garcia-lopez jr",
  "jose rodriguez",
  "mohammed ali",
  "li wang",
  "anna nguyen",
  "alex johnson",
  "jordan carter",
  "isaac newton sr",
  "aeon lucifer nightfall iii",
  "skibidi skibidi-skibidi skibidi-skibidi x",
  "jaymz terrell ayde-hueg iv",
];

function randInt(r, lo, hi) {
  return Math.floor(lo + r() * (hi - lo + 1));
}

function splitTokens(s) {
  return normalizeSpaces(s).split(" ").filter(Boolean);
}

function joinTokens(tokens) {
  return normalizeSpaces(tokens.join(" "));
}

function flipOneChar(r, token) {
  if (!token) return token;
  const i = randInt(r, 0, Math.max(0, token.length - 1));
  const chars = "abcdefghijklmnopqrstuvwxyz";
  const rep = chars[randInt(r, 0, chars.length - 1)];
  return token.slice(0, i) + rep + token.slice(i + 1);
}

function leetify(token) {
  if (typeof token !== "string") return token;
  return token
    .replace(/a/g, "4")
    .replace(/e/g, "3")
    .replace(/i/g, "1")
    .replace(/o/g, "0")
    .replace(/s/g, "5");
}

function injectHyphen(r, lastToken) {
  if (!lastToken) return lastToken;
  // split roughly in half, but keep both sides non-empty
  const cut = Math.max(1, Math.min(lastToken.length - 1, Math.floor(lastToken.length / 2)));
  return lastToken.slice(0, cut) + "-" + lastToken.slice(cut);
}

function addDiacriticVariant(token) {
  // tiny, deterministic-ish mapping: not perfect, just for stress testing
  const map = {
    a: "á",
    e: "é",
    i: "í",
    o: "ó",
    u: "ú",
    n: "ñ",
    c: "ç",
  };
  for (const k of Object.keys(map)) {
    if (token.includes(k)) return token.replace(k, map[k]);
  }
  return token;
}

function mutateName(r, base) {
  const tokens = splitTokens(base);
  if (tokens.length === 0) return { mutated: base, mutationType: "noop" };

  const kind = randInt(r, 1, 10);

  // 1) add junk token
  if (kind === 1) {
    tokens.push(pick(r, WEIRD));
    return { mutated: joinTokens(tokens), mutationType: "append_weird_token" };
  }

  // 2) repeat a random token 3x
  if (kind === 2) {
    const t = tokens[randInt(r, 0, tokens.length - 1)];
    return { mutated: joinTokens([t, t, t, ...tokens.slice(1)]), mutationType: "repeat_token" };
  }

  // 3) append bad roman suffix
  if (kind === 3) {
    tokens.push(pick(r, ROMAN_BAD));
    return { mutated: joinTokens(tokens), mutationType: "append_bad_suffix" };
  }

  // 4) append ok suffix
  if (kind === 4) {
    tokens.push(pick(r, ROMAN_OK));
    return { mutated: joinTokens(tokens), mutationType: "append_good_suffix" };
  }

  // 5) leetspeak one token
  if (kind === 5) {
    const idx = randInt(r, 0, tokens.length - 1);
    tokens[idx] = leetify(tokens[idx]);
    return { mutated: joinTokens(tokens), mutationType: "leetify_token" };
  }

  // 6) flip one char
  if (kind === 6) {
    const idx = randInt(r, 0, tokens.length - 1);
    tokens[idx] = flipOneChar(r, tokens[idx]);
    return { mutated: joinTokens(tokens), mutationType: "flip_char" };
  }

  // 7) inject hyphen into last token
  if (kind === 7) {
    const idx = tokens.length - 1;
    tokens[idx] = injectHyphen(r, tokens[idx]);
    return { mutated: joinTokens(tokens), mutationType: "inject_hyphen" };
  }

  // 8) hyphen abuse: add multiple hyphens to last
  if (kind === 8) {
    const idx = tokens.length - 1;
    const t = tokens[idx];
    tokens[idx] = `${t}-${pick(r, WEIRD)}-${pick(r, WEIRD)}`;
    return { mutated: joinTokens(tokens), mutationType: "hyphen_abuse" };
  }

  // 9) swap first/last token order
  if (kind === 9) {
    if (tokens.length >= 2) {
      const swapped = [...tokens];
      const a = swapped[0];
      swapped[0] = swapped[swapped.length - 1];
      swapped[swapped.length - 1] = a;
      return { mutated: joinTokens(swapped), mutationType: "swap_tokens" };
    }
    return { mutated: base, mutationType: "noop" };
  }

  // 10) diacritic variant on one token
  {
    const idx = randInt(r, 0, tokens.length - 1);
    tokens[idx] = addDiacriticVariant(tokens[idx]);
    return { mutated: joinTokens(tokens), mutationType: "diacritic_variant" };
  }
}

function labelRank(label) {
  const l = String(label || "").toLowerCase();
  if (l === "unknown") return -1;
  if (l === "common") return 0;
  if (l === "uncommon") return 1;
  if (l === "rare") return 2;
  if (l === "very rare") return 3;
  if (l === "extreme") return 4;
  return -1;
}

function genCase(r) {
  // build adversarial-ish names that try to poke holes
  const first = coin(r, 0.55)
    ? pick(r, COMMON_FIRST)
    : coin(r, 0.5)
      ? pick(r, WEIRD)
      : consonantMash(r, Math.floor(6 + r() * 10));

  const middle = coin(r, 0.45)
    ? pick(r, COMMON_FIRST)
    : coin(r, 0.5)
      ? pick(r, WEIRD)
      : randomWord(r, 3, 12);

  let last;
  if (coin(r, 0.55)) {
    last = pick(r, COMMON_LAST);
  } else if (coin(r, 0.6)) {
    // hyphen cases, sometimes abusive
    const a = pick(r, COMMON_LAST);
    const b = coin(r, 0.5) ? pick(r, COMMON_LAST) : pick(r, WEIRD);
    const c = coin(r, 0.25) ? pick(r, WEIRD) : null;
    last = c ? `${a}-${b}-${c}` : `${a}-${b}`;
  } else {
    last = coin(r, 0.5) ? pick(r, WEIRD) : consonantMash(r, Math.floor(6 + r() * 14));
  }

  // repetition abuse
  if (coin(r, 0.08)) {
    const t = coin(r, 0.5) ? pick(r, WEIRD) : pick(r, COMMON_FIRST);
    const suffix = coin(r, 0.5) ? pick(r, ROMAN_OK) : "";
    return normalizeSpaces(`${repeatToken(t, 3)} ${coin(r, 0.5) ? last : pick(r, COMMON_LAST)} ${suffix}`);
  }

  // too many tokens
  const extra = coin(r, 0.12) ? `${pick(r, WEIRD)} ${pick(r, WEIRD)}` : "";

  const suffix = coin(r, 0.45) ? (coin(r, 0.8) ? pick(r, ROMAN_OK) : pick(r, ROMAN_BAD)) : "";

  return normalizeSpaces(`${first} ${coin(r, 0.6) ? middle : ""} ${last} ${extra} ${suffix}`);
}

function getScore(res) {
  if (res == null) return null;
  if (typeof res === "number") return res;
  if (typeof res.score === "number") return res.score;
  if (typeof res.finalScore === "number") return res.finalScore;
  return null;
}

function getConfidence(res) {
  if (!res) return null;
  if (typeof res.confidenceValue === "number") return res.confidenceValue;
  if (res.confidence && typeof res.confidence.value === "number") return res.confidence.value;
  return null;
}

function getFlags(res) {
  if (!res) return [];
  if (Array.isArray(res.flags)) return res.flags;
  if (Array.isArray(res.junkFlags)) return res.junkFlags;
  return [];
}

function getLabel(res) {
  return res?.label ?? res?.rarityLabel ?? null;
}

function smellsLikeJunk(input) {
  const hyphens = input.match(/-/g)?.length ?? 0;
  const hasHyphenAbuse = /--/.test(input) || hyphens >= 3 || /\b\w+-\w+-\w+\b/.test(input);
  const hasRepeats = /(\b\w+\b)\s+\1\s+\1/i.test(input);
  const hasMash = /\b[bcdfghjklmnpqrstvwxz]{6,}\b/i.test(input);
  const hasBadRoman = /(\biix\b|\bvx\b|\biiv\b|\biiii\b|\bvv\b)/i.test(input);
  return { hasHyphenAbuse, hasRepeats, hasMash, hasBadRoman, any: hasHyphenAbuse || hasRepeats || hasMash || hasBadRoman };
}

function isWeakPoint(input, res) {
  const score = getScore(res);
  const conf = getConfidence(res);
  const flags = getFlags(res);
  const label = getLabel(res);

  if (score == null) return false;

  // invariant 1: high score must not happen with low confidence
  if (conf != null && score >= 70 && conf < 0.7) return true;

  // invariant 2: if it smells like junk, flags must exist and/or score must be capped
  const junk = smellsLikeJunk(input);
  if (junk.any) {
    const flagged = flags.length > 0;
    const capped = conf != null && conf < 0.35 ? score <= 45 : true;
    if (!flagged && (label === "very rare" || label === "extreme" || score >= 80)) return true;
    if (!capped && conf != null && conf < 0.35) return true;
  }

  // invariant 3: invalid roman should not boost silently
  if (smellsLikeJunk(input).hasBadRoman && flags.length === 0 && score >= 50) return true;

  // invariant 4: if there are obvious leetspeak / spoof chars, either flags exist or confidence should drop
  if (/[01345]/.test(input)) {
    // we don't require a specific flag name, but we do require it not to get a clean bill of health
    if (flags.length === 0 && conf != null && conf >= 0.85 && score >= 60) return true;
  }

  // invariant 5: hyphen abuse should never land in very rare/extreme without flags
  if (smellsLikeJunk(input).hasHyphenAbuse) {
    if (flags.length === 0 && (label === "very rare" || label === "extreme" || score >= 80)) return true;
  }

  return false;
}

function summarize(res) {
  const score = getScore(res);
  const conf = getConfidence(res);
  return {
    score,
    label: getLabel(res),
    confidence: conf == null ? null : Math.round(clamp(conf, 0, 1) * 1000) / 1000,
    flags: getFlags(res),
  };
}

function detailedResult(res) {
  if (!res) return null;
  return {
    score: getScore(res),
    label: getLabel(res),
    confidenceValue: getConfidence(res),
    flags: getFlags(res),
    reasons: res.reasons ?? [],
    parts: res.parts ?? null,
    breakdown: res.breakdown ?? null,
    penaltiesApplied: res.penaltiesApplied ?? [],
    capsApplied: res.capsApplied ?? [],
    confidenceNotes: res.confidenceNotes ?? [],
  };
}

const RUNS = Number(process.env.RUNS || 25000);
const SEED = process.env.SEED || "jay-fuzz";
const PRINT_LIMIT = Number(process.env.PRINT_LIMIT || 40);

const r = makeRng(SEED);
let scoreName;
try {
  scoreName = await loadScoreFn();
  console.log("[fuzz] loaded scoring function ok");
} catch (e) {
  console.error("[fuzz] failed to load scoring function\n", e);
  process.exit(1);
}

let weak = 0;
let printed = 0;
let crashed = 0;

// directed fuzz: mutate a corpus and look for score increases or label jumps
const MUTATIONS_PER_SEED = Number(process.env.MUTATIONS_PER_SEED || 80);
const TOP_SUSPICIOUS = Number(process.env.TOP_SUSPICIOUS || 50);
const suspicious = [];

async function safeScore(input) {
  try {
    const res = await scoreName(input);
    return res;
  } catch (e) {
    crashed++;
    return null;
  }
}

function recordSuspicious(entry) {
  suspicious.push({
    ...entry,
    baseDetails: detailedResult(entry.baseRes),
    mutDetails: detailedResult(entry.mutRes),
  });
}

for (const base of SEED_CORPUS) {
  const baseRes = await safeScore(base);
  const baseScore = getScore(baseRes);
  const baseLabel = getLabel(baseRes);
  const baseConf = getConfidence(baseRes);
  const baseTokens = splitTokens(base);

  const directedMutations = [];
  if (baseTokens.length === 2) {
    const unknown = unknownToken(r);
    directedMutations.push({
      mutated: joinTokens([...baseTokens, unknown]),
      mutationType: "append_unknown_last",
      mutationMeta: { unknown },
    });
    const movedUnknown = unknownToken(r);
    directedMutations.push({
      mutated: joinTokens([baseTokens[0], baseTokens[1], movedUnknown]),
      mutationType: "move_last_to_middle",
      mutationMeta: { unknown: movedUnknown },
    });
  }
  if (baseTokens.length >= 2 && COMMON_LAST.includes(baseTokens[baseTokens.length - 1])) {
    const last = baseTokens[baseTokens.length - 1];
    directedMutations.push({
      mutated: joinTokens([...baseTokens.slice(0, -1), injectHyphen(r, last)]),
      mutationType: "hyphen_split_last",
      mutationMeta: { last },
    });
  }

  for (const mutation of directedMutations) {
    const mutRes = await safeScore(mutation.mutated);
    const s1 = getScore(mutRes);
    const l1 = getLabel(mutRes);
    const c1 = getConfidence(mutRes);
    const f1 = getFlags(mutRes);
    const reasons = [];
    const scoreUp = s1 != null && baseScore != null ? s1 - baseScore : 0;
    const labelUp = labelRank(l1) - labelRank(baseLabel);

    if (mutation.mutationType === "append_unknown_last" || mutation.mutationType === "move_last_to_middle") {
      if (scoreUp > 0) reasons.push("score_increased_after_unknown_append");
      if (labelUp > 0) reasons.push("label_increased_after_unknown_append");
      if (c1 != null && baseConf != null && c1 > baseConf) reasons.push("confidence_increased_after_unknown_append");
    }
    if (mutation.mutationType === "hyphen_split_last") {
      if (scoreUp > 0) reasons.push("score_increased_after_hyphen_insert");
      if (labelUp > 0) reasons.push("label_increased_after_hyphen_insert");
    }
    if (smellsLikeJunk(mutation.mutated).any && (labelRank(l1) >= 3 || (s1 ?? 0) >= 80) && f1.length === 0) {
      reasons.push("junk_unflagged_high");
    }
    if (reasons.length) {
      recordSuspicious({
        base,
        mutated: mutation.mutated,
        baseRes,
        mutRes,
        baseSummary: summarize(baseRes),
        mutSummary: summarize(mutRes),
        scoreDelta: scoreUp,
        labelDelta: labelUp,
        reasons,
        mutationType: mutation.mutationType,
        mutationMeta: mutation.mutationMeta,
      });
    }
  }

  for (let k = 0; k < MUTATIONS_PER_SEED; k++) {
    let mutation;
    try {
      mutation = mutateName(r, base);
    } catch (e) {
      crashed++;
      continue;
    }
    const mutRes = await safeScore(mutation.mutated);

    const s0 = baseScore;
    const s1 = getScore(mutRes);
    const l0 = baseLabel;
    const l1 = getLabel(mutRes);
    const c0 = baseConf;
    const c1 = getConfidence(mutRes);
    const f1 = getFlags(mutRes);

    // monotonicity: adding junk should usually not raise score
    const likelyAddedJunk = mutation.mutated.length > base.length || /-/.test(mutation.mutated) || /(\b\w+\b)\s+\1\s+\1/i.test(mutation.mutated);

    if (s0 != null && s1 != null) {
      const scoreUp = s1 - s0;
      const labelUp = labelRank(l1) - labelRank(l0);

      // suspicious conditions
      const reasons = [];
      if (likelyAddedJunk && scoreUp >= 8) reasons.push("score_increased_after_mutation");
      if (likelyAddedJunk && labelUp >= 1) reasons.push("label_increased_after_mutation");
      if (c1 != null && s1 >= 70 && c1 < 0.7) reasons.push("high_score_low_confidence");
      if (smellsLikeJunk(mutation.mutated).any && (labelRank(l1) >= 3 || s1 >= 80) && f1.length === 0) {
        reasons.push("junk_unflagged_high");
      }

      if (reasons.length) {
        recordSuspicious({
          base,
          mutated: mutation.mutated,
          mutationType: mutation.mutationType,
          baseSummary: summarize(baseRes),
          mutSummary: summarize(mutRes),
          scoreDelta: scoreUp,
          labelDelta: labelUp,
          reasons,
          baseRes,
          mutRes,
        });
      }
    }
  }
}

for (let i = 0; i < RUNS; i++) {
  const input = genCase(r);
  let res;

  try {
    res = await scoreName(input);
  } catch (e) {
    crashed++;
    continue;
  }

  if (isWeakPoint(input, res)) {
    weak++;
    if (printed < PRINT_LIMIT) {
      printed++;
      console.log("\n--- weak point candidate ---");
      console.log("input:", input);
      console.log("summary:", summarize(res));
    }
  }
}

// report top suspicious cases first
if (suspicious.length) {
  suspicious.sort((a, b) => (b.scoreDelta || 0) - (a.scoreDelta || 0));
  console.log("\n============================");
  console.log("top suspicious cases (directed mutations):");

  const top = suspicious.slice(0, TOP_SUSPICIOUS);
  for (let i = 0; i < top.length; i++) {
    const it = top[i];
    console.log("\n--- suspicious ---");
    console.log("reasons:", it.reasons.join(", "));
    if (it.mutationType) {
      console.log("mutation:", it.mutationType, it.mutationMeta ?? "");
    }
    console.log("base:", it.base);
    console.log("base summary:", it.baseSummary);
    console.log("base details:", it.baseDetails);
    console.log("mut :", it.mutated);
    console.log("mut summary:", it.mutSummary);
    console.log("mut details:", it.mutDetails);
    console.log("delta:", { score: it.scoreDelta, label: it.labelDelta });
  }
}

console.log("\n============================");
console.log(`scanned: ${RUNS}`);
console.log(`weak candidates: ${weak}`);
console.log(`crashes: ${crashed}`);
console.log(`seed: ${SEED}`);
console.log(`mutations_per_seed: ${MUTATIONS_PER_SEED}`);
console.log(`seed_corpus: ${SEED_CORPUS.length}`);
console.log("tip: reproduce by rerunning with the same SEED and lowering RUNS.");

console.log("[fuzz] done");
