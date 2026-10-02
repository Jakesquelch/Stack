26th September:

- Set up github via SSH, got plan in, .gitignore and CLAUDE.md file

2nd October:

- Going to start building it now (Using Opus 5.5 at medium effort)
- Installed Node 22 via nvm (wasn't on the machine)
- Phase 0: scaffolded React + TS + Vite at the repo root, added Tailwind, vite-plugin-pwa (autoUpdate), Supabase, TanStack Query, React Router and Vitest. Added vercel.json, .env.example, the keep-alive workflow and Supabase CLI config (anonymous sign-ins on)
- Phase 1: settle.ts and money.ts with 18 passing tests, including 2,000 random games for settle and a pence ↔ £ round-trip check from 0p to £100. Typed amounts are parsed by splitting the string, so no floating-point errors
- Wrote the database schema as a migration (tables, RLS, leaderboard view, join_crew, finish_game, ping). finish_game also checks the transfers leave everyone even. Tested it with 27 checks in PGlite (Postgres in WebAssembly), which caught and fixed two bugs
- Next: create the dev/prod Supabase projects, push the migration, set the passphrase, fill in .env.local, then start Phase 2

Wow, opus has just gone off and cooked up a storm. I had to go and create the supabase project and link it up and add the .env values but that was basically it. The app is working in my browser. It's been tested and is working well. Now looking into getting it on vercel so that I can get it on my phone.

Potential issues/improvements:
- What if we don't all want to buy in with the same amount of money at the start?