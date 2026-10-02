-- Initial schema. All money is integer pence.
-- The passphrase is NOT set here (keeps it out of git). Run this in each project's SQL editor:
--   insert into settings (passphrase_hash)
--   values (extensions.crypt('three random words', extensions.gen_salt('bf')));

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- the crew passphrase, stored as a bcrypt hash. RLS on with no policies, so the API can't read it
create table public.settings (
  id               int primary key default 1 check (id = 1),  -- only ever one row
  passphrase_hash  text not null
);

create table public.players (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) between 1 and 40),
  created_at  timestamptz not null default now()
);
-- stops "Dave" and "dave" both existing
create unique index players_name_ci on public.players (lower(name));

-- phones that have entered the passphrase (one row per Supabase anonymous user)
create table public.members (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  player_id  uuid references public.players(id),  -- whose phone this is, set on "pick your name"
  joined_at  timestamptz not null default now()
);

create table public.games (
  id                    uuid primary key default gen_random_uuid(),
  default_buy_in_pence  int  not null check (default_buy_in_pence > 0),
  status                text not null default 'live' check (status in ('live','finished','cancelled')),
  started_at            timestamptz not null default now(),
  finished_at           timestamptz
);
-- only one live game at a time, enforced by the database
create unique index one_live_game on public.games (status) where status = 'live';

-- who played in a game + their final stack
create table public.game_players (
  game_id            uuid references public.games(id) on delete cascade,
  player_id          uuid references public.players(id),
  final_stack_pence  int check (final_stack_pence >= 0),  -- null while playing; set on cash-out or at the end
  primary key (game_id, player_id)
);

-- every buy-in (the first one and each rebuy) is one row. This is also the activity log
create table public.buy_ins (
  id            uuid primary key default gen_random_uuid(),
  game_id       uuid not null,
  player_id     uuid not null,
  amount_pence  int  not null check (amount_pence > 0),
  recorded_by   uuid references public.players(id),  -- whose phone tapped it (the app fills this in)
  created_at    timestamptz not null default now(),
  -- a buy-in can only belong to someone who is in the game
  foreign key (game_id, player_id) references public.game_players on delete cascade
);
create index buy_ins_game on public.buy_ins (game_id);

-- transfers calculated when the game is settled (kept for the history view)
create table public.settlements (
  id            uuid primary key default gen_random_uuid(),
  game_id       uuid not null references public.games(id) on delete cascade,
  from_player   uuid not null references public.players(id),
  to_player     uuid not null references public.players(id),
  amount_pence  int  not null check (amount_pence > 0),
  check (from_player <> to_player)
);
create index settlements_game on public.settlements (game_id);

-- ---------------------------------------------------------------------------
-- Security: members (phones that know the passphrase) can read and write, nobody else
-- ---------------------------------------------------------------------------

create schema private;                          -- not exposed through the API
grant usage on schema private to authenticated; -- so RLS policies can call its functions

-- true if this phone has entered the passphrase
create function private.is_member() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.members where user_id = auth.uid()) $$;

revoke execute on function private.is_member() from public;
grant execute on function private.is_member() to authenticated;

alter table public.settings     enable row level security;  -- no policies: unreadable via the API
alter table public.players      enable row level security;
alter table public.members      enable row level security;
alter table public.games        enable row level security;
alter table public.game_players enable row level security;
alter table public.buy_ins      enable row level security;
alter table public.settlements  enable row level security;

create policy "members only" on public.players for all to authenticated
  using (private.is_member()) with check (private.is_member());
create policy "members only" on public.games for all to authenticated
  using (private.is_member()) with check (private.is_member());
create policy "members only" on public.game_players for all to authenticated
  using (private.is_member()) with check (private.is_member());
create policy "members only" on public.buy_ins for all to authenticated
  using (private.is_member()) with check (private.is_member());
create policy "members only" on public.settlements for all to authenticated
  using (private.is_member()) with check (private.is_member());

-- a phone can see and update only its own row (to pick its name). Rows are added by join_crew
create policy "read own row" on public.members for select to authenticated
  using (user_id = auth.uid());
create policy "update own row" on public.members for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- the anon key on its own gets nothing; signed-in phones go through RLS above
revoke all on all tables in schema public from anon;
revoke all on public.settings, public.members from authenticated;
grant select, insert, update, delete
  on public.players, public.games, public.game_players, public.buy_ins, public.settlements
  to authenticated;
grant select, update (player_id) on public.members to authenticated;

-- ---------------------------------------------------------------------------
-- Leaderboard. security_invoker = true makes the view obey the tables' RLS.
-- Keep the `with (...)` part whenever you edit this view.
-- ---------------------------------------------------------------------------

