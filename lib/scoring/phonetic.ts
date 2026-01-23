export type PhoneticCandidate = {
  name: string;
  count: number;
  percentile: number;
  length: number;
};

export type PhoneticIndex = Map<string, PhoneticCandidate[]>;

export type PhoneticMatch = {
  code: string;
  name: string;
  count: number;
  percentile: number;
  similarity: number;
  distance: number;
  threshold: number;
  lengthDelta: number;
  gateSummary: string;
};

type FrequencyTable = {
  percentileScale: number;
  names: Record<string, { count: number; percentile: number }>;
};

const VOWELS = new Set(["a", "e", "i", "o", "u", "y"]);

export function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").normalize("NFC");
}

function normalizePhoneticInput(value: string): string {
  return stripDiacritics(value).toLowerCase().replace(/[^a-z]/g, "");
}

function normalizeForDistance(value: string): string {
  const normalized = normalizePhoneticInput(value);
  const stripped = normalized.replace(/[aeiouy]/g, "");
  return stripped.length >= 2 ? stripped : normalized;
}

function isVowel(char?: string): boolean {
  if (!char) return false;
  return VOWELS.has(char);
}

function appendCode(existing: string, code: string): string {
  if (!code) return existing;
  const last = existing.slice(-code.length);
  if (last === code) return existing;
  return existing + code;
}

export function doubleMetaphone(value: string): { primary: string; secondary: string } {
  const input = normalizePhoneticInput(value);
  if (!input) return { primary: "", secondary: "" };

  let primary = "";
  let secondary = "";
  let index = 0;

  const length = input.length;

  while (index < length) {
    const char = input[index];
    const next = input[index + 1];
    const prev = input[index - 1];
    const next2 = input[index + 2];

    switch (char) {
      case "a":
      case "e":
      case "i":
      case "o":
      case "u":
      case "y":
        if (index === 0) {
          primary = appendCode(primary, "A");
          secondary = appendCode(secondary, "A");
        }
        index += 1;
        break;
      case "b":
        primary = appendCode(primary, "P");
        secondary = appendCode(secondary, "P");
        index += next === "b" ? 2 : 1;
        break;
      case "c":
        if (next === "h") {
          primary = appendCode(primary, "X");
          secondary = appendCode(secondary, "X");
          index += 2;
        } else if (next === "i" || next === "e" || next === "y") {
          primary = appendCode(primary, "S");
          secondary = appendCode(secondary, "S");
          index += 2;
        } else {
          primary = appendCode(primary, "K");
          secondary = appendCode(secondary, "K");
          index += next === "c" ? 2 : 1;
        }
        break;
      case "d":
        if (next === "g" && (next2 === "e" || next2 === "i" || next2 === "y")) {
          primary = appendCode(primary, "J");
          secondary = appendCode(secondary, "J");
          index += 3;
        } else {
          primary = appendCode(primary, "T");
          secondary = appendCode(secondary, "T");
          index += next === "d" ? 2 : 1;
        }
        break;
      case "f":
        primary = appendCode(primary, "F");
        secondary = appendCode(secondary, "F");
        index += next === "f" ? 2 : 1;
        break;
      case "g":
        if (next === "h") {
          if (index > 0 && !isVowel(prev)) {
            index += 2;
          } else {
            primary = appendCode(primary, "F");
            secondary = appendCode(secondary, "F");
            index += 2;
          }
        } else if (next === "n") {
          primary = appendCode(primary, "KN");
          secondary = appendCode(secondary, "N");
          index += 2;
        } else if (next === "e" || next === "i" || next === "y") {
          primary = appendCode(primary, "J");
          secondary = appendCode(secondary, "J");
          index += 2;
        } else {
          primary = appendCode(primary, "K");
          secondary = appendCode(secondary, "K");
          index += next === "g" ? 2 : 1;
        }
        break;
      case "h":
        if (!isVowel(prev) && isVowel(next)) {
          primary = appendCode(primary, "H");
          secondary = appendCode(secondary, "H");
        }
        index += 1;
        break;
      case "j":
        primary = appendCode(primary, "J");
        secondary = appendCode(secondary, "J");
        index += next === "j" ? 2 : 1;
        break;
      case "k":
        primary = appendCode(primary, "K");
        secondary = appendCode(secondary, "K");
        index += next === "k" ? 2 : 1;
        break;
      case "l":
        primary = appendCode(primary, "L");
        secondary = appendCode(secondary, "L");
        index += next === "l" ? 2 : 1;
        break;
      case "m":
        primary = appendCode(primary, "M");
        secondary = appendCode(secondary, "M");
        index += next === "m" ? 2 : 1;
        break;
      case "n":
        primary = appendCode(primary, "N");
        secondary = appendCode(secondary, "N");
        index += next === "n" ? 2 : 1;
        break;
      case "p":
        if (next === "h") {
          primary = appendCode(primary, "F");
          secondary = appendCode(secondary, "F");
          index += 2;
        } else {
          primary = appendCode(primary, "P");
          secondary = appendCode(secondary, "P");
          index += next === "p" ? 2 : 1;
        }
        break;
      case "q":
        primary = appendCode(primary, "K");
        secondary = appendCode(secondary, "K");
        index += next === "q" ? 2 : 1;
        break;
      case "r":
        primary = appendCode(primary, "R");
        secondary = appendCode(secondary, "R");
        index += next === "r" ? 2 : 1;
        break;
      case "s":
        if (next === "h") {
          primary = appendCode(primary, "X");
          secondary = appendCode(secondary, "X");
          index += 2;
        } else if (next === "i" && (next2 === "o" || next2 === "a")) {
          primary = appendCode(primary, "X");
          secondary = appendCode(secondary, "X");
          index += 3;
        } else {
          primary = appendCode(primary, "S");
          secondary = appendCode(secondary, "S");
          index += next === "s" ? 2 : 1;
        }
        break;
      case "t":
        if (next === "h") {
          primary = appendCode(primary, "0");
          secondary = appendCode(secondary, "T");
          index += 2;
        } else if (next === "i" && (next2 === "o" || next2 === "a")) {
          primary = appendCode(primary, "X");
          secondary = appendCode(secondary, "X");
          index += 3;
        } else if (next === "c" && next2 === "h") {
          index += 3;
        } else {
          primary = appendCode(primary, "T");
          secondary = appendCode(secondary, "T");
          index += next === "t" ? 2 : 1;
        }
        break;
      case "v":
        primary = appendCode(primary, "F");
        secondary = appendCode(secondary, "F");
        index += next === "v" ? 2 : 1;
        break;
      case "w":
        if (isVowel(next)) {
          primary = appendCode(primary, "W");
          secondary = appendCode(secondary, "W");
        }
        index += 1;
        break;
      case "x":
        primary = appendCode(primary, "KS");
        secondary = appendCode(secondary, "KS");
        index += 1;
        break;
      case "z":
        primary = appendCode(primary, "S");
        secondary = appendCode(secondary, "S");
        index += next === "z" ? 2 : 1;
        break;
      default:
        index += 1;
        break;
    }
  }

  return {
    primary: primary.slice(0, 6),
    secondary: secondary.slice(0, 6)
  };
}

