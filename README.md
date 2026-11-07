# Name Rarity

A privacy-first, Apple-inspired name rarity calculator. Everything runs locally in your browser — no tracking, no cookies, no external APIs.

## Features

- Dark-first, high-polish UI with subtle motion and soft elevation
- Transparent rarity tiers with confidence levels
- Share card generator (1080×1080 and 1200×630)
- Local-only computation with no data storage

## Data

This project uses US-only frequency tables:

- **SSA baby names** (1880–latest, aggregated) for first and middle names.
- **US Census 2010 surnames** for last names.

Run the build script to download and generate compact JSON tables in `data/generated/`:

```bash
python3 scripts/build_data.py
```

Only compact, derived tables are committed. `percentile` in those tables is a log-count rarity index (0 = most common, 10000 = rarest), not a rank. Raw SSA files (`names/`) are gitignored; the script uses them if present, otherwise downloads.

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Vitest for unit tests

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Deploying

The site is fully static (no server, no env vars). Import the repo into Vercel or Netlify and use the defaults (`npm run build`), or run `npm run build` and serve `.next` with `npm run start`.

## License

MIT. Name data comes from the US SSA and Census Bureau (public domain US government data); see `/sources`.

## Scripts

- `npm run dev` — start the development server
- `npm run build` — create a production build
- `npm run build:data` — download and generate the SSA/Census frequency tables
- `npm run start` — run the production server
- `npm run lint` — run Next.js linting
- `npm run test` — run unit tests

## Deploying to Vercel

1. Push this repo to GitHub.
2. Create a new Vercel project and import the repository.
3. Set the framework preset to **Next.js**.
4. Use the default build settings (`npm run build`) and output (`.next`).
5. Deploy.

## Privacy

No analytics, no tracking, and no user data storage. Theme preference is stored in localStorage only.
