//! A small Double Metaphone variant plus a "sounds like" lookup, used only to
//! explain names that aren't in the data ("Jaye" sounds like "Jay").

use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct Candidate {
    pub name: String,
    pub count: u64,
    pub len: usize,
}

#[derive(Debug, Default)]
pub struct PhoneticIndex {
    by_code: HashMap<String, Vec<usize>>,
    candidates: Vec<Candidate>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PhoneticMatch {
    pub code: String,
    pub name: String,
    pub count: u64,
    pub similarity: f64,
    pub distance: usize,
}

fn is_vowel(c: Option<u8>) -> bool {
    matches!(c, Some(b'a' | b'e' | b'i' | b'o' | b'u' | b'y'))
}

fn append(code: &mut String, part: &str) {
    if !part.is_empty() && !code.ends_with(part) {
        code.push_str(part);
    }
}

/// Primary and secondary sound codes for an a-z key (other characters are ignored).
pub fn double_metaphone(value: &str) -> (String, String) {
    let input: Vec<u8> = value.bytes().filter(u8::is_ascii_lowercase).collect();
    let mut primary = String::new();
    let mut secondary = String::new();
    let len = input.len();
    let at = |i: usize| input.get(i).copied();
    let mut i = 0;

    while i < len {
        let c = input[i];
        let next = at(i + 1);
        let next2 = at(i + 2);
        let prev = if i > 0 { at(i - 1) } else { None };
        let both = |code: &str, primary: &mut String, secondary: &mut String| {
            append(primary, code);
            append(secondary, code);
        };
        let step_double = |letter: u8| if next == Some(letter) { 2 } else { 1 };

        match c {
            b'a' | b'e' | b'i' | b'o' | b'u' | b'y' => {
                if i == 0 {
                    both("A", &mut primary, &mut secondary);
                }
                i += 1;
            }
            b'b' => {
                both("P", &mut primary, &mut secondary);
                i += step_double(b'b');
            }
            b'c' => {
                if next == Some(b'h') {
                    both("X", &mut primary, &mut secondary);
                    i += 2;
                } else if matches!(next, Some(b'i' | b'e' | b'y')) {
                    both("S", &mut primary, &mut secondary);
                    i += 2;
                } else {
                    both("K", &mut primary, &mut secondary);
                    i += step_double(b'c');
                }
            }
            b'd' => {
                if next == Some(b'g') && matches!(next2, Some(b'e' | b'i' | b'y')) {
                    both("J", &mut primary, &mut secondary);
                    i += 3;
                } else {
                    both("T", &mut primary, &mut secondary);
                    i += step_double(b'd');
                }
            }
            b'f' => {
                both("F", &mut primary, &mut secondary);
                i += step_double(b'f');
            }
            b'g' => {
                if next == Some(b'h') {
                    if i == 0 || is_vowel(prev) {
                        both("F", &mut primary, &mut secondary);
                    }
                    i += 2;
                } else if next == Some(b'n') {
                    append(&mut primary, "KN");
                    append(&mut secondary, "N");
                    i += 2;
                } else if matches!(next, Some(b'e' | b'i' | b'y')) {
                    both("J", &mut primary, &mut secondary);
                    i += 2;
                } else {
                    both("K", &mut primary, &mut secondary);
                    i += step_double(b'g');
                }
            }
            b'h' => {
                if !is_vowel(prev) && is_vowel(next) {
                    both("H", &mut primary, &mut secondary);
                }
                i += 1;
            }
            b'j' => {
                both("J", &mut primary, &mut secondary);
                i += step_double(b'j');
            }
            b'k' => {
                both("K", &mut primary, &mut secondary);
                i += step_double(b'k');
            }
            b'l' => {
                both("L", &mut primary, &mut secondary);
                i += step_double(b'l');
            }
            b'm' => {
                both("M", &mut primary, &mut secondary);
                i += step_double(b'm');
            }
            b'n' => {
                both("N", &mut primary, &mut secondary);
                i += step_double(b'n');
            }
            b'p' => {
                if next == Some(b'h') {
                    both("F", &mut primary, &mut secondary);
                    i += 2;
                } else {
                    both("P", &mut primary, &mut secondary);
                    i += step_double(b'p');
                }
            }
            b'q' => {
                both("K", &mut primary, &mut secondary);
                i += step_double(b'q');
            }
            b'r' => {
                both("R", &mut primary, &mut secondary);
                i += step_double(b'r');
            }
            b's' => {
                if next == Some(b'h') {
                    both("X", &mut primary, &mut secondary);
                    i += 2;
                } else if next == Some(b'i') && matches!(next2, Some(b'o' | b'a')) {
                    both("X", &mut primary, &mut secondary);
                    i += 3;
                } else {
                    both("S", &mut primary, &mut secondary);
                    i += step_double(b's');
                }
            }
            b't' => {
                if next == Some(b'h') {
                    append(&mut primary, "0");
                    append(&mut secondary, "T");
                    i += 2;
                } else if next == Some(b'i') && matches!(next2, Some(b'o' | b'a')) {
                    both("X", &mut primary, &mut secondary);
                    i += 3;
                } else if next == Some(b'c') && next2 == Some(b'h') {
                    i += 3;
                } else {
                    both("T", &mut primary, &mut secondary);
                    i += step_double(b't');
                }
            }
            b'v' => {
                both("F", &mut primary, &mut secondary);
                i += step_double(b'v');
            }
            b'w' => {
                if is_vowel(next) {
                    both("W", &mut primary, &mut secondary);
                }
                i += 1;
            }
            b'x' => {
                both("KS", &mut primary, &mut secondary);
                i += 1;
            }
            b'z' => {
                both("S", &mut primary, &mut secondary);
                i += step_double(b'z');
            }
            _ => i += 1,
        }
    }

    primary.truncate(6);
    secondary.truncate(6);
    (primary, secondary)
}

fn codes(value: &str) -> Vec<String> {
    let (primary, secondary) = double_metaphone(value);
    let mut list = Vec::with_capacity(2);
    if !primary.is_empty() {
        list.push(primary);
    }
    if !secondary.is_empty() && !list.contains(&secondary) {
        list.push(secondary);
    }
    list
}

impl PhoneticIndex {
    pub fn build<'a>(names: impl Iterator<Item = (&'a str, u64)>) -> Self {
        let mut index = PhoneticIndex::default();
        for (name, count) in names {
            if name.is_empty() {
                continue;
            }
            let id = index.candidates.len();
            index.candidates.push(Candidate {
                name: name.to_string(),
                count,
                len: name.len(),
            });
            for code in codes(name) {
                index.by_code.entry(code).or_default().push(id);
            }
        }
        index
    }
}

