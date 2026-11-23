//! Turns whatever someone types into first / middle / last name tokens plus
//! lookup keys that match how the SSA and Census files store names
//! (lowercase a-z only: no accents, spaces, hyphens, apostrophes or periods).

use unicode_normalization::char::is_combining_mark;
use unicode_normalization::UnicodeNormalization;

#[derive(Debug, Clone, PartialEq)]
pub struct NameToken {
    /// The token as displayed (cleaned, title-cased when typed in one case).
    pub text: String,
    /// Lowercase text with punctuation kept, used for special-case lookups.
    pub lower: String,
    /// Lookup key: lowercase a-z only.
    pub key: String,
    /// Keys of the hyphen-separated pieces, when the token has a hyphen.
    pub hyphen_parts: Vec<String>,
    /// Last names only: key of the final word without particles like "de la".
    pub core_key: Option<String>,
    /// Last names only: the particles that were joined onto the surname.
    pub particles: Vec<String>,
}

#[derive(Debug, Clone, Default)]
pub struct ParsedName {
    pub display: String,
    pub first: Option<NameToken>,
    pub middle: Vec<NameToken>,
    pub last: Option<NameToken>,
    pub suffix: Option<String>,
    pub title: Option<String>,
    /// "Smith, John" was rewritten to "John Smith".
    pub reordered: bool,
    /// Characters that can't be part of a name and were ignored.
    pub ignored_chars: Vec<char>,
    pub has_digits: bool,
    /// Letters outside the Latin alphabet (the US datasets can't cover these).
    pub non_latin: bool,
}

const TITLES: &[&str] = &[
    "mr", "mrs", "ms", "miss", "mx", "dr", "prof", "sir", "dame", "rev", "fr",
];
const GENERATIONAL: &[&str] = &["jr", "sr"];
const ROMAN: &[&str] = &["ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"];

/// Words that belong to the surname that follows them (de la Cruz, van der Berg, St. John).
const PARTICLES: &[&str] = &[
    "al", "bin", "da", "das", "de", "del", "della", "der", "des", "di", "dos", "du", "el", "ibn",
    "la", "le", "los", "st", "ste", "ten", "ter", "van", "von", "zu",
];

fn is_fancy_hyphen(c: char) -> bool {
    matches!(c, '\u{2010}'..='\u{2015}')
}

fn is_fancy_apostrophe(c: char) -> bool {
    matches!(
        c,
        '\u{2019}' | '\u{2018}' | '\u{02BC}' | '`' | '\u{00B4}' | '\u{02BB}'
    )
}

fn is_allowed(c: char) -> bool {
    c.is_alphabetic()
        || is_combining_mark(c)
        || c.is_whitespace()
        || matches!(c, '\'' | '.' | ',' | '-')
}

/// Latin, Latin-1, Latin Extended A/B, IPA, Latin Extended Additional / C / D / E, fullwidth Latin.
fn is_latin_letter(c: char) -> bool {
    matches!(c,
        'A'..='Z' | 'a'..='z' | '\u{00AA}' | '\u{00BA}' | '\u{00C0}'..='\u{02AF}' |
        '\u{1D00}'..='\u{1DBF}' | '\u{1E00}'..='\u{1EFF}' | '\u{2C60}'..='\u{2C7F}' |
        '\u{A720}'..='\u{A7FF}' | '\u{AB30}'..='\u{AB6F}' | '\u{FF21}'..='\u{FF3A}' | '\u{FF41}'..='\u{FF5A}')
}

pub fn strip_diacritics(value: &str) -> String {
    value
        .nfd()
        .filter(|c| !is_combining_mark(*c))
        .nfc()
        .collect()
}

fn special_letter(c: char) -> Option<&'static str> {
    Some(match c {
        'ß' => "ss",
        'æ' => "ae",
        'ø' => "o",
        'œ' => "oe",
        'ł' => "l",
        'đ' | 'ð' => "d",
        'þ' => "th",
        'ı' => "i",
        'ħ' => "h",
        _ => return None,
    })
}

/// Lowercase a-z key in the same shape the SSA / Census files use.
pub fn to_key(value: &str) -> String {
    let lower = strip_diacritics(&value.to_lowercase());
    let mut out = String::with_capacity(lower.len());
    for c in lower.chars() {
        if let Some(mapped) = special_letter(c) {
            out.push_str(mapped);
        } else if c.is_ascii_lowercase() {
            out.push(c);
        }
    }
    out
}

pub fn is_suffix(word: &str) -> bool {
    let key: String = word.to_lowercase().chars().filter(|c| *c != '.').collect();
    GENERATIONAL.contains(&key.as_str()) || ROMAN.contains(&key.as_str())
}

