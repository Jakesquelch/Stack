# Stack

A simple phone app (PWA) for our poker cash game. It tracks buy-ins and rebuys during a game, works out who pays whom at the end, and keeps a history and leaderboard of every game. All money is in GBP, stored as integer pence.

The full plan is in [`docs/plan.md`](docs/plan.md), and the progress log is in [`docs/tracker.md`](docs/tracker.md).

## Status

| Phase | State |
|---|---|
| 0: Setup | App scaffold, config and migration done. Supabase projects, Vercel and GitHub secrets still to do |
| 1: Core logic | Done: `settle.ts` and `money.ts` with tests |
| 2: Game night (MVP) | Not started |
| 3: History & leaderboard | Not started |
| 4: Polish | Not started |

The app itself is still a placeholder page. The next step is connecting a dev Supabase project so Phase 2 can be built against it.

## Tech

React, TypeScript and Vite · Tailwind CSS · TanStack Query · React Router · Supabase (Postgres, anonymous sign-ins, RLS) · vite-plugin-pwa · Vitest · hosted on Vercel

## Getting started

Needs Node 22 (installed here with nvm).

```bash
npm install
cp .env.example .env.local   # fill in the dev Supabase URL and anon key
npm run dev
```

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm test` | Run the unit tests (Vitest) |
| `npm run build` | Type-check and build for production |
| `npm run lint` | Lint with oxlint |

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

The prod URL and anon key go in Vercel's environment variables and in the GitHub secrets `SUPABASE_URL` and `SUPABASE_ANON_KEY`. The keep-alive workflow uses those secrets to ping the database every 6 hours so the free project doesn't pause.

## Layout

```
src/lib/          settle-up algorithm, money helpers, and their tests
src/              React app (pages and components arrive in Phase 2)
supabase/         CLI config and migrations
.github/workflows keep-alive ping
docs/             plan and tracker
```