export function buildPhoneticIndex(table: FrequencyTable): PhoneticIndex {
  const index: PhoneticIndex = new Map();
  Object.entries(table.names).forEach(([name, entry]) => {
    const normalized = normalizePhoneticInput(name);
    if (!normalized) return;
    const codes = doubleMetaphone(normalized);
    const codeList = Array.from(new Set([codes.primary, codes.secondary].filter(Boolean)));
    const candidate: PhoneticCandidate = {
      name,
      count: entry.count,
      percentile: entry.percentile / table.percentileScale,
      length: normalized.length
    };
    codeList.forEach((code) => {
      const existing = index.get(code) ?? [];
      existing.push(candidate);
      index.set(code, existing);
    });
  });
  return index;
}

export function editDistanceThreshold(length: number): number {
  if (length <= 6) return 2;
  if (length <= 10) return 3;
  return 4;
}

export function levenshteinDistance(a: string, b: string): number {
  const aLen = a.length;
  const bLen = b.length;
  if (aLen === 0) return bLen;
  if (bLen === 0) return aLen;

  const matrix = Array.from({ length: aLen + 1 }, () => new Array(bLen + 1).fill(0));
  for (let i = 0; i <= aLen; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= bLen; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= aLen; i += 1) {
    for (let j = 1; j <= bLen; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[aLen][bLen];
}

export function stringSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(a, b) / maxLen;
}

function passesSemanticSanity(inputLength: number, candidateLength: number, similarity: number, distance: number): boolean {
  const lengthDelta = Math.abs(inputLength - candidateLength);
  const longToShort = inputLength >= 7 && candidateLength <= 5;
  if (longToShort || lengthDelta >= 4) {
    return similarity >= 0.92 && distance <= 2;
  }
  return true;
}

export function findPhoneticMatch(value: string, index: PhoneticIndex): PhoneticMatch | undefined {
  const normalized = normalizePhoneticInput(value);
  if (!normalized) return undefined;

  const { primary, secondary } = doubleMetaphone(normalized);
  const codeList = Array.from(new Set([primary, secondary].filter(Boolean)));
  if (codeList.length === 0) return undefined;

  const candidates = codeList.flatMap((code) => (index.get(code) ?? []).map((candidate) => ({ code, candidate })));
  if (candidates.length === 0) return undefined;

  const inputLength = normalized.length;
  const threshold = editDistanceThreshold(inputLength);
  const firstTwo = normalized.slice(0, 2);
  const distanceInput = normalizeForDistance(normalized);

  let best: PhoneticMatch | undefined;

  candidates.forEach(({ code, candidate }) => {
    const lengthDelta = Math.abs(candidate.length - inputLength);
    const candidateDistance = normalizeForDistance(candidate.name);
    const distance = levenshteinDistance(distanceInput, candidateDistance);
    if (distance > threshold) return;

    const similarity = stringSimilarity(normalized, candidate.name);
    const firstTwoMatch = firstTwo.length === 2 && candidate.name.startsWith(firstTwo);
    const lengthGate = lengthDelta <= 2 && firstTwoMatch;
    const similarityGate = similarity >= 0.92;
    if (!(lengthGate || similarityGate)) return;
    if (!passesSemanticSanity(inputLength, candidate.length, similarity, distance)) return;

    const gateSummary = lengthGate
      ? "length within ±2 and same first two letters"
      : "high similarity ≥0.92";

    const match: PhoneticMatch = {
      code,
      name: candidate.name,
      count: candidate.count,
      percentile: candidate.percentile,
      similarity,
      distance,
      threshold,
      lengthDelta,
      gateSummary
    };

    if (!best) {
      best = match;
      return;
    }

    if (match.similarity > best.similarity) {
      best = match;
      return;
    }
    if (match.similarity === best.similarity && match.distance < best.distance) {
      best = match;
      return;
    }
    if (
      match.similarity === best.similarity &&
      match.distance === best.distance &&
      match.count > best.count
    ) {
      best = match;
    }
  });

  return best;
}
