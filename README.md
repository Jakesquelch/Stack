# Stack

A simple phone app (PWA) for our poker cash game. It tracks buy-ins and rebuys during a game, works out who pays whom at the end, and keeps a history and leaderboard of every game. All money is in GBP, stored as integer pence.

**Live at [jake-stack.vercel.app](https://jake-stack.vercel.app).** Open it on your phone, add it to your home screen (iPhone: from Safari), then open it from the icon and enter the crew passphrase.

The full plan is in [`docs/plan.md`](docs/plan.md), and the progress log is in [`docs/tracker.md`](docs/tracker.md).

## Status

| Phase | State |
|---|---|
| 0: Setup | Done: dev and prod Supabase, Vercel deploys from `main`, keep-alive running |
| 1: Core logic | Done: `settle.ts` and `money.ts` with tests |
| 2: Game night (MVP) | Done. Next milestone: use it at a real poker night |
| 3: History & leaderboard | Done |
| 4: Polish | Not started |

You can join, start a game, record rebuys, add late players, cash people out, fix mistakes from the activity log, and settle up, then look back through past games and the all-time leaderboard.

## Tech

React, TypeScript and Vite · Tailwind CSS · TanStack Query · React Router · Supabase (Postgres, anonymous sign-ins, RLS) · vite-plugin-pwa · Vitest · hosted on Vercel

## Getting started

Needs Node 22 (installed here with nvm).

```bash
npm install
cp .env.example .env.local   # fill in the dev Supabase URL and publishable key
npm run dev
```

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm test` | Run the unit tests (Vitest) |
| `npm run build` | Type-check and build for production |
| `npm run lint` | Lint with oxlint |
| `npm run types` | Regenerate `src/lib/database.types.ts` from the linked Supabase project |
| `npm run icons` | Regenerate the app icons from `public/logo.svg` |

## Database setup

The schema lives in `supabase/migrations/`. For each Supabase project (dev and prod):

1. Turn on anonymous sign-ins (Authentication → Sign In / Providers).
2. Link the project and apply the migrations:
   ```bash
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```
3. Set the crew passphrase in the SQL editor. It's kept out of git on purpose:
   ```sql
   insert into settings (passphrase_hash)
   values (extensions.crypt('three random words', extensions.gen_salt('bf')));
   ```

The prod URL and publishable key go in Vercel's environment variables and in the GitHub secrets `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. The keep-alive workflow uses those secrets to ping the database every 6 hours so the free project doesn't pause.

## Layout

```
src/lib/          Supabase client, queries, settle-up, money helpers and tests
src/pages/        Join, Game, History, GameDetail, Leaderboard
src/components/   live game pieces: player rows, sheets, activity log, end game
supabase/         CLI config and migrations
.github/workflows keep-alive ping
docs/             plan and tracker
```
