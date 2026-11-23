mod common;

use name_rarity_engine::score::*;
use name_rarity_engine::score_name;

fn score(name: &str) -> NameResult {
    score_name(name, &common::fixture())
}

fn close(a: f64, b: f64) -> bool {
    (a - b).abs() <= b.abs() * 1e-9
}

#[test]
fn multiplies_shares_by_population() {
    let r = score("John Smith");
    assert_eq!(r.status, Status::Ok);
    let e = r.estimate.unwrap();
    assert!(close(e.people, US_POPULATION * 0.5 * 0.6));
    assert!(!e.is_upper_bound);
    assert_eq!(r.label, Label::Common);
    assert_eq!(r.confidence, Confidence::High);
}

#[test]
fn counts_the_most_common_names_instead_of_dropping_them() {
    let rare_first = score("Zzyzx Smith");
    assert!(rare_first.score < score("Zzyzx Patty").score);
    assert_eq!(rare_first.last.unwrap().score, 0);
}

#[test]
fn gets_rarer_as_either_name_gets_rarer() {
    let people = |n: &str| score(n).estimate.unwrap().people;
    assert!(people("Mary Smith") > people("Jay Smith"));
    assert!(people("Jay Smith") > people("Jay Patty"));
    assert!(score("Jay Smith").score < score("Zzyzx Patty").score);
}

#[test]
fn middle_names_give_a_separate_narrower_estimate() {
    let r = score("Mary Anne Smith");
    let e = r.estimate.as_ref().unwrap();
    assert!(close(e.with_middle.unwrap(), e.people * 95.0 / 1_000_000.0));
    assert_eq!(r.score, score("Mary Smith").score);
}

#[test]
fn accents_are_the_same_name_at_full_confidence() {
    let plain = score("Jose Garcia");
    let accented = score("José García");
    assert_eq!(accented.score, plain.score);
    assert_eq!(accented.confidence, Confidence::High);
    assert_eq!(accented.first.unwrap().matched, PartMatch::Exact);
}

#[test]
fn hyphenated_first_names_match_without_the_hyphen() {
    let r = score("Jean-Luc Smith");
    let first = r.first.unwrap();
    assert_eq!(first.matched, PartMatch::Exact);
    assert_eq!(first.count, Some(40_000));
    assert_eq!(r.confidence, Confidence::High);
}

#[test]
fn apostrophe_surnames_match() {
    let last = score("Mary O'Brien").last.unwrap();
    assert_eq!(last.matched, PartMatch::Exact);
    assert_eq!(last.count, Some(9_000));
}

#[test]
fn hyphenated_surnames_not_listed_as_a_whole() {
    let r = score("Mary Garcia-Lopez");
    let last = r.last.as_ref().unwrap();
    assert_eq!(last.matched, PartMatch::Parts);
    assert_eq!(r.confidence, Confidence::Medium);
    assert!(r.estimate.as_ref().unwrap().is_upper_bound);
    assert!(last.score > score("Mary Patty").last.unwrap().score);
}

#[test]
fn particle_surnames_join_then_fall_back_to_the_final_word() {
    assert_eq!(
        score("Juan de la Fuente").last.unwrap().matched,
        PartMatch::Exact
    );
    let fallback = score("Juan van der Fuente");
    let last = fallback.last.as_ref().unwrap();
    assert_eq!(last.matched, PartMatch::Core);
    assert_eq!(last.count, Some(400));
    assert_eq!(fallback.confidence, Confidence::Medium);
}

#[test]
fn missing_surname_is_below_the_census_cutoff_not_unknown() {
    let r = score("Mary Targaryen");
    assert_eq!(r.status, Status::Ok);
    let last = r.last.unwrap();
    assert_eq!(last.matched, PartMatch::Missing);
    assert_eq!(last.count_used, 50.0);
    assert_eq!(r.confidence, Confidence::Medium);
}

#[test]
fn suggests_a_known_name_a_rare_spelling_sounds_like() {
    let first = score("Jaye Smith").first.unwrap();
    assert_eq!(first.matched, PartMatch::Missing);
    assert_eq!(first.sounds_like.unwrap().name, "jay");
}

