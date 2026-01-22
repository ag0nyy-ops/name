# Methodology

## Data sources

- **SSA baby names**: Aggregated counts across all available years (1880–latest) from the US Social Security Administration baby name datasets. This is used for **first** and **middle** name frequency tiers.
- **US Census surnames**: The official US Census 2010 surnames list (ranked, names with ≥100 occurrences). This is used for **last** name frequency tiers.

The application is US‑biased because both datasets are US‑only. For other regions, results may be misleading.

## Data generation & licensing

A build script downloads official sources, aggregates counts, and stores compact frequency tables in `data/generated/` so runtime stays offline:

```bash
python3 scripts/build_data.py
```

Only compact, derived frequency tables are committed (no raw CSV/ZIP redistribution). If the generated tables are empty, rerun the script with network access to populate them. Review source licensing and redistribution guidance at the SSA and Census websites.

## Parsing & normalization

- Lowercase, trim, and collapse whitespace.
- Strip punctuation except hyphens in last names.
- Detect suffixes: `jr`, `sr`, and roman numerals `i`–`xx`.
- Split: first token = first name; last token (after suffix removal) = last name; middle = everything in between.

## Tier mapping (percentiles)

Tiers are derived from percentile bins of the frequency tables (by rank):

- Tier 2: top 1%
- Tier 3: 1–5%
- Tier 4: 5–15%
- Tier 5: 15–35%
- Tier 6: 35–65%
- Tier 7: 65–85%
- Tier 8: 85–95%
- Tier 9: 95–99%
- Tier 10: bottom 1%

Tier 1 is reserved for missing parts (e.g., no middle, no suffix), not for “common.”

## Confidence rules

- **High**: part exists and is found in the relevant dataset or a special‑case override.
- **Medium**: found but combined edge cases (multi‑token middle or hyphenated last from parts).
- **Low**: not found in dataset, only one token input, or missing last name.

Overall confidence starts at **medium**, downgrades with missing/unknown parts, and upgrades to **high** only when both first and last are found and there are at least two tokens.

## Structural modifiers

Small nudges only:

- Stylized first‑name spelling (e.g., `z` ending or unusual `y` substitution): +0.5 tier max.
- Roman numeral suffix: +0.5 tier max.
- Hyphenated last name: baseline tier ≥ 7; if no exact match, split and combine parts (tier = max(part tiers) + 1, capped at 10).

## Caps & label rules

Hard caps prevent false precision:

- Single token input: score ≤ 45, label ≤ **uncommon**, confidence **low**.
- Missing last name: score ≤ 60, label ≤ **rare**.
- “Very rare” requires at least first + last.
- “Extreme” requires last tier ≥ 9 or a special‑case last/full match.

## Overall score

Each part contributes a rarity weight based on its tier. The weights are multiplied and then log‑scaled into a 0–100 score. The score is mapped to labels:

- 0–20 **common**
- 21–40 **uncommon**
- 41–60 **rare**
- 61–80 **very rare**
- 81–100 **extreme**

No “1 in N humans” claims are made. Scores are tiered **estimates**, not factual population statistics.

## Special cases

Overrides live in `data/specialCases.json` with the following keys:

- `fullExact`
- `firstExact`
- `middleExact`
- `lastExact`

These overrides can set tiers/confidence for specific inputs and are explicitly documented here to avoid hidden “magic.”