create view public.leaderboard with (security_invoker = true) as
select
  p.id,
  p.name,
  count(distinct gp.game_id)                            as games,
  coalesce(sum(bi.cnt), 0)                              as buy_ins,
  coalesce(sum(bi.cnt), 0) - count(distinct gp.game_id) as rebuys,
  coalesce(sum(bi.total), 0)                            as total_in_pence,
  coalesce(sum(gp.final_stack_pence - bi.total), 0)     as net_pence
from public.players p
join public.game_players gp on gp.player_id = p.id
join public.games g on g.id = gp.game_id and g.status = 'finished'
join (
  select game_id, player_id, count(*) as cnt, sum(amount_pence) as total
  from public.buy_ins group by game_id, player_id
) bi on bi.game_id = gp.game_id and bi.player_id = gp.player_id
group by p.id, p.name
order by net_pence desc;

revoke all on public.leaderboard from anon;
grant select on public.leaderboard to authenticated;

-- ---------------------------------------------------------------------------
-- Functions the app calls
-- ---------------------------------------------------------------------------

-- Checks the crew passphrase and, if right, adds this phone to members.
-- Lower-cased with spaces squashed so phone auto-capitals don't lock people out.
create function public.join_crew(passphrase text) returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
declare
  normalised text := lower(regexp_replace(trim(passphrase), '\s+', ' ', 'g'));
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  if not exists (
    select 1 from public.settings s
    where s.passphrase_hash = extensions.crypt(normalised, s.passphrase_hash)
  ) then
    return false;
  end if;

  insert into public.members (user_id) values (auth.uid())
  on conflict (user_id) do nothing;
  return true;
end;
$$;

-- Saves the transfers and marks the game finished, all in one transaction.
-- transfers: [{ "from": uuid, "to": uuid, "amount": pence }, ...] as returned by settle()
-- Runs as the caller, so the members-only RLS applies.
create function public.finish_game(game_id uuid, transfers jsonb) returns void
language plpgsql volatile security invoker set search_path = ''
as $$
declare
  game_status text;
begin
  -- 1. the game must still be live (lock it so a second press waits, then fails)
  select g.status into game_status from public.games g where g.id = finish_game.game_id for update;
  if game_status is null then
    raise exception 'Game not found';
  elsif game_status <> 'live' then
    raise exception 'Game is already %', game_status;
  end if;

  -- 2. every player needs a final stack
  if exists (
    select 1 from public.game_players gp
    where gp.game_id = finish_game.game_id and gp.final_stack_pence is null
  ) then
    raise exception 'Every player needs a final stack';
  end if;

  -- 3. the nets must sum to zero, and 4. the transfers must settle every player exactly
  if exists (
    with nets as (
      select gp.player_id,
             gp.final_stack_pence - coalesce(
               (select sum(b.amount_pence) from public.buy_ins b
                where b.game_id = gp.game_id and b.player_id = gp.player_id), 0) as net
      from public.game_players gp
      where gp.game_id = finish_game.game_id
    ),
    t as (
      select x."from", x."to", x.amount
      from jsonb_to_recordset(transfers) as x("from" uuid, "to" uuid, amount int)
    ),
    moved as (
      select "from" as player_id, amount as delta from t   -- paying out evens up a loser
      union all
      select "to", -amount from t                          -- receiving evens up a winner
    )
    select 1
    from nets n
    full join (select m.player_id, sum(m.delta) as delta from moved m group by m.player_id) m
      on m.player_id = n.player_id
    where n.player_id is null                              -- transfer to/from someone not in the game
       or coalesce(n.net, 0) + coalesce(m.delta, 0) <> 0   -- someone left uneven
  ) then
    raise exception 'Stacks and transfers do not balance';
  end if;

  insert into public.settlements (game_id, from_player, to_player, amount_pence)
  select finish_game.game_id, x."from", x."to", x.amount
  from jsonb_to_recordset(transfers) as x("from" uuid, "to" uuid, amount int);

  update public.games g
  set status = 'finished', finished_at = now()
  where g.id = finish_game.game_id;
end;
$$;

-- called by the keep-alive job; reads a table so it counts as activity, returns nothing sensitive
create function public.ping() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.games) $$;

revoke execute on function public.join_crew(text) from public, anon;
revoke execute on function public.finish_game(uuid, jsonb) from public, anon;
grant execute on function public.join_crew(text) to authenticated;
grant execute on function public.finish_game(uuid, jsonb) to authenticated;
grant execute on function public.ping() to anon, authenticated;
