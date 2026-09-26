# Poker Night Tracker — Project Plan

A simple PWA for our cash game crew (~10 people) that tracks buy-ins and rebuys during a game, settles up who pays whom at the end, and keeps a history and leaderboard of every game.

---

## 1. Principles

- **Super simple.** Three screens and no clutter. If a feature needs explaining, cut it.
- **Low interaction during the game.** One person runs the table. Everyone else can watch but doesn't have to tap anything.
- **Easy to join.** Open a link, add it to the home screen, enter the passcode, pick your name. No accounts or emails.
- **£0 to run.** Free hosting and free database tier.

---

## 2. How it works (user flow)

### Joining (once per person)
1. Jake sends the app link in the group chat.
2. Friend opens it and adds it to their home screen (iPhone: Safari → Share → Add to Home Screen; Android: Install app).
3. Enter the crew passcode (saved on the phone after that).
4. Tap their name from the list, or add themselves if new (saved on the phone).

### Game night
1. **Start game.** Anyone can start one. Pick the default buy-in for the night (e.g. £15 or £20) and tick who's playing. Everyone starts with one buy-in at the default amount.
2. **During the game.** Each player row has a big **+ Rebuy** button.
   - Tap = rebuy at the default amount.
   - Different amount → quick options (£10 / £15 / £20 / custom).
   - Mistakes can be undone (remove the last buy-in).
   - Live view shows each player's number of buy-ins and total bought in, plus the pot total.
3. **End game.** Enter each player's final stack (£).
4. **Check.** The app compares the total of final stacks with the total bought in.
   - Match → continue.
   - Mismatch → show the difference ("Stacks are £5 short") and let people fix it before settling.
5. **Settle up.** Show each player's net and the list of transfers ("Jake → Alice £40"). Include a "Copy" button to paste into the group chat.
6. Game is saved to history.

---

## 3. Screens

Bottom nav with three tabs:

| Tab | Contents |
|---|---|
| **Game** | Start a game or show the live game in progress → end game → settle up |
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
Ranked best → worst by net P/L.

| # | Player | Net P/L | Games | Buy-ins | Rebuys | Total bought in |
|---|---|---|---|---|---|---|

- Buy-ins = total number of buy-ins (including the first one each game)
- Rebuys = buy-ins minus games played
- Individual stats live here. There is no separate player page.

---

## 4. Tech stack

| Part | Choice | Why |
|---|---|---|
| Frontend | React + TypeScript + Vite | Fast setup, huge ecosystem |
| PWA | `vite-plugin-pwa` | Manifest, icons and service worker in one place |
| Styling | Tailwind CSS | Quick, mobile-first |
| Backend / DB | Supabase (Postgres) | Free tier, real-time updates, SQL functions |
| Hosting | Vercel | Free, auto-deploys from GitHub |

