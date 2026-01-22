# Name Rarity

A privacy-first, Apple-inspired name rarity calculator. Everything runs locally in your browser — no tracking, no cookies, no external APIs.

## Features

- Dark-first, high-polish UI with subtle motion and soft elevation
- Transparent rarity tiers with confidence levels
- Share card generator (1080×1080 and 1200×630)
- Local-only computation with no data storage

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

## Scripts

- `npm run dev` — start the development server
- `npm run build` — create a production build
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
