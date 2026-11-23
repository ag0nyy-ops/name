// Shared helpers for the integration tests.
#![allow(dead_code)]

use name_rarity_engine::tables::{FrequencyTable, SpecialCases, Tables};

fn table(pairs: &[(&str, u64)], total: u64) -> FrequencyTable {
    let counts = pairs.iter().map(|(n, c)| (n.to_string(), *c)).collect();
    FrequencyTable::from_counts("fixture".into(), None, total, counts, None)
}

fn special_cases() -> SpecialCases {
    let json = std::fs::read_to_string(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../data/specialCases.json"
    ))
    .unwrap();
    SpecialCases::from_json(&json).unwrap()
}

/// 1,000,000 first-name records and 1,000,000 surname records.
pub fn fixture() -> Tables {
    Tables {
        first: table(
            &[
                ("john", 500_000),
                ("mary", 300_000),
                ("jose", 150_000),
                ("jeanluc", 40_000),
                ("jay", 9_000),
                ("james", 900),
                ("anne", 95),
                ("zzyzx", 5),
            ],
            1_000_000,
        ),
        last: table(
            &[
                ("smith", 600_000),
                ("garcia", 300_000),
                ("lopez", 90_000),
                ("obrien", 9_000),
                ("delafuente", 800),
                ("fuente", 400),
                ("patty", 100),
            ],
            1_000_000,
        ),
        special: special_cases(),
    }
}

pub fn real() -> Tables {
    let read = |path: &str| {
        std::fs::read_to_string(format!("{}/../{path}", env!("CARGO_MANIFEST_DIR"))).unwrap()
    };
    Tables::from_json(
        &read("public/data/ssa-first-names.json"),
        &read("public/data/census-surnames.json"),
        &read("data/specialCases.json"),
    )
    .unwrap()
}
