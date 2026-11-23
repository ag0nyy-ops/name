mod common;

use name_rarity_engine::score::*;
use name_rarity_engine::score_name;
use name_rarity_engine::tables::Tables;
use std::sync::OnceLock;

fn tables() -> &'static Tables {
    static T: OnceLock<Tables> = OnceLock::new();
    T.get_or_init(common::real)
}

fn score(name: &str) -> NameResult {
    score_name(name, tables())
}

#[test]
fn tables_load_most_common_first() {
    let t = tables();
    assert!(t.first.info.total_names > 100_000);
    assert!(t.last.info.total_names > 150_000);
    assert_eq!(t.first.get("james").unwrap().rank, 1);
    assert_eq!(t.last.get("smith").unwrap().rank, 1);
    assert_eq!(t.first.info.min_count, 5);
    assert_eq!(t.last.info.min_count, 100);
}

#[test]
fn very_common_names_are_common() {
    for name in [
        "John Smith",
        "James Johnson",
        "Mary Williams",
        "Maria Garcia",
    ] {
        let r = score(name);
        assert_eq!(r.label, Label::Common, "{name}");
        assert_eq!(r.confidence, Confidence::High, "{name}");
    }
}

#[test]
fn hyphens_accents_apostrophes_and_particles_at_full_confidence() {
    for name in [
        "Jean-Luc Picard",
        "Mary-Anne Smith",
        "José García",
        "Zoë Kravitz",
        "Conan O'Brien",
        "D'Angelo Russell",
        "Ana de la Cruz",
        "Oliver Kowalczyk",
    ] {
        let r = score(name);
        assert_eq!(r.status, Status::Ok, "{name}");
        assert_eq!(r.confidence, Confidence::High, "{name}");
        assert_eq!(r.first.unwrap().matched, PartMatch::Exact, "{name}");
        assert_eq!(r.last.unwrap().matched, PartMatch::Exact, "{name}");
    }
}

#[test]
fn rare_spelling_beats_common_spelling() {
    assert!(score("Braydyn Smith").score > score("Brayden Smith").score);
}

#[test]
fn orders_names_from_common_to_rare() {
    let scores: Vec<u32> = [
        "John Smith",
        "Taylor Swift",
        "Jay Patty",
        "Elon Musk",
        "Barack Obama",
    ]
    .iter()
    .map(|n| score(n).score.unwrap())
    .collect();
    let mut sorted = scores.clone();
    sorted.sort();
    assert_eq!(scores, sorted);
}

/// The SSA files used here aren't split by sex, so "unisex" can only mean a name
/// that works as both a first name and a surname. Both orders should score.
#[test]
fn names_used_as_both_first_and_last_work_in_either_slot() {
    for name in [
        "Taylor Jordan",
        "Jordan Taylor",
        "Morgan James",
        "James Morgan",
    ] {
        let r = score(name);
        assert_eq!(r.status, Status::Ok, "{name}");
        assert_eq!(r.confidence, Confidence::High, "{name}");
    }
    // A lone word goes to whichever list it's more common in.
    assert_eq!(score("Taylor").mode, Mode::LastOnly);
    assert_eq!(score("Jennifer").mode, Mode::FirstOnly);
    assert_eq!(score("Johnson").mode, Mode::LastOnly);
}

#[test]
fn particle_surname_not_listed_whole_falls_back_and_is_honest_about_it() {
    let r = score("Jan van der Brueggenkamp");
    assert_eq!(r.status, Status::Ok);
    assert_ne!(r.confidence, Confidence::High);
    assert!(r.estimate.unwrap().is_upper_bound);
}

#[test]
fn non_latin_and_gibberish() {
    assert_eq!(score("李 小龍").status, Status::Unsupported);
    assert_eq!(score("asdfgh qwerty").status, Status::Unknown);
}
