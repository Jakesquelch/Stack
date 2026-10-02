-- Game-night functions: starting a game and adding a late player each happen in one call,
-- so a dropped connection can't leave someone in the game without their first buy-in.

-- the player picked on this phone (null until they pick their name)
create function private.my_player_id() returns uuid
language sql stable security definer set search_path = ''
as $$ select player_id from public.members where user_id = auth.uid() $$;

revoke execute on function private.my_player_id() from public;
grant execute on function private.my_player_id() to authenticated;

-- the database fills in whose phone recorded each buy-in, so the app doesn't have to
alter table public.buy_ins alter column recorded_by set default private.my_player_id();

-- Starts a game with everyone on one buy-in at the default amount. Returns the game id.
-- Fails with one_live_game if a game is already live.
create function public.start_game(default_buy_in_pence int, player_ids uuid[]) returns uuid
language plpgsql volatile security invoker set search_path = ''
as $$
declare
  new_game_id uuid;
begin
  if coalesce(array_length(player_ids, 1), 0) < 2 then
    raise exception 'A game needs at least two players';
  end if;

  insert into public.games (default_buy_in_pence)
  values (start_game.default_buy_in_pence)
  returning id into new_game_id;

  insert into public.game_players (game_id, player_id)
  select new_game_id, p from unnest(player_ids) as p;

  insert into public.buy_ins (game_id, player_id, amount_pence)
  select new_game_id, p, start_game.default_buy_in_pence from unnest(player_ids) as p;

  return new_game_id;
end;
$$;

-- Adds a late arrival to a live game with one buy-in at the default amount
create function public.add_to_game(game_id uuid, player_id uuid) returns void
language plpgsql volatile security invoker set search_path = ''
as $$
declare
  buy_in int;
begin
  select g.default_buy_in_pence into buy_in
  from public.games g where g.id = add_to_game.game_id and g.status = 'live';
  if buy_in is null then
    raise exception 'Game is not live';
  end if;

  insert into public.game_players (game_id, player_id)
  values (add_to_game.game_id, add_to_game.player_id);

  insert into public.buy_ins (game_id, player_id, amount_pence)
  values (add_to_game.game_id, add_to_game.player_id, buy_in);
end;
$$;

revoke execute on function public.start_game(int, uuid[]) from public, anon;
revoke execute on function public.add_to_game(uuid, uuid) from public, anon;
grant execute on function public.start_game(int, uuid[]) to authenticated;
grant execute on function public.add_to_game(uuid, uuid) to authenticated;
