# Poker Night Tracker — Project Plan

A simple PWA for our cash game crew (~10 people) that tracks buy-ins and rebuys during a game, settles up who pays whom at the end, and keeps a history and leaderboard of every game.

---

## 1. Principles

- **Super simple.** Three screens and no clutter. If a feature needs explaining, cut it.
- **Low interaction during the game.** One person runs the table. Everyone else can watch but doesn't have to tap anything.
- **Easy to join.** Open a link, add it to the home screen, enter the passphrase, pick your name. No accounts or emails.
- **£0 to run.** Free hosting and free database tier.

### House rules the app relies on
- **Nothing changes hands at the table.** Every buy-in is settled by bank transfer after the game, so settle-up only has to work out who pays whom.
- **One person records buy-ins**, so the same rebuy doesn't get logged twice.
- **One person presses Settle.**

---

## 2. How it works (user flow)

### Joining (once per person)
1. Jake sends the app link in the group chat.
2. Friend opens it and adds it to their home screen **first** (iPhone: Safari → Share → Add to Home Screen; Android: Install app). On iPhone the home-screen app doesn't share storage with Safari, so joining in Safari wouldn't carry over. The join page says this.
3. Enter the crew passphrase. The phone stays signed in after that.
4. Tap their name from the list, or add themselves if new. This tells the app whose phone it is, so the activity log can show who recorded each buy-in and the leaderboard can highlight your row.

### Game night
1. **Start game.** Anyone can start one. Pick the default buy-in for the night (e.g. £15 or £20) and tick who's playing, or type a new name for a guest. Everyone starts with one buy-in at the default amount.
2. **During the game.** Each player row has a big **+ Rebuy** button with a small **£…** button next to it.
   - **+ Rebuy** = rebuy at the default amount. It ignores taps while the last one is still saving, so a double-tap doesn't count twice.
   - **£…** = a different amount: quick options (£10 / £15 / £20 / custom).
   - **+ Add player** for late arrivals: pick from the list or type a new name. They start with one buy-in at the default amount.
   - **Cash out** a player who leaves early: enter their stack there and then. Their row greys out and shows their result. Tap it to fix the stack, or to put them back in if they return.
   - **Activity log:** every buy-in with the time and who recorded it. Tap an entry to remove it (with a confirmation). This is how mistakes are undone and duplicates are spotted.
   - **Cancel game** (for a game started by mistake): a confirmation that says what will be lost ("Delete tonight's game and its 23 buy-ins?") with a red button. The game is marked cancelled, not deleted, so it can be recovered from the Supabase dashboard.
   - Live view shows each player's number of buy-ins and total bought in, plus the pot total.
3. **End game.** Enter the final stack (£) for everyone still playing. Cashed-out players already have theirs. Our chips are valued in £ (usually £5, £1, 25p and 10p, but that can change), so stacks are typed straight in as £ amounts. The app doesn't check stacks against chip values, so changing the chips never needs an app change.
4. **Check.** The app compares the total of final stacks with the total bought in.
   - Match → continue.
   - Mismatch → show the difference ("Stacks are £5 short") and fix a stack by hand until it matches. The activity log helps find a duplicate or missing rebuy.
5. **Settle up.** Pressing **Settle** works out the transfers, saves them and finishes the game in one step (see section 6). It then shows each player's net and the list of transfers ("Jake → Alice £40"), with a "Copy" button to paste into the group chat.
6. Game is saved to history.

---

## 3. Screens

Bottom nav with three tabs:

| Tab | Contents |
|---|---|
| **Game** | Start a game or show the live game in progress (with the activity log) → end game → settle up |
| **History** | List of finished games (newest first). Tap one for details |
| **Leaderboard** | All players ranked by all-time net profit/loss |

### History — game detail
Date, default buy-in, and a table:

| Player | Buy-ins | Total in | Final stack | Net |
|---|---|---|---|---|
| Jake | 3 | £60 | £7 | −£53 |
| Alice | 1 | £20 | £60 | +£40 |

Plus the transfers for that game.

### Leaderboard
Ranked best → worst by net P/L. Seven columns won't fit on a phone, so each row shows:

| # | Player | Net P/L | Games |
|---|---|---|---|

