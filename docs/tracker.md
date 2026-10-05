### 26th September:

- Set up github via SSH, got plan in, .gitignore and CLAUDE.md file

### 2nd October:

- Going to start building it now (Using Opus 5.5 at medium effort)
- Installed Node 22 via nvm (wasn't on the machine)
- Phase 0: scaffolded React + TS + Vite at the repo root, added Tailwind, vite-plugin-pwa (autoUpdate), Supabase, TanStack Query, React Router and Vitest. Added vercel.json, .env.example, the keep-alive workflow and Supabase CLI config (anonymous sign-ins on)
- Phase 1: settle.ts and money.ts with 18 passing tests, including 2,000 random games for settle and a pence ↔ £ round-trip check from 0p to £100. Typed amounts are parsed by splitting the string, so no floating-point errors
- Wrote the database schema as a migration (tables, RLS, leaderboard view, join_crew, finish_game, ping). finish_game also checks the transfers leave everyone even. Tested it with 27 checks in PGlite (Postgres in WebAssembly), which caught and fixed two bugs
- Next: create the dev/prod Supabase projects, push the migration, set the passphrase, fill in .env.local, then start Phase 2

Wow, opus has just gone off and cooked up a storm. I had to go and create the supabase project and link it up and add the .env values but that was basically it. The app is working in my browser. It's been tested and is working well. Now looking into getting it on vercel so that I can get it on my phone.

Have now set up the prod supabase project and linked that to the project. Set up vercel so now this is live. Have got the app on my phone home page now and is working I believe. Just need to share it with my friends now and get them to join up, then it can be used.

- Dev Supabase checked: anonymous sign-in works, wrong passphrase rejected, non-members see nothing. Switched to Supabase's new publishable key (VITE_SUPABASE_PUBLISHABLE_KEY)
- Second migration: start_game and add_to_game do everything in one database call, and the database fills in who recorded each buy-in. Database checks now up to 36
- Phase 2 (game night): join screen, new game, live game (+ Rebuy that ignores double taps, £… for other amounts, add player, cash out, activity log with remove, cancel game), final stacks with the "£5 short" check, settle and copy for the group chat. Live game refreshes every 4 seconds
- App icons (poker chip logo) and iPhone home-screen setup
- Tested the whole game-night flow in a headless phone-sized browser against dev, with the settle-up maths checked by hand
- Phase 3: History list and Leaderboard (tap a row for buy-ins, rebuys, total in; your row highlighted)
- Prod Supabase project: migrations pushed, checked it's locked down. The Supabase CLI couldn't push at first because .env.local had a line without a NAME=, so keep that file to proper NAME=value lines
- Deployed to Vercel at jake-stack.vercel.app with the prod keys. A blank page at first was the env variables, fixed by correcting them and redeploying. The Vercel warning about the VITE_ prefix is fine: the URL and publishable key are meant to be public
- Installed on my phone and joined with the prod passphrase
- Keep-alive done: added the GitHub secrets (SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY, prod values) and ran the workflow once by hand. It went green, so it now pings prod every 6 hours and GitHub emails me if it ever fails. That finishes Phase 0
- Updated the README (live link, status) and ticked off Phase 0 in the plan
- Next: invite the crew, then Phase 4 (live updates, splash screen, reopen a settled game)

### 5th October:

Yesterday I showed my friends how to install the app on their phone and how to login etc, we then used it for the poker game. It worked great! Our addition of stacks at the end was correct, it calculated who owed who money and I could paste that into the gc. It successfully showed the game history and also updated the leaderboard.

### Reflection:

I think this project has gone well because I spent a while prepping. I spent a good few hours building that initial plan.md specification. I also spent a few days just thinking over what I want. If you have a clear-ish vision of what you want to produce, it will make the implementation using AI much easier, as you can specify your needs and the purpose of your project. For example I already knew that I wanted it to be a web app that could be added to the home screen, I know I wanted 3 pages, a basic UI, and my main problem solved:
- Calculating who pays who at the end of the night
From there I then came up with the additional features:
- Game history
- Player stat leaderboard
I used opus initially but did a final prompt with fable questioning things that I have maybe missed/not thought about or problems that I could hit (I think this was very important as made the spec much more informative and gave Opus a clear direction when it came to implementation). 

Potential issues/improvements:
- What if we don't all want to buy in with the same amount of money at the start?
- Don't need £10 or £15 buy in options
- What happens when someone presses settle? It doesn't update other peoples phone screens to that page. Can only 1 person settle?