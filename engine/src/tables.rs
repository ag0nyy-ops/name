//! Frequency tables loaded from the JSON files in public/data.

use std::collections::HashMap;
use std::fmt;
use std::sync::OnceLock;

use serde::de::{MapAccess, Visitor};
use serde::{Deserialize, Deserializer, Serialize};

use crate::phonetic::PhoneticIndex;

/// `{name: count}` in file order (most common first), so rank is the position.
#[derive(Debug, Default)]
struct OrderedCounts(Vec<(String, u64)>);

impl<'de> Deserialize<'de> for OrderedCounts {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        struct CountsVisitor;
        impl<'de> Visitor<'de> for CountsVisitor {
            type Value = OrderedCounts;
            fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
                f.write_str("an object of name -> count")
            }
            fn visit_map<A: MapAccess<'de>>(self, mut map: A) -> Result<Self::Value, A::Error> {
                let mut entries = Vec::with_capacity(map.size_hint().unwrap_or(0));
                while let Some((name, count)) = map.next_entry::<String, u64>()? {
                    entries.push((name, count));
                }
                Ok(OrderedCounts(entries))
            }
        }
        deserializer.deserialize_map(CountsVisitor)
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawTable {
    source: String,
    generated_at: Option<String>,
    total_names: u64,
    total_count: u64,
    names: OrderedCounts,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Entry {
    pub count: u64,
    /// 1 = most common name in the table.
    pub rank: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TableInfo {
    pub source: String,
    pub generated_at: Option<String>,
    pub total_names: u64,
    pub total_count: u64,
    pub min_count: u64,
    pub max_count: u64,
}

#[derive(Debug)]
pub struct FrequencyTable {
    pub info: TableInfo,
    entries: HashMap<String, Entry>,
    order: Vec<String>,
    phonetic: OnceLock<PhoneticIndex>,
}

impl FrequencyTable {
    pub fn from_json(json: &str) -> Result<Self, String> {
        let raw: RawTable =
            serde_json::from_str(json).map_err(|e| format!("bad table JSON: {e}"))?;
        Ok(Self::from_counts(
            raw.source,
            raw.generated_at,
            raw.total_count,
            raw.names.0,
            Some(raw.total_names),
        ))
    }

    /// Build a table from `(name, count)` pairs, most common first.
    pub fn from_counts(
        source: String,
        generated_at: Option<String>,
        total_count: u64,
        counts: Vec<(String, u64)>,
        total_names: Option<u64>,
    ) -> Self {
        let mut entries = HashMap::with_capacity(counts.len());
        let mut order = Vec::with_capacity(counts.len());
        let mut min_count = u64::MAX;
        let mut max_count = 0;
        for (i, (name, count)) in counts.into_iter().enumerate() {
            min_count = min_count.min(count);
            max_count = max_count.max(count);
            entries.insert(
                name.clone(),
                Entry {
                    count,
                    rank: i as u32 + 1,
                },
            );
            order.push(name);
        }
        let info = TableInfo {
            source,
            generated_at,
            total_names: total_names.unwrap_or(order.len() as u64),
            total_count,
            min_count: if order.is_empty() { 0 } else { min_count },
            max_count,
        };
        FrequencyTable {
            info,
            entries,
            order,
            phonetic: OnceLock::new(),
        }
    }

    pub fn get(&self, key: &str) -> Option<Entry> {
        self.entries.get(key).copied()
    }

    pub fn len(&self) -> usize {
        self.order.len()
    }

    pub fn is_empty(&self) -> bool {
        self.order.is_empty()
    }

    /// Built on first use: only names that aren't in the data need it.
    pub fn phonetic(&self) -> &PhoneticIndex {
        self.phonetic.get_or_init(|| {
            PhoneticIndex::build(
                self.order
                    .iter()
                    .map(|name| (name.as_str(), self.entries[name].count)),
            )
        })
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct SpecialCase {
    pub note: String,
}

/// Hand-checked entries from data/specialCases.json, keyed by lowercase name (punctuation kept).
#[derive(Debug, Default, Deserialize)]
pub struct SpecialCases {
    #[serde(default)]
    pub first: HashMap<String, SpecialCase>,
    #[serde(default)]
    pub last: HashMap<String, SpecialCase>,
}

impl SpecialCases {
    pub fn from_json(json: &str) -> Result<Self, String> {
        if json.trim().is_empty() {
            return Ok(Self::default());
        }
        serde_json::from_str(json).map_err(|e| format!("bad special cases JSON: {e}"))
    }
}

#[derive(Debug)]
pub struct Tables {
    pub first: FrequencyTable,
    pub last: FrequencyTable,
    pub special: SpecialCases,
}

impl Tables {
    pub fn from_json(first: &str, last: &str, special: &str) -> Result<Self, String> {
        Ok(Tables {
            first: FrequencyTable::from_json(first)?,
            last: FrequencyTable::from_json(last)?,
            special: SpecialCases::from_json(special)?,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keeps_file_order_for_ranks() {
        let json = r#"{"source":"t","generatedAt":null,"totalNames":3,"totalCount":60,
            "names":{"zed":30,"amy":20,"bob":10}}"#;
        let table = FrequencyTable::from_json(json).unwrap();
        assert_eq!(table.get("zed"), Some(Entry { count: 30, rank: 1 }));
        assert_eq!(table.get("bob").map(|e| e.rank), Some(3));
        assert_eq!(table.info.min_count, 10);
        assert_eq!(table.info.max_count, 30);
    }

    #[test]
    fn rejects_bad_json() {
        assert!(FrequencyTable::from_json("{").is_err());
        assert!(SpecialCases::from_json("").unwrap().last.is_empty());
    }
}