Tap a row to see their Buy-ins, Rebuys and Total bought in. Your own row is highlighted.

- Buy-ins = total number of buy-ins (including the first one each game)
- Rebuys = buy-ins minus games played
- Individual stats live here. There is no separate player page.

### Phone details
- Money inputs use `inputmode="decimal"`, so phones show the number pad with a decimal point.
- The passphrase input has auto-capitalise and autocorrect turned off.

---

## 4. Tech stack

| Part | Choice | Why |
|---|---|---|
| Frontend | React + TypeScript + Vite | Fast setup, huge ecosystem |
| Data fetching | TanStack Query | Caching, refetch when the app is reopened, polling during a live game |
| Routing | React Router | Three tabs plus `/history/:id` |
| PWA | `vite-plugin-pwa` | Manifest, icons and service worker in one place. Use `registerType: 'autoUpdate'` so a game-night fix reaches phones instead of them running the old version |
| Styling | Tailwind CSS | Quick, mobile-first |
| Backend / DB | Supabase (Postgres) | Free tier, anonymous sign-ins, real-time updates, SQL functions |
| Hosting | Vercel | Free, auto-deploys from GitHub |
| Keep-alive | GitHub Actions | Pings Supabase so the free project doesn't pause |

(Angular would work just as well if preferred. The plan doesn't depend on React.) I will choose to go with React just because I have coded in Angular before so why not give something new a go.

---

## 5. Data model

**Store all money as integer pence** to avoid floating-point errors (£20 → `2000`).

```sql
-- the crew passphrase, stored as a bcrypt hash. RLS on with no policies, so the API can't read it
create table settings (
  id               int primary key default 1 check (id = 1),  -- only ever one row
  passphrase_hash  text not null
);

create table players (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);
-- stops "Dave" and "dave" both existing
create unique index players_name_ci on players (lower(name));

-- phones that have entered the passphrase (one row per Supabase anonymous user)
create table members (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  player_id  uuid references players(id),  -- whose phone this is, set on "pick your name"
  joined_at  timestamptz not null default now()
);

create table games (
  id                    uuid primary key default gen_random_uuid(),
  default_buy_in_pence  int  not null check (default_buy_in_pence > 0),
  status                text not null default 'live' check (status in ('live','finished','cancelled')),
  started_at            timestamptz not null default now(),
  finished_at           timestamptz
);
-- only one live game at a time, enforced by the database
create unique index one_live_game on games (status) where status = 'live';

-- who played in a game + their final stack
create table game_players (
  game_id            uuid references games(id) on delete cascade,
  player_id          uuid references players(id),
  final_stack_pence  int check (final_stack_pence >= 0),  -- null while playing; set on cash-out or at the end
  primary key (game_id, player_id)
);

-- every buy-in (the first one and each rebuy) is one row. This is also the activity log
create table buy_ins (
  id            uuid primary key default gen_random_uuid(),
  game_id       uuid not null,
  player_id     uuid not null,
  amount_pence  int  not null check (amount_pence > 0),
  recorded_by   uuid references players(id),  -- whose phone tapped it (the app fills this in)
  created_at    timestamptz not null default now(),
  -- a buy-in can only belong to someone who is in the game
  foreign key (game_id, player_id) references game_players on delete cascade
);

-- transfers calculated when the game is settled (kept for the history view)
create table settlements (
  id            uuid primary key default gen_random_uuid(),
  game_id       uuid not null references games(id) on delete cascade,
  from_player   uuid not null references players(id),
  to_player     uuid not null references players(id),
  amount_pence  int  not null check (amount_pence > 0),
  check (from_player <> to_player)
);
```

### Derived values
- **Buy-in count (per game)** = number of `buy_ins` rows for that player and game
- **Total in** = sum of `amount_pence`
- **Net** = `final_stack_pence − total in`
- **Cashed out** = has a `final_stack_pence` while the game is still live

### Leaderboard view
`security_invoker = true` makes the view obey the tables' RLS. Views skip RLS by default, which would let anyone with the link read every player's P/L. Keep the `with (...)` part whenever you edit the view.

```sql
create view leaderboard with (security_invoker = true) as
select
  p.id,
  p.name,
  count(distinct gp.game_id)                           as games,
  coalesce(sum(bi.cnt), 0)                             as buy_ins,
  coalesce(sum(bi.cnt), 0) - count(distinct gp.game_id) as rebuys,
  coalesce(sum(bi.total), 0)                           as total_in_pence,
  coalesce(sum(gp.final_stack_pence - bi.total), 0)    as net_pence
from players p
join game_players gp on gp.player_id = p.id
join games g on g.id = gp.game_id and g.status = 'finished'
join (
  select game_id, player_id, count(*) as cnt, sum(amount_pence) as total
  from buy_ins group by game_id, player_id
) bi on bi.game_id = gp.game_id and bi.player_id = gp.player_id
group by p.id, p.name
order by net_pence desc;
```

---

## 6. Settle-up algorithm

1. For each player: `net = final_stack − total_in`.
2. Check `sum(net) == 0`. If not, the stacks were miscounted: the app blocks settling and shows the difference. `settle()` also throws if it's ever called with unbalanced nets.
3. Split into **debtors** (net < 0) and **creditors** (net > 0), both sorted by size, largest first.
4. Repeatedly take the biggest debtor and the biggest creditor:
   - `amount = min(|debtor.net|, creditor.net)`
   - Record `debtor → creditor : amount`
   - Reduce both by `amount`. Remove anyone who reaches 0 and re-sort.
5. Done. At most `players − 1` transfers.

```ts
type Balance = { playerId: string; net: number }; // pence
type Transfer = { from: string; to: string; amount: number };

export function settle(balances: Balance[]): Transfer[] {
  const total = balances.reduce((sum, b) => sum + b.net, 0);
  if (total !== 0) throw new Error(`Nets don't balance (off by ${total}p)`);

  const debtors = balances.filter(b => b.net < 0).map(b => ({ ...b, net: -b.net }));
  const creditors = balances.filter(b => b.net > 0).map(b => ({ ...b }));
  const transfers: Transfer[] = [];

  while (debtors.length && creditors.length) {
    debtors.sort((a, b) => b.net - a.net);
    creditors.sort((a, b) => b.net - a.net);
    const d = debtors[0], c = creditors[0];
    const amount = Math.min(d.net, c.net);
    transfers.push({ from: d.playerId, to: c.playerId, amount });
    d.net -= amount; c.net -= amount;
    if (d.net === 0) debtors.shift();
    if (c.net === 0) creditors.shift();
  }
  return transfers;
}
```

Put this in its own file with unit tests (Vitest). It's the core logic and is easy to test.

### Finishing a game
Pressing **Settle** calls one database function, `finish_game(game_id, transfers)`, which does everything in a single transaction:
1. Checks the game is still live (so a second press does nothing).
2. Checks every player has a final stack.
3. Checks the nets sum to zero.
4. Saves the transfers to `settlements` and marks the game finished.

One call means a dropped connection can't leave a game half-saved. The transfers come from `settle()` in the app.

---

## 7. Security (keeping it simple but not open)

The goal is to stop randoms with the link from reading or editing data, without making anyone create an account.

- **Anonymous sign-ins.** On first open the app calls `supabase.auth.signInAnonymously()`, which gives the phone a Supabase user with no email or password. Turn anonymous sign-ins on in the dashboard's Auth settings.
- **One crew passphrase:** three random words, not a PIN. The Supabase URL and key are in the app's code, so anyone with the link can call the API directly and guess. It's stored as a bcrypt hash (`pgcrypto`'s `crypt()`) in `settings`. Lower-case it and squash repeated spaces before hashing and checking, so phone auto-capitals don't lock people out.
- **Joining.** `join_crew(passphrase)` checks the passphrase and adds the phone to `members`. The phone stays signed in after that, and the passphrase itself isn't stored on the phone.
- **Row Level Security on every table.** Members can read and write; everyone else gets nothing:

  ```sql
  create schema private;                          -- not exposed through the API
  grant usage on schema private to authenticated; -- so RLS policies can call its functions

  -- true if this phone has entered the passphrase
  create function private.is_member() returns boolean
  language sql stable security definer set search_path = ''
  as $$ select exists (select 1 from public.members where user_id = auth.uid()) $$;

  -- the same policy on players, games, game_players, buy_ins and settlements
  alter table buy_ins enable row level security;
  create policy "members only" on buy_ins for all to authenticated
    using (private.is_member()) with check (private.is_member());
  ```

  `members`: a phone can read and update only its own row (to pick its name). `settings`: RLS on, no policies.
- **Functions.** `security definer` functions get `set search_path = ''`, so table names are written in full (`public.games`). Helpers live in the `private` schema, because anything in `public` can be called through the API. Only put the functions the app calls in `public` (`join_crew`, `finish_game`), plus `ping`.
- **Real-time** works with this setup, because members can read the rows under RLS.
- **Locking someone out:** delete their rows from `members`. Changing the passphrase stops new phones joining.
- **New phone or cleared browser data:** the anonymous account is gone, so they enter the passphrase and pick their name again.
- Supabase strongly recommends a CAPTCHA (e.g. Cloudflare Turnstile) for anonymous sign-ins. Skip it at first: sign-ins are rate-limited (30 an hour per IP) and non-members can't see anything. Add it if junk sign-ups show up.

Good enough for a friends' app. Real accounts (Supabase Auth magic links) can come later if ever needed.

### Keeping Supabase awake
Free projects pause after about a week of low activity, which would take the app down on game night. A GitHub Actions workflow calls a `ping()` function every 6 hours so that never happens.
- The repo is private, so GitHub won't switch the schedule off during a long break (it only does that for public repos).
- `curl -f` makes the job fail if the ping fails, so GitHub emails you.
- About 120 runs a month, well inside GitHub's free minutes for private repos.

```sql
-- called by the keep-alive job; reads a table so it counts as activity, returns nothing sensitive
create function public.ping() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.games) $$;
```

```yaml
# .github/workflows/keep-alive.yml
name: Keep Supabase awake
on:
  schedule:
    - cron: '0 */6 * * *'  # every 6 hours
  workflow_dispatch:        # lets you run it by hand
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - run: >
          curl -fsS -X POST "${{ secrets.SUPABASE_URL }}/rest/v1/rpc/ping"
          -H "apikey: ${{ secrets.SUPABASE_ANON_KEY }}"
          -H "Content-Type: application/json" -d '{}'
```

---

## 8. Project structure

```
Stack/                         # repo root: the app lives next to docs/
├─ .github/workflows/
│  └─ keep-alive.yml           # pings Supabase so it doesn't pause
├─ docs/                       # this plan + tracker
├─ src/
│  ├─ lib/
│  │  ├─ supabase.ts           # client, anonymous sign-in, queries
│  │  ├─ settle.ts             # settle-up algorithm
│  │  ├─ settle.test.ts
│  │  ├─ money.ts              # pence ↔ £ formatting and parsing
│  │  └─ money.test.ts
│  ├─ pages/
│  │  ├─ Join.tsx              # passphrase + pick your name
│  │  ├─ Game.tsx              # start / live / end / settle
│  │  ├─ History.tsx
│  │  ├─ GameDetail.tsx
│  │  └─ Leaderboard.tsx
│  ├─ components/              # PlayerRow, RebuyButton, ActivityLog, BottomNav, etc.
│  └─ App.tsx
├─ supabase/
│  └─ migrations/              # schema changes, one file each (Supabase CLI)
├─ public/                     # app icons
├─ vercel.json                 # sends every route to index.html
└─ vite.config.ts              # PWA config
```

---

## 9. Build phases

### Phase 0 — Setup
- [x] Scaffold the app at the repo root: `npm create vite@latest . -- --template react-ts`
  - **Careful:** when it says the directory isn't empty, choose **Ignore files and continue**. **Remove existing files** deletes `docs/` and `CLAUDE.md`.
  - Afterwards, check `.gitignore` still ignores `.env` (Vite's template replaces the file).
- [x] Add Tailwind, `vite-plugin-pwa`, `@supabase/supabase-js`, TanStack Query, React Router, Vitest
- [x] Add `vercel.json` with a rewrite to `index.html`, so refreshing `/history/:id` doesn't 404
- [x] Create two Supabase projects (the free tier allows two): **dev** for building and testing, **prod** for real games. Turn on anonymous sign-ins in both
- [x] Write the schema as Supabase CLI migrations in `supabase/migrations/` and apply them with `supabase db push`. Once real games exist you can't just re-run one big `schema.sql`
- [x] Set the passphrase in each project's SQL editor, not in a migration, so it stays out of git: `insert into settings (passphrase_hash) values (extensions.crypt('three random words', extensions.gen_salt('bf')));`
- [x] Push to GitHub, connect to Vercel (auto-deploy on push). Prod keys go in Vercel, dev keys in `.env.local`
- [x] Add the keep-alive workflow, with the prod URL and key as GitHub secrets (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`)

