-- Regulars: the all-time leaderboard shows regulars, with occasional players tucked away.
-- Only the admin phone can change who's a regular. To make a phone the admin, set is_admin
-- on its row in members using the Supabase Table Editor. Phones can't set it themselves.

-- which phone is the admin. members' grants only let a phone update player_id, so this stays put
alter table public.members add column is_admin boolean not null default false;

-- new players start as occasional; everyone already here starts as a regular
alter table public.players add column is_regular boolean not null default false;
update public.players set is_regular = true;

-- true if this phone is the admin
create function private.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce((select is_admin from public.members where user_id = auth.uid()), false) $$;

revoke execute on function private.is_admin() from public;
grant execute on function private.is_admin() to authenticated;

-- phones can still add players and fix names, but is_regular only changes through set_regular()
revoke insert, update on public.players from authenticated;
grant insert (name), update (name) on public.players to authenticated;

-- Marks a player as a regular or occasional. Admin only.
create function public.set_regular(player_id uuid, regular boolean) returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Only the admin can change who''s a regular';
  end if;

  update public.players set is_regular = set_regular.regular where id = set_regular.player_id;
end;
$$;

revoke execute on function public.set_regular(uuid, boolean) from public, anon;
grant execute on function public.set_regular(uuid, boolean) to authenticated;

-- the leaderboard view gains is_regular. New columns have to go on the end.
-- Keep the `with (...)` part whenever you edit this view.
create or replace view public.leaderboard with (security_invoker = true) as
select
  p.id,
  p.name,
  count(distinct gp.game_id)                            as games,
  coalesce(sum(bi.cnt), 0)                              as buy_ins,
  coalesce(sum(bi.cnt), 0) - count(distinct gp.game_id) as rebuys,
  coalesce(sum(bi.total), 0)                            as total_in_pence,
  coalesce(sum(gp.final_stack_pence - bi.total), 0)     as net_pence,
  p.is_regular
from public.players p
join public.game_players gp on gp.player_id = p.id
join public.games g on g.id = gp.game_id and g.status = 'finished'
join (
  select game_id, player_id, count(*) as cnt, sum(amount_pence) as total
  from public.buy_ins group by game_id, player_id
) bi on bi.game_id = gp.game_id and bi.player_id = gp.player_id
group by p.id, p.name, p.is_regular
order by net_pence desc;