#[test]
fn never_flags_a_listed_name_as_unusual() {
    let r = score("Zzyzx Smith");
    assert!(r.first.unwrap().looks_unusual.is_none());
    assert_eq!(r.confidence, Confidence::High);
}

#[test]
fn keyboard_mashing_drops_confidence() {
    let r = score("Mary Qwertyx");
    assert!(r.last.unwrap().looks_unusual.is_some());
    assert_eq!(r.confidence, Confidence::Low);
}

#[test]
fn unknown_unsupported_and_empty() {
    let r = score("Asdfgh Qwerty");
    assert_eq!(r.status, Status::Unknown);
    assert_eq!(r.score, None);
    let r = score("李 小龍");
    assert_eq!(r.status, Status::Unsupported);
    assert_eq!(r.score, None);
    assert_eq!(score("  ").status, Status::Empty);
}

#[test]
fn lone_first_name_scores_against_ssa() {
    let r = score("john");
    assert_eq!(r.mode, Mode::FirstOnly);
    assert!(r.estimate.is_none());
    assert_eq!(r.confidence, Confidence::Medium);
}

#[test]
fn lone_surname_scores_against_the_census() {
    let r = score("Smith");
    assert_eq!(r.mode, Mode::LastOnly);
    assert_eq!(r.last.unwrap().count, Some(600_000));
}

#[test]
fn uses_hand_checked_special_cases() {
    let last = score("Mary Ayde-Hueg").last.unwrap();
    assert_eq!(last.matched, PartMatch::Special);
    assert!(last.notes.join(" ").to_lowercase().contains("hand-checked"));
}

#[test]
fn maps_headcounts_onto_0_to_100() {
    assert_eq!(full_name_score(1_000_000.0), 0);
    assert_eq!(full_name_score(10_000.0), 0);
    assert_eq!(full_name_score(1.0), 57);
    assert_eq!(full_name_score(0.001), 100);
}

#[test]
fn labels_scores_in_fixed_bands() {
    assert_eq!(label_from_score(0), Label::Common);
    assert_eq!(label_from_score(20), Label::Uncommon);
    assert_eq!(label_from_score(40), Label::Rare);
    assert_eq!(label_from_score(60), Label::VeryRare);
    assert_eq!(label_from_score(80), Label::Extreme);
}

#[test]
fn never_panics_or_leaves_range_on_random_input() {
    let alphabet: Vec<char> = "abcdefghijklmnopqrstuvwxyzéü'-., 0123456789_!?李"
        .chars()
        .collect();
    let tables = common::fixture();
    let mut seed: u64 = 42;
    let mut random = || {
        seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
        seed as f64 / 2_147_483_648.0
    };
    for _ in 0..3_000 {
        let len = (random() * 30.0) as usize;
        let input: String = (0..len)
            .map(|_| alphabet[(random() * alphabet.len() as f64) as usize])
            .collect();
        let r = score_name(&input, &tables);
        if let Some(s) = r.score {
            assert!(s <= 100, "{input:?} scored {s}");
        }
        assert!(serde_json::to_string(&r).is_ok());
    }
}

#[test]
fn json_uses_the_ui_field_names() {
    let json = serde_json::to_value(score("Mary O'Brien")).unwrap();
    assert_eq!(json["status"], "ok");
    assert_eq!(json["mode"], "full");
    assert_eq!(json["last"]["match"], "exact");
    assert_eq!(json["last"]["dataset"], "census");
    assert!(json["last"]["countUsed"].is_number());
    assert!(json["estimate"]["isUpperBound"].is_boolean());
    assert_eq!(json["modelVersion"], MODEL_VERSION);
    assert_eq!(serde_json::to_value(Label::VeryRare).unwrap(), "very rare");
    assert_eq!(serde_json::to_value(Mode::FirstOnly).unwrap(), "first-only");
}

#[test]
fn middle_initials_are_left_out_of_the_estimate() {
    let r = score("Mary A. Smith");
    assert!(r.middle.is_empty());
    assert!(r.estimate.unwrap().with_middle.is_none());
    assert_eq!(r.score, score("Mary Smith").score);
    assert!(r.notes.iter().any(|n| n.contains("initial")));
}