### Phase 1 — Core logic
- [x] `settle.ts` + unit tests (balanced game, one big loser, everyone even, mismatch throws)
- [x] Random-games test: generate lots of balanced games and check every loser pays exactly what they lost, every winner gets exactly what they won, there are at most `players − 1` transfers, and every amount is a positive whole number of pence
- [x] `money.ts` helpers (pence ↔ "£12.50") + tests. Parsing typed input is the risky direction: `"0.29" * 100` is `28.999…`, so use `Math.round`. Reject anything with more than two decimal places

### Phase 2 — Game night (the MVP)
- [x] Join screen: add-to-home-screen instructions, passphrase, pick/add your name
- [x] PWA manifest + icons (moved up from Phase 4, since the first real night is when everyone installs it)
- [x] Start game: default buy-in + select players (or type a new name)
- [x] Live game: player rows, **+ Rebuy** (default amount) and a small **£…** button for other amounts
- [x] **+ Add player** for late arrivals
- [x] **Cash out** mid-game (enter their stack; tap to fix it or put them back in)
- [x] Activity log: time + who recorded each buy-in; tap to remove (with confirmation)
- [x] Cancel game: confirmation that says what will be lost, red button, marks the game cancelled
- [x] Live game refreshes every few seconds and when the app is reopened (TanStack Query). Realtime replaces the polling in Phase 4
- [x] End game: enter the remaining final stacks, mismatch check
- [x] Settle screen: nets + transfers + "Copy to clipboard"
- [x] `finish_game`: save settlements and mark the game finished in one call