fn title_case_word(word: &str) -> String {
    let mut out = String::with_capacity(word.len());
    let mut capitalize = true;
    for c in word.chars() {
        if capitalize && c.is_alphabetic() {
            out.extend(c.to_uppercase());
            capitalize = false;
        } else {
            out.extend(c.to_lowercase());
        }
        if c == '-' || c == '\'' {
            capitalize = true;
        }
    }
    out
}

/// Periods only matter for initials and abbreviations ("J.", "St.", "Jr.").
fn clean_word(word: &str) -> String {
    let no_periods: String = word.chars().filter(|c| *c != '.').collect();
    no_periods
        .trim_matches(|c| c == '-' || c == '\'')
        .to_string()
}

fn make_token(text: &str) -> NameToken {
    let hyphen_parts = if text.contains('-') {
        text.split('-')
            .map(to_key)
            .filter(|k| !k.is_empty())
            .collect()
    } else {
        Vec::new()
    };
    NameToken {
        text: text.to_string(),
        lower: text.to_lowercase(),
        key: to_key(text),
        hyphen_parts,
        core_key: None,
        particles: Vec::new(),
    }
}

pub fn parse_name(input: &str) -> ParsedName {
    let raw: String = input
        .nfc()
        .map(|c| {
            if is_fancy_hyphen(c) {
                '-'
            } else if is_fancy_apostrophe(c) {
                '\''
            } else {
                c
            }
        })
        .collect();

    let mut ignored: Vec<char> = Vec::new();
    let mut kept = String::with_capacity(raw.len());
    for c in raw.chars() {
        if is_allowed(c) {
            kept.push(c);
        } else {
            if !c.is_whitespace() && !ignored.contains(&c) {
                ignored.push(c);
            }
            // Digits are dropped in place ("sm1th" -> "smth"); other symbols split words.
            if !c.is_ascii_digit() {
                kept.push(' ');
            }
        }
    }

    // "Smith, John" -> "John Smith"; "John Smith, Jr." keeps its order.
    let segments: Vec<&str> = kept
        .split(',')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .collect();
    let mut reordered = false;
    let ordered = if segments.len() == 2 {
        if segments[1].split_whitespace().all(is_suffix) {
            format!("{} {}", segments[0], segments[1])
        } else {
            reordered = true;
            format!("{} {}", segments[1], segments[0])
        }
    } else {
        segments.join(" ")
    };

    let mut words: Vec<String> = ordered
        .split_whitespace()
        .map(clean_word)
        .filter(|w| w.chars().any(char::is_alphabetic))
        .collect();

    // Keep the person's casing unless they typed it all in one case.
    let letters: String = words.concat();
    let one_case = letters == letters.to_lowercase() || letters == letters.to_uppercase();
    if one_case {
        words = words.iter().map(|w| title_case_word(w)).collect();
    }

    let mut title = None;
    if words.len() >= 2 && TITLES.contains(&words[0].to_lowercase().as_str()) {
        title = Some(words.remove(0));
    }

    let mut suffix = None;
    if words.len() >= 3 && is_suffix(words.last().map(String::as_str).unwrap_or("")) {
        let word = words.pop().unwrap_or_default().to_lowercase();
        suffix = Some(if GENERATIONAL.contains(&word.as_str()) {
            format!("{}.", title_case_word(&word))
        } else {
            word.to_uppercase()
        });
    }

    let mut parsed = ParsedName {
        suffix,
        title,
        reordered,
        ignored_chars: ignored,
        has_digits: input.chars().any(|c| c.is_ascii_digit()),
        non_latin: raw
            .chars()
            .any(|c| c.is_alphabetic() && !is_latin_letter(c)),
        ..ParsedName::default()
    };

    if words.is_empty() {
        return parsed;
    }

    parsed.first = Some(make_token(&words[0]));

    if words.len() >= 2 {
        // Join surname particles: "Ana de la Cruz" -> last "de la Cruz".
        let mut start = words.len() - 1;
        while start >= 2 && PARTICLES.contains(&words[start - 1].to_lowercase().as_str()) {
            start -= 1;
        }
        let last_words = &words[start..];
        let mut last = make_token(&last_words.join(" "));
        if last_words.len() > 1 {
            last.core_key = Some(to_key(&last_words[last_words.len() - 1]));
            last.particles = last_words[..last_words.len() - 1]
                .iter()
                .map(|w| w.to_lowercase())
                .collect();
        }
        parsed.last = Some(last);
        parsed.middle = words[1..start].iter().map(|w| make_token(w)).collect();
    }

    let mut display: Vec<&str> = Vec::new();
    if let Some(first) = &parsed.first {
        display.push(&first.text);
    }
    display.extend(parsed.middle.iter().map(|t| t.text.as_str()));
    if let Some(last) = &parsed.last {
        display.push(&last.text);
    }
    if let Some(suffix) = &parsed.suffix {
        display.push(suffix);
    }
    parsed.display = display.join(" ");
    parsed
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keys_match_how_ssa_and_census_store_names() {
        assert_eq!(to_key("José"), "jose");
        assert_eq!(to_key("O'Brien"), "obrien");
        assert_eq!(to_key("Jean-Luc"), "jeanluc");
        assert_eq!(to_key("de la Cruz"), "delacruz");
        assert_eq!(to_key("Ægir"), "aegir");
        assert_eq!(to_key("Strauß"), "strauss");
        assert_eq!(to_key("Łukasz"), "lukasz");
        assert_eq!(to_key("Zoë"), "zoe");
    }

    #[test]
    fn splits_first_middle_last() {
        let p = parse_name("john michael smith");
        assert_eq!(p.first.unwrap().text, "John");
        assert_eq!(
            p.middle.iter().map(|t| t.text.as_str()).collect::<Vec<_>>(),
            vec!["Michael"]
        );
        assert_eq!(p.last.unwrap().text, "Smith");
        assert_eq!(p.display, "John Michael Smith");
    }

    #[test]
    fn keeps_the_casing_people_type() {
        assert_eq!(parse_name("DeShawn McDonald").display, "DeShawn McDonald");
        assert_eq!(parse_name("JEAN-LUC PICARD").display, "Jean-Luc Picard");
        assert_eq!(parse_name("conan o'brien").display, "Conan O'Brien");
    }

    #[test]
    fn joins_surname_particles() {
        let p = parse_name("Juan Carlos de la Fuente");
        assert_eq!(p.middle.len(), 1);
        let last = p.last.unwrap();
        assert_eq!(last.text, "de la Fuente");
        assert_eq!(last.key, "delafuente");
        assert_eq!(last.core_key.as_deref(), Some("fuente"));
        assert_eq!(
            parse_name("John Van Der Berg").last.unwrap().key,
            "vanderberg"
        );
        assert_eq!(parse_name("Mary St. John").last.unwrap().key, "stjohn");
    }

    #[test]
    fn never_turns_the_first_word_into_a_particle() {
        let p = parse_name("De Niro");
        assert_eq!(p.first.unwrap().text, "De");
        assert_eq!(p.last.unwrap().text, "Niro");
    }

    #[test]
    fn pulls_off_suffixes_and_titles() {
        let p = parse_name("Dr. Martin Luther King Jr.");
        assert_eq!(p.title.as_deref(), Some("Dr"));
        assert_eq!(p.suffix.as_deref(), Some("Jr."));
        assert_eq!(p.last.unwrap().text, "King");
        assert_eq!(parse_name("Henry Ford III").suffix.as_deref(), Some("III"));
        // Two words: "X" is the last name, not a suffix.
        assert_eq!(parse_name("Malcolm X").last.unwrap().text, "X");
    }

    #[test]
    fn reads_last_comma_first() {
        let p = parse_name("Smith, John");
        assert!(p.reordered);
        assert_eq!(p.display, "John Smith");
        let s = parse_name("John Smith, Jr.");
        assert!(!s.reordered);
        assert_eq!(s.suffix.as_deref(), Some("Jr."));
    }

    #[test]
    fn normalizes_fancy_hyphens_and_apostrophes() {
        let p = parse_name("Mary\u{2013}Anne O\u{2019}Neal");
        let first = p.first.unwrap();
        assert_eq!(first.text, "Mary-Anne");
        assert_eq!(first.hyphen_parts, vec!["mary", "anne"]);
        assert_eq!(p.last.unwrap().key, "oneal");
    }

    #[test]
    fn flags_input_that_is_not_a_name() {
        let digits = parse_name("john sm1th");
        assert!(digits.has_digits);
        assert_eq!(digits.last.unwrap().text, "Smth");
        let underscore = parse_name("john_smith");
        assert_eq!(underscore.ignored_chars, vec!['_']);
        assert_eq!(underscore.last.unwrap().text, "Smith");
        assert!(parse_name("李 小龍").non_latin);
        assert!(parse_name("   ").first.is_none());
    }

    #[test]
    fn decomposed_accents_are_kept_with_their_letter() {
        // "e" + combining acute, as some keyboards send it.
        let p = parse_name("Jose\u{0301} Garci\u{0301}a");
        assert_eq!(p.first.unwrap().key, "jose");
        assert_eq!(p.last.unwrap().key, "garcia");
    }
}
