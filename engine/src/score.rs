//! The rarity model.
//!
//! Full name: expected US headcount = population x (first-name share in SSA)
//! x (surname share in the Census), mapped onto 0-100 on a log scale.
//! Each part also gets its own 0-100 score from its count.

use serde::Serialize;

use crate::parse::{parse_name, NameToken, ParsedName};
use crate::phonetic::find_match;
use crate::tables::{FrequencyTable, Tables};

pub const MODEL_VERSION: &str = "4.0";

/// Rough US population used to turn name shares into a headcount.
pub const US_POPULATION: f64 = 335_000_000.0;
/// Full-name scale: this many people sharing a name scores 0 ...
pub const SCALE_COMMON: f64 = 10_000.0;
/// ... and this few (a tiny fraction of one person) scores 100.
pub const SCALE_UNIQUE: f64 = 0.001;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub enum Label {
    #[serde(rename = "common")]
    Common,
    #[serde(rename = "uncommon")]
    Uncommon,
    #[serde(rename = "rare")]
    Rare,
    #[serde(rename = "very rare")]
    VeryRare,
    #[serde(rename = "extreme")]
    Extreme,
    #[serde(rename = "unknown")]
    Unknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Confidence {
    High,
    Medium,
    Low,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum PartKind {
    First,
    Middle,
    Last,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Dataset {
    Ssa,
    Census,
}

/// How a part was found.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum PartMatch {
    /// In the dataset as typed (after removing accents and punctuation).
    Exact,
    /// Only the final word of a particle surname matched ("de la Fuente" -> "Fuente").
    Core,
    /// A hyphenated name isn't listed, but each half is.
    Parts,
    /// A documented, hand-checked override.
    Special,
    /// Not in the dataset at all.
    Missing,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Status {
    Empty,
    Ok,
    Unsupported,
    Unknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum Mode {
    Full,
    FirstOnly,
    LastOnly,
    None,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SoundsLike {
    pub name: String,
    pub count: u64,
    pub rank: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PartResult {
    pub kind: PartKind,
    pub text: String,
    pub dataset: Dataset,
    #[serde(rename = "match")]
    pub matched: PartMatch,
    /// Count from the dataset for the name that matched.
    pub count: Option<u64>,
    /// 1 = most common name in that dataset.
    pub rank: Option<u32>,
    pub total_names: u64,
    /// Count used for the estimate (a stand-in below the dataset cutoff when missing).
    pub count_used: f64,
    /// Share of the dataset's people with this name.
    pub share: f64,
    /// 0 (most common in the dataset) to 100 (a single person).
    pub score: u32,
    pub label: Label,
    pub sounds_like: Option<SoundsLike>,
    pub looks_unusual: Option<String>,
    pub notes: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Estimate {
    /// Expected number of people in the US with this first + last name.
    pub people: f64,
    /// True when a part wasn't fully in the data, so the number is a rough upper-end guess.
    pub is_upper_bound: bool,
    /// Same estimate when middle names are included too.
    pub with_middle: Option<f64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NameResult {
    pub status: Status,
    pub display: String,
    pub mode: Mode,
    pub first: Option<PartResult>,
    pub middle: Vec<PartResult>,
    pub last: Option<PartResult>,
    pub suffix: Option<String>,
    pub estimate: Option<Estimate>,
    pub score: Option<u32>,
    pub label: Label,
    pub confidence: Confidence,
    pub confidence_reasons: Vec<String>,
    pub notes: Vec<String>,
    pub model_version: &'static str,
}

pub fn label_from_score(score: u32) -> Label {
    match score {
        80.. => Label::Extreme,
        60..=79 => Label::VeryRare,
        40..=59 => Label::Rare,
        20..=39 => Label::Uncommon,
        _ => Label::Common,
    }
}

fn clamp01(value: f64) -> f64 {
    value.clamp(0.0, 1.0)
}

/// Per-name rarity on a log scale: the dataset's most common name = 0, a count of 1 = 100.
pub fn part_score(count: f64, table: &FrequencyTable) -> u32 {
    let top = (table.info.max_count.max(10) as f64).log10();
    let value = count.max(1.0).log10();
    (clamp01((top - value) / top) * 100.0).round() as u32
}

/// Full-name rarity on a log scale from SCALE_COMMON people (0) to SCALE_UNIQUE people (100).
pub fn full_name_score(people: f64) -> u32 {
    let hi = SCALE_COMMON.log10();
    let lo = SCALE_UNIQUE.log10();
    let value = people.max(1e-12).log10();
    (clamp01((hi - value) / (hi - lo)) * 100.0).round() as u32
}

/// Count assumed for a name that isn't listed: half the dataset's cutoff.
pub fn below_cutoff_count(table: &FrequencyTable) -> f64 {
    (table.info.min_count as f64 / 2.0).max(1.0)
}

const KEYBOARD_ROWS: [&str; 3] = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

/// Only used on names that aren't in the data, so real listed names are never flagged.
pub fn unusual_reason(key: &str) -> Option<&'static str> {
    let len = key.len();
    if len >= 21 {
        return Some("it's unusually long");
    }
    let bytes = key.as_bytes();
    if len >= 4 && bytes.windows(3).any(|w| w[0] == w[1] && w[1] == w[2]) {
        return Some("it repeats the same letter three times");
    }
    let vowels = key.chars().filter(|c| "aeiouy".contains(*c)).count();
    if len >= 5 && vowels == 0 {
        return Some("it has no vowels");
    }
    if len >= 7 && (len - vowels) as f64 / len as f64 > 0.8 {
        return Some("it's almost all consonants");
    }
    for row in KEYBOARD_ROWS {
        let reversed: String = row.chars().rev().collect();
        for seq in [row.to_string(), reversed] {
            for start in 0..=seq.len().saturating_sub(5) {
                if key.contains(&seq[start..start + 5]) {
                    return Some("it looks like a keyboard pattern");
                }
            }
        }
    }
    None
}

pub fn format_int(value: f64) -> String {
    let digits = (value.round() as u64).to_string();
    let mut out = String::with_capacity(digits.len() + digits.len() / 3);
    for (i, c) in digits.chars().enumerate() {
        if i > 0 && (digits.len() - i).is_multiple_of(3) {
            out.push(',');
        }
        out.push(c);
    }
    out
}

fn score_part(token: &NameToken, kind: PartKind, tables: &Tables) -> PartResult {
    let (table, other, dataset, specials) = match kind {
        PartKind::Last => (
            &tables.last,
            &tables.first,
            Dataset::Census,
            &tables.special.last,
        ),
        _ => (
            &tables.first,
            &tables.last,
            Dataset::Ssa,
            &tables.special.first,
        ),
    };
    let special = specials.get(&token.lower);
    let mut notes: Vec<String> = Vec::new();

    let finish = |matched: PartMatch,
                  count_used: f64,
                  count: Option<u64>,
                  rank: Option<u32>,
                  notes: Vec<String>| {
        let score = part_score(count_used, table);
        PartResult {
            kind,
            text: token.text.clone(),
            dataset,
            matched,
            count,
            rank,
            total_names: table.info.total_names,
            count_used,
            share: if table.info.total_count > 0 {
                count_used / table.info.total_count as f64
            } else {
                0.0
            },
            score,
            label: label_from_score(score),
            sounds_like: None,
            looks_unusual: None,
            notes,
        }
    };

    if let Some(entry) = table.get(&token.key) {
        let typed: String = token.lower.chars().filter(|c| !c.is_whitespace()).collect();
        if token.key != token.lower {
            if token.hyphen_parts.len() > 1 {
                notes.push(
                    "Listed without the hyphen, which is how the records store hyphenated names."
                        .into(),
                );
            } else if !token.particles.is_empty() {
                notes.push(
                    "Listed as one word, which is how the Census stores surnames with particles."
                        .into(),
                );
            } else if typed.chars().any(|c| !c.is_ascii_lowercase()) {
                notes.push(
                    "Matched without accents or apostrophes, which the records don't store.".into(),
                );
            }
        }
        return finish(
            PartMatch::Exact,
            entry.count as f64,
            Some(entry.count),
            Some(entry.rank),
            notes,
        );
    }

    if let Some(special) = special {
        notes.push(special.note.clone());
    }

    // "de la Fuente" isn't listed as one word: fall back to "Fuente".
    if special.is_none() {
        if let Some((core_key, entry)) = token
            .core_key
            .as_ref()
            .and_then(|k| table.get(k).map(|e| (k, e)))
        {
            notes.push(format!(
                "\"{}\" isn't listed as one name, so this uses \"{}\" alone. People with the full surname are a subset of these.",
                token.text, core_key
            ));
            return finish(
                PartMatch::Core,
                entry.count as f64,
                Some(entry.count),
                Some(entry.rank),
                notes,
            );
        }
    }

    let cutoff = below_cutoff_count(table);
    let cutoff_text = match dataset {
        Dataset::Ssa => "SSA only publishes names given to at least 5 babies in a year, so this spelling has been very rare in every year since 1880.",
        Dataset::Census => "The Census only lists surnames held by at least 100 people, so fewer than 100 people had this surname in 2010.",
    };

    // Hyphenated name that isn't listed as a whole, but each half is.
    if special.is_none()
        && token.hyphen_parts.len() > 1
        && token
            .hyphen_parts
            .iter()
            .all(|part| table.get(part).is_some())
    {
        notes.push(format!(
            "\"{}\" isn't listed as one name, but each half is. {}",
            token.text, cutoff_text
        ));
        return finish(PartMatch::Parts, cutoff, None, None, notes);
    }

    if special.is_some() {
        return finish(PartMatch::Special, cutoff, None, None, notes);
    }

    let dataset_name = match dataset {
        Dataset::Ssa => "SSA baby-name records",
        Dataset::Census => "the 2010 Census surname list",
    };
    notes.push(format!("Not in {dataset_name}. {cutoff_text}"));
    let mut result = finish(PartMatch::Missing, cutoff, None, None, notes);

    if let Some(reason) = unusual_reason(&token.key) {
        result.looks_unusual = Some(reason.to_string());
        return result;
    }

    let sounds = if token.key.len() >= 3 {
        find_match(&token.key, table.phonetic())
    } else {
        None
    };
    match sounds {
        Some(m) if m.name != token.key => {
            result.notes.push(format!(
                "Sounds like \"{}\" ({} in the data), so this looks like a rare spelling of a known name.",
                m.name,
                format_int(m.count as f64)
            ));
            result.sounds_like = Some(SoundsLike {
                rank: table.get(&m.name).map(|e| e.rank),
                name: m.name,
                count: m.count,
            });
        }
        _ => {
            // Maybe it's in the other dataset (a surname used as a first name, or vice versa).
            if let Some(entry) = other.get(&token.key) {
                result.notes.push(match kind {
                    PartKind::Last => format!(
                        "It is used as a first name ({} babies), just not as a common surname.",
                        format_int(entry.count as f64)
                    ),
                    _ => format!(
                        "It is a known surname ({} people), just rarely a first name.",
                        format_int(entry.count as f64)
                    ),
                });
            }
        }
    }
    result
}

fn base_result(parsed: &ParsedName, status: Status, notes: Vec<String>) -> NameResult {
    NameResult {
        status,
        display: parsed.display.clone(),
        mode: Mode::None,
        first: None,
        middle: Vec::new(),
        last: None,
        suffix: parsed.suffix.clone(),
        estimate: None,
        score: None,
        label: Label::Unknown,
        confidence: Confidence::Low,
        confidence_reasons: Vec::new(),
        notes,
        model_version: MODEL_VERSION,
    }
}

struct ConfidenceTracker {
    level: Confidence,
    reasons: Vec<String>,
}

impl ConfidenceTracker {
    fn lower(&mut self, to: Confidence, why: impl Into<String>) {
        self.level = self.level.max(to);
        self.reasons.push(why.into());
    }
}

pub fn score_name(input: &str, tables: &Tables) -> NameResult {
    let parsed = parse_name(input);

    let Some(first_token) = parsed.first.as_ref() else {
        return base_result(&parsed, Status::Empty, Vec::new());
    };
    if parsed.non_latin {
        return base_result(
            &parsed,
            Status::Unsupported,
            vec!["This tool only covers names written in the Latin alphabet, because its data comes from US records. Try a romanized spelling.".into()],
        );
    }

    let mut notes = Vec::new();
    let mut confidence = ConfidenceTracker {
        level: Confidence::High,
        reasons: Vec::new(),
    };

    if parsed.reordered {
        notes.push(format!("Read \"Last, First\" as {}.", parsed.display));
    }
    if !parsed.ignored_chars.is_empty() || parsed.has_digits {
        confidence.lower(
            Confidence::Low,
            "The input had characters that aren't part of names, so they were ignored.",
        );
    }
    if let Some(suffix) = &parsed.suffix {
        notes.push(format!("The suffix {suffix} doesn't change the count: it usually means you share the name with a parent."));
    }

    // One word: score it as a first name, or as a surname if it's more common as one.
    let Some(last_token) = parsed.last.as_ref() else {
        let as_first = score_part(first_token, PartKind::First, tables);
        let surname = tables.last.get(&first_token.key);
        let use_surname = surname.is_some_and(|entry| {
            as_first.matched == PartMatch::Missing
                || entry.count as f64 / tables.last.info.total_count as f64 > as_first.share
        });
        let part = if use_surname {
            score_part(first_token, PartKind::Last, tables)
        } else {
            as_first
        };
        if part.matched == PartMatch::Missing {
            let mut result = base_result(
                &parsed,
                Status::Unknown,
                vec![format!(
                    "\"{}\" isn't in SSA baby names or the Census surname list. Add the rest of the name, or check the spelling.",
                    first_token.text
                )],
            );
            result.first = Some(part);
            return result;
        }
        confidence.lower(
            Confidence::Medium,
            "Only one name was entered, so there's no full-name estimate.",
        );
        notes.push("Add a last name to see how many people share your full name.".into());
        let (score, label) = (part.score, part.label);
        let mut result = base_result(&parsed, Status::Ok, notes);
        result.mode = if use_surname {
            Mode::LastOnly
        } else {
            Mode::FirstOnly
        };
        if use_surname {
            result.last = Some(part);
        } else {
            result.first = Some(part);
        }
        result.score = Some(score);
        result.label = label;
        result.confidence = confidence.level;
        result.confidence_reasons = confidence.reasons;
        return result;
    };

    let first = score_part(first_token, PartKind::First, tables);
    let last = score_part(last_token, PartKind::Last, tables);
    // A lone letter is an initial, not a name, so it can't be looked up.
    let (initials, names): (Vec<&NameToken>, Vec<&NameToken>) =
        parsed.middle.iter().partition(|t| t.key.len() == 1);
    let middle: Vec<PartResult> = names
        .into_iter()
        .map(|t| score_part(t, PartKind::Middle, tables))
        .collect();
    if !initials.is_empty() {
        notes.push(
            "Middle initials can't be looked up, so they're left out of the estimate.".into(),
        );
    }

    if first.matched == PartMatch::Missing && last.matched == PartMatch::Missing {
        let unusual = first.looks_unusual.is_some() || last.looks_unusual.is_some();
        let message = if unusual {
            "Neither name is in US records, and it doesn't look like a typical name, so there's nothing to score against."
        } else {
            "Neither name is in US records. It may be extremely rare, spelled differently than the records, or not from the US."
        };
        let mut result = base_result(&parsed, Status::Unknown, vec![message.into()]);
        result.first = Some(first);
        result.last = Some(last);
        result.middle = middle;
        return result;
    }

    for part in [&first, &last] {
        let name = if part.kind == PartKind::First {
            "first name"
        } else {
            "last name"
        };
        match (part.matched, &part.looks_unusual) {
            (PartMatch::Missing, Some(reason)) => {
                confidence.lower(Confidence::Low, format!("The {name} isn't in the data and {reason}."))
            }
            (PartMatch::Missing, None) => confidence.lower(
                Confidence::Medium,
                format!("The {name} isn't in the data, so its count is an upper-end guess."),
            ),
            (PartMatch::Parts, _) => confidence.lower(
                Confidence::Medium,
                format!("The hyphenated {name} isn't listed as a whole, so its count is an upper-end guess."),
            ),
            (PartMatch::Core, _) => confidence.lower(
                Confidence::Medium,
                format!("Only part of the {name} matched, so the real count is lower."),
            ),
            (PartMatch::Special, _) => confidence.reasons.push(format!("The {name} uses a documented hand-checked entry.")),
            (PartMatch::Exact, _) => {}
        }
    }
    if middle
        .iter()
        .any(|p| p.matched == PartMatch::Missing && p.looks_unusual.is_some())
    {
        confidence.lower(
            Confidence::Medium,
            "A middle name isn't in the data and looks unusual.",
        );
    }

    let people = US_POPULATION * first.share * last.share;
    let middle_share: f64 = middle.iter().map(|p| p.share).product();
    let estimate = Estimate {
        people,
        is_upper_bound: first.matched != PartMatch::Exact || last.matched != PartMatch::Exact,
        with_middle: if middle.is_empty() {
            None
        } else {
            Some(people * middle_share)
        },
    };

    if confidence.level == Confidence::High {
        confidence
            .reasons
            .insert(0, "Both names are listed in the data.".into());
    }

    let score = full_name_score(people);
    let mut result = base_result(&parsed, Status::Ok, notes);
    result.mode = Mode::Full;
    result.first = Some(first);
    result.last = Some(last);
    result.middle = middle;
    result.estimate = Some(estimate);
    result.score = Some(score);
    result.label = label_from_score(score);
    result.confidence = confidence.level;
    result.confidence_reasons = confidence.reasons;
    result
}