pub fn levenshtein(a: &str, b: &str) -> usize {
    let a = a.as_bytes();
    let b = b.as_bytes();
    if a.is_empty() {
        return b.len();
    }
    if b.is_empty() {
        return a.len();
    }
    let mut prev: Vec<usize> = (0..=b.len()).collect();
    let mut row = vec![0; b.len() + 1];
    for i in 1..=a.len() {
        row[0] = i;
        for j in 1..=b.len() {
            let cost = usize::from(a[i - 1] != b[j - 1]);
            row[j] = (prev[j] + 1).min(row[j - 1] + 1).min(prev[j - 1] + cost);
        }
        std::mem::swap(&mut prev, &mut row);
    }
    prev[b.len()]
}

pub fn similarity(a: &str, b: &str) -> f64 {
    let max = a.len().max(b.len());
    if max == 0 {
        return 1.0;
    }
    1.0 - levenshtein(a, b) as f64 / max as f64
}

fn edit_threshold(len: usize) -> usize {
    match len {
        0..=6 => 2,
        7..=10 => 3,
        _ => 4,
    }
}

/// Consonant skeleton used for distance, so vowel swaps ("jaye"/"jay") count less.
fn skeleton(value: &str) -> String {
    let stripped: String = value.chars().filter(|c| !"aeiouy".contains(*c)).collect();
    if stripped.len() >= 2 {
        stripped
    } else {
        value.to_string()
    }
}

/// Closest listed name that sounds the same and is spelled similarly, if any.
pub fn find_match(key: &str, index: &PhoneticIndex) -> Option<PhoneticMatch> {
    if key.is_empty() {
        return None;
    }
    let len = key.len();
    let threshold = edit_threshold(len);
    let first_two = key.get(..2);
    let skel = skeleton(key);
    let mut best: Option<PhoneticMatch> = None;

    for code in codes(key) {
        let Some(ids) = index.by_code.get(&code) else {
            continue;
        };
        for &id in ids {
            let candidate = &index.candidates[id];
            let distance = levenshtein(&skel, &skeleton(&candidate.name));
            if distance > threshold {
                continue;
            }
            let sim = similarity(key, &candidate.name);
            let length_delta = candidate.len.abs_diff(len);
            let same_start =
                first_two.is_some_and(|p| p.len() == 2 && candidate.name.starts_with(p));
            if !((length_delta <= 2 && same_start) || sim >= 0.92) {
                continue;
            }
            // Long input matched to a much shorter name needs a near-identical spelling.
            let long_to_short = len >= 7 && candidate.len <= 5;
            if (long_to_short || length_delta >= 4) && !(sim >= 0.92 && distance <= 2) {
                continue;
            }
            let found = PhoneticMatch {
                code: code.clone(),
                name: candidate.name.clone(),
                count: candidate.count,
                similarity: sim,
                distance,
            };
            let better = match &best {
                None => true,
                Some(b) => {
                    found.similarity > b.similarity
                        || (found.similarity == b.similarity && found.distance < b.distance)
                        || (found.similarity == b.similarity
                            && found.distance == b.distance
                            && found.count > b.count)
                }
            };
            if better {
                best = Some(found);
            }
        }
    }
    best
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn codes_common_sounds() {
        assert_eq!(double_metaphone("james").0, "JMS");
        assert_eq!(double_metaphone("jaymz").0, "JMS");
        assert_eq!(double_metaphone("philip").0, "FLP");
        assert_eq!(
            double_metaphone("thomas"),
            ("0MS".to_string(), "TMS".to_string())
        );
    }

    #[test]
    fn levenshtein_basics() {
        assert_eq!(levenshtein("kitten", "sitting"), 3);
        assert_eq!(levenshtein("", "abc"), 3);
        assert_eq!(levenshtein("same", "same"), 0);
    }

    #[test]
    fn finds_a_respelling() {
        let names = [("jay", 9000u64), ("james", 900), ("mary", 300)];
        let index = PhoneticIndex::build(names.iter().map(|(n, c)| (*n, *c)));
        assert_eq!(
            find_match("jaye", &index).map(|m| m.name),
            Some("jay".to_string())
        );
        assert_eq!(
            find_match("jaymz", &index).map(|m| m.name),
            Some("james".to_string())
        );
        assert!(find_match("zzzz", &index).is_none());
    }
}