(Angular would work just as well if preferred. The plan doesn't depend on React.)

---

## 5. Data model

**Store all money as integer pence** to avoid floating-point errors (£20 → `2000`).

```sql
create table players (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  created_at  timestamptz default now()
);

create table games (
  id                    uuid primary key default gen_random_uuid(),
  default_buy_in_pence  int  not null,
  status                text not null default 'live' check (status in ('live','finished')),
  started_at            timestamptz default now(),
  finished_at           timestamptz
);

-- who played in a game + their final stack
create table game_players (
  game_id            uuid references games(id) on delete cascade,
  player_id          uuid references players(id),
  final_stack_pence  int,              -- null until the game ends
  primary key (game_id, player_id)
);

-- every buy-in (the first one and each rebuy) is one row
create table buy_ins (
  id            uuid primary key default gen_random_uuid(),
  game_id       uuid references games(id) on delete cascade,
  player_id     uuid references players(id),
  amount_pence  int not null check (amount_pence > 0),
  created_at    timestamptz default now()
);

-- transfers calculated when the game is settled (kept for the history view)
create table settlements (
  id            uuid primary key default gen_random_uuid(),
  game_id       uuid references games(id) on delete cascade,
  from_player   uuid references players(id),
  to_player     uuid references players(id),
  amount_pence  int not null
);
```

### Derived values
- **Buy-in count (per game)** = number of `buy_ins` rows for that player and game
- **Total in** = sum of `amount_pence`
- **Net** = `final_stack_pence − total in`

### Leaderboard view
```sql
create view leaderboard as
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
2. Check `sum(net) == 0`. If not, the stacks were miscounted, so block settling and show the difference.
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

---

## 7. Security (keeping it simple but not open)

The goal is to stop randoms with the link from reading or editing data, without making anyone create an account.

- One **crew passcode**, stored as a hash in a Supabase `settings` table.
- Turn on **Row Level Security** on all tables with **no direct access** for the public (anon) key.
- All reads and writes go through **Postgres functions (RPC)** that take the passcode as a parameter, check it, then run (`security definer`). For example, `add_buy_in(passcode, game_id, player_id, amount)`.
- The app saves the passcode in `localStorage` after the first entry.

Good enough for a friends' app. Real accounts (Supabase Auth magic links) can come later if ever needed.

---

## 8. Project structure

```
poker-tracker/
├─ src/
│  ├─ lib/
│  │  ├─ supabase.ts        # client + RPC wrappers
│  │  ├─ settle.ts          # settle-up algorithm
│  │  ├─ settle.test.ts
│  │  └─ money.ts           # pence ↔ £ formatting
│  ├─ pages/
│  │  ├─ Join.tsx           # passcode + pick your name
│  │  ├─ Game.tsx           # start / live / end / settle
│  │  ├─ History.tsx
│  │  ├─ GameDetail.tsx
│  │  └─ Leaderboard.tsx
│  ├─ components/           # PlayerRow, RebuyButton, BottomNav, etc.
│  └─ App.tsx
├─ supabase/
│  └─ schema.sql            # tables, view, RPC functions
├─ public/                  # app icons
└─ vite.config.ts           # PWA config
```

---

## 9. Build phases

### Phase 0 — Setup
- [ ] `npm create vite@latest poker-tracker -- --template react-ts`
- [ ] Add Tailwind, `vite-plugin-pwa`, `@supabase/supabase-js`, Vitest
- [ ] Create a Supabase project, run `schema.sql`
- [ ] Push to GitHub, connect to Vercel (auto-deploy on push)

### Phase 1 — Core logic
- [ ] `settle.ts` + unit tests (balanced game, one big loser, everyone even, mismatch)
- [ ] `money.ts` helpers (pence ↔ "£12.50")

### Phase 2 — Game night (the MVP)
- [ ] Join screen: passcode + pick/add name
- [ ] Start game: default buy-in + select players
- [ ] Live game: player rows, **+ Rebuy** (default amount), long-press/second tap for other amounts, undo
- [ ] End game: enter final stacks, mismatch check
- [ ] Settle screen: nets + transfers + "Copy to clipboard"
- [ ] Save settlements, mark the game finished

**Milestone: use it at a real poker night.**

### Phase 3 — History & leaderboard
- [ ] History list + game detail table
- [ ] Leaderboard from the view

### Phase 4 — Polish
- [ ] Real-time updates (Supabase Realtime) so everyone's phone shows live rebuys
- [ ] PWA icons, splash screen, "Add to Home Screen" instructions on the join page
- [ ] Edit/delete a finished game (for mistakes)

---

## 10. Edge cases to handle

- Stacks don't add up to the pot → block settling and show the difference
- Someone leaves early → enter their final stack whenever they leave (the game stays open)
- Only one game can be live at a time
- Two people tap rebuy at once → each is its own row, so nothing is lost
- Player finishes on £0 → valid (net = −total in)
- Odd amounts (e.g. £12.50) → pence handles it

---

## 11. Out of scope (for now)

- Multiple groups
- User accounts/logins
- Extra stats (biggest win, streaks, etc.)
- Payment links
- Native app store apps