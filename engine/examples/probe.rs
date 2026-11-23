// Prints a one-line summary per name: `cargo run --example probe -- "Jay Patty" ...`
use name_rarity_engine::score::*;
use name_rarity_engine::{score_name, Tables};

fn main() {
    let read = |p: &str| {
        std::fs::read_to_string(format!("{}/../{p}", env!("CARGO_MANIFEST_DIR"))).unwrap()
    };
    let tables = Tables::from_json(
        &read("public/data/ssa-first-names.json"),
        &read("public/data/census-surnames.json"),
        &read("data/specialCases.json"),
    )
    .unwrap();
    let m = |p: &Option<PartResult>| p.as_ref().map(|p| serde_json::to_value(p.matched).unwrap());
    for name in std::env::args().skip(1) {
        let r = score_name(&name, &tables);
        let row = serde_json::json!([
            name,
            r.status,
            r.score,
            r.label,
            r.confidence,
            r.estimate.as_ref().map(|e| format!("{:.6}", e.people)),
            m(&r.first),
            m(&r.last),
        ]);
        println!("{row}");
    }
}
