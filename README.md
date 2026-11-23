# Name Rarity

How many people in the US share your name? Type a name and get an estimate, a 0–100 rarity score, and a breakdown of every part, all worked out in your browser. No tracking, no cookies, no server.

**Try it:** https://ag0nyy-ops.github.io/name/

The scoring engine is written in Rust and compiled to WebAssembly; the site is a static Next.js export served by GitHub Pages.

## How it works

1. The name is split into first, middle and last (titles, suffixes and `Last, First` order are handled; surname particles like *de la* join the last name).
2. The first name is looked up in SSA baby names (1880 to present), the last name in the 2010 Census surname list. Accents, hyphens and apostrophes are matched the way those lists store them.
3. `people = 335 million × first-name share × last-name share`
4. The score is that headcount on a log scale: 10,000+ people is 0, about one person is 57, a thousandth of a person is 100.

Names below a list's cutoff (5 babies a year, 100 people) aren't thrown out: they're counted just under the cutoff and the estimate is marked as an upper end. Every result shows its confidence and why. Full details: [methodology.md](methodology.md).

## Layout

| Path | What's there |
| --- | --- |
| `engine/` | Rust crate: parsing, lookups, phonetic matching, scoring. Builds to wasm with `wasm-pack`. |
| `lib/engine.ts` | Loads the wasm and the two tables in the browser; TypeScript types for results. |
| `components/`, `app/` | Next.js UI and pages. |
| `public/data/` | Compact SSA and Census tables (`{name: count}`, most common first). |
| `data/specialCases.json` | Hand-checked names the lists can't confirm, each with a note shown in the UI. |
| `scripts/build_data.py` | Downloads the source data and rebuilds the tables. |

## Development

Needs Node 20+, Rust stable with the `wasm32-unknown-unknown` target, and [wasm-pack](https://rustwasm.github.io/wasm-pack/).

```bash
rustup target add wasm32-unknown-unknown
npm install
npm run build:engine   # compiles engine/ into lib/wasm/
npm run dev
```

Open http://localhost:3000. Rerun `npm run build:engine` after changing the Rust code.

### Scripts

- `npm run build:engine`: build the wasm engine
- `npm run test:engine`: Rust tests (`cargo test` in `engine/`)
- `npm test`: TypeScript tests against the built wasm, including UI render checks
- `npm run lint`: ESLint
- `npm run build`: static export to `out/`
- `npm run build:data`: re-download SSA and Census data and rebuild the tables

To try a few names from the command line:

```bash
cargo run --manifest-path engine/Cargo.toml --release --example probe -- "Jay Patty" "José García"
```

## Deploying

`.github/workflows/pages.yml` builds the engine and the static site with `NEXT_PUBLIC_BASE_PATH=/name` and deploys `out/` to GitHub Pages on every push to `main`. In the repo settings, **Pages → Build and deployment → Source** must be set to **GitHub Actions**.

## Data and license

Code is MIT. Name data comes from the US Social Security Administration and the US Census Bureau, which are public domain US government works; see the [sources page](https://ag0nyy-ops.github.io/name/sources/).