**Milestone: use it at a real poker night.**

### Phase 3 — History & leaderboard
- [x] History list + game detail table
- [x] Leaderboard from the view: compact rows, tap for the rest, your own row highlighted

### Phase 4 — Polish
- [ ] Real-time updates (Supabase Realtime) so everyone's phone shows live rebuys
- [ ] Splash screen
- [ ] Edit/delete a finished game (for mistakes). Simplest: **Reopen** puts it back to live, then settle again and post the corrected transfers. People may already have paid, so someone may owe a small correction

---

## 10. Edge cases to handle

- Stacks don't add up to the pot → block settling, show the difference, fix a stack by hand. The activity log helps find a duplicate or missing rebuy
- Someone leaves early → **Cash out** records their stack there and then
- Someone arrives late → **+ Add player**
- Someone cashes out then comes back → tap their row to put them back in (clears their stack)
- A game started by mistake → **Cancel game** (confirmed first, and recoverable from the dashboard)
- Only one game can be live at a time → enforced by a unique index in the database
- The same rebuy recorded twice → house rule: one person records buy-ins. Rebuy ignores taps while saving, and the activity log shows who recorded what so a duplicate can be removed
- Two phones press Settle → house rule: one person settles. `finish_game` also refuses a game that's already finished
- Player finishes on £0 → valid (net = −total in)
- Odd amounts (e.g. £12.25) → pence handles it
- Chip values change → nothing to update. Stacks are entered as £ amounts, and the stacks-vs-pot check catches typos
- "Dave" and "dave" → names are unique regardless of capitals
- Supabase pauses the free project → keep-alive ping
- New phone or cleared browser data → enter the passphrase and pick your name again

---

## 11. Out of scope (for now)

- Multiple groups
- User accounts/logins
- Extra stats (biggest win, streaks, etc.)
- Payment links
- Tracking who has paid (everyone pays within a few days)
- Native app store apps

### Maybe later
- **Backups.** The free tier has no automatic backups. That's fine while we see whether the group sticks with the app. If it does, run `supabase db dump` every so often or add an Export button.
