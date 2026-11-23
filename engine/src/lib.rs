//! Name rarity engine: parses a name, looks each part up in SSA baby-name and
//! US Census surname counts, and estimates how many people share it.
//!
//! The same code runs natively (for tests) and in the browser as WebAssembly.

pub mod parse;
pub mod phonetic;
pub mod score;
pub mod tables;

use serde::Serialize;
use wasm_bindgen::prelude::*;

pub use score::{score_name, NameResult, MODEL_VERSION};
pub use tables::Tables;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct EngineInfo<'a> {
    model_version: &'a str,
    first: &'a tables::TableInfo,
    last: &'a tables::TableInfo,
}

/// The browser-facing handle: build it once with the two tables, then score names.
#[wasm_bindgen]
pub struct Engine {
    tables: Tables,
}

#[wasm_bindgen]
impl Engine {
    /// `first_json` and `last_json` are the files in public/data; `special_json` is data/specialCases.json.
    #[wasm_bindgen(constructor)]
    pub fn new(first_json: &str, last_json: &str, special_json: &str) -> Result<Engine, JsValue> {
        Tables::from_json(first_json, last_json, special_json)
            .map(|tables| Engine { tables })
            .map_err(|message| JsValue::from_str(&message))
    }

    /// Scores a name and returns the result as JSON.
    pub fn score(&self, input: &str) -> String {
        serde_json::to_string(&score_name(input, &self.tables)).unwrap_or_else(|_| "null".into())
    }

    /// Dataset sizes, dates and the model version, as JSON.
    pub fn info(&self) -> String {
        let info = EngineInfo {
            model_version: MODEL_VERSION,
            first: &self.tables.first.info,
            last: &self.tables.last.info,
        };
        serde_json::to_string(&info).unwrap_or_else(|_| "null".into())
    }
}

#[wasm_bindgen(js_name = modelVersion)]
pub fn model_version() -> String {
    MODEL_VERSION.to_string()
}
