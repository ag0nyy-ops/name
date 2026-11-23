# Methodology (model 4.0)

The score comes from one number: how many people in the US you'd expect to have a given first and last name. The engine is in `engine/src/score.rs`; this file describes what it does.

## Data

- **SSA baby names**: national counts for every year from 1880 on, summed. Used for first and middle names. SSA omits names given to fewer than 5 babies in a year.
- **2010 Census surnames**: every surname held by at least 100 people. Used for last names.

Both are US-only and store names in lowercase a–z with no accents, spaces, hyphens or apostrophes. `scripts/build_data.py` rebuilds `public/data/*.json` from the official files.

The SSA totals used here aren't split by sex, so a name's count covers everyone given it. "Unisex" names need no special handling beyond that; a name that works as both a first name and a surname is scored from whichever slot it's in.

## Parsing

- First word = first name, last word = last name, words in between = middle names. `Last, First` is flipped.
- Titles (Dr, Mr, Mrs, Ms, Prof…) are dropped. Suffixes (Jr, Sr, II–X) are kept for display but don't change the count.
- Particles before the last word (de, la, van, der, von, di, du, le, st…) join the surname: *Ana de la Cruz* → `delacruz`.
- Matching keys strip accents (Unicode decomposition), hyphens and apostrophes: *José* → `jose`, *Jean-Luc* → `jeanluc`, *O'Brien* → `obrien`.
- Digits and symbols are ignored and lower confidence. Non-Latin scripts get no score.
- Single-letter middle names are initials and are left out of the estimate.

## Looking up a part

In order:

1. **Exact**: the key is in the list.
2. **Special**: a hand-checked entry in `data/specialCases.json`.
3. **Core**: a particle surname not listed whole falls back to its final word (overcounts, so confidence drops).
4. **Parts**: a hyphenated name not listed whole, but each half is: real, but below the cutoff.
5. **Missing**: not listed.

Anything not found exactly is counted at half the list's cutoff (2.5 for SSA, 50 for Census), and the estimate is marked as an upper end.

For missing names the engine also:

- checks whether the input looks like it isn't a name (unusually long, a letter tripled, no vowels, almost all consonants, a keyboard run). Listed names are never checked, so a real name is never flagged;
- searches for a sound-alike listed spelling (a Double Metaphone variant plus edit distance), e.g. *Braydyn* → *Brayden*. This only explains the result;
- notes when the name appears in the other list (a surname used as a first name, or the reverse).

## Estimate and score

```
people = 335,000,000 × (first count / SSA total) × (last count / Census total)
score  = clamp((log10(10,000) − log10(people)) / 7 × 100, 0, 100)
```

This assumes first and last names are independent. Real names cluster by culture and era, so treat the estimate as an order of magnitude. Middle names produce a separate, narrower estimate and don't change the score.

| Score | Label |
| --- | --- |
| 0–19 | common |
| 20–39 | uncommon |
| 40–59 | rare |
| 60–79 | very rare |
| 80–100 | extreme |

A single name gets its own score against its list: the list's most common name is 0 and a count of 1 is 100.

## Confidence

- **High**: both names found.
- **Medium**: a part is missing, core-only or hyphen-split; a middle name looks unusual; or only one name was given.
- **Low**: a missing part looks like it isn't a name, or the input had characters that were ignored.

If neither name is in the data, the result is "unknown" with no score.

## Tests

`cargo test` in `engine/` covers parsing, the phonetic index, table loading, scoring on a small fixture (hyphens, accents, apostrophes, particles, cutoffs, initials, special cases, random input) and on the real tables. `npm test` runs the compiled wasm and renders every kind of result.
