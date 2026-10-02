// Data the app reads, as TanStack Query hooks. Writes live next to the screens that make them.
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { ensureSession, must, supabase } from './supabase'

export type Player = { id: string; name: string }
export type GamePlayer = { player_id: string; final_stack_pence: number | null }
export type BuyIn = {
  id: string
  player_id: string
  amount_pence: number
  recorded_by: string | null
  created_at: string
}
export type LiveGame = {
  id: string
  default_buy_in_pence: number
  started_at: string
  players: GamePlayer[]
  buyIns: BuyIn[] // newest first
}

// how often a live game refreshes; Realtime replaces this in Phase 4
const LIVE_POLL_MS = 4000

/** Who this phone is: whether it has entered the passphrase, and whose name it picked */
export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const session = await ensureSession()
      const row = must(
        await supabase.from('members').select('player_id').eq('user_id', session.user.id).maybeSingle(),
      )
      return { userId: session.user.id, isMember: row !== null, playerId: row?.player_id ?? null }
    },
    staleTime: Infinity,
  })
}

export function usePlayers() {
  return useQuery({
    queryKey: ['players'],
    queryFn: async (): Promise<Player[]> =>
      must(await supabase.from('players').select('id, name').order('name')),
  })
}

/**
 * Lookup from player id to name. Pass the ids on screen: if one is missing (say another phone just
 * added a new player) the player list is refetched.
 */
export function usePlayerNames(ids: (string | null)[] = []) {
  const players = usePlayers()
  const known = new Map(players.data?.map((p) => [p.id, p.name]))
  // refetch once per new set of unknown ids, so an id that never resolves can't loop
  const missing = players.isSuccess
    ? [...new Set(ids)].filter((id) => id !== null && !known.has(id)).sort().join(',')
    : ''
  const { refetch } = players

  useEffect(() => {
    if (missing) refetch()
  }, [missing, refetch])

  return (id: string | null) => (id && known.get(id)) || '…'
}

/** The game in progress (null if there isn't one), with its players and buy-ins */
export function useLiveGame() {
  return useQuery({
    queryKey: ['liveGame'],
    queryFn: async (): Promise<LiveGame | null> => {
      const game = must(
        await supabase
          .from('games')
          .select('id, default_buy_in_pence, started_at, game_players(player_id, final_stack_pence)')
          .eq('status', 'live')
          .maybeSingle(),
      )
      if (!game) return null

      const buyIns = must(
        await supabase
          .from('buy_ins')
          .select('id, player_id, amount_pence, recorded_by, created_at')
          .eq('game_id', game.id)
          .order('created_at', { ascending: false }),
      )
      const { game_players, ...rest } = game
      return { ...rest, players: game_players, buyIns }
    },
    refetchInterval: LIVE_POLL_MS,
  })
}

/** A finished game with everything the detail/settle screen needs */
export function useGame(id: string) {
  return useQuery({
    queryKey: ['game', id],
    queryFn: async () => {
      const [game, buyIns, settlements] = await Promise.all([
        supabase
          .from('games')
          .select('id, status, default_buy_in_pence, started_at, finished_at, game_players(player_id, final_stack_pence)')
          .eq('id', id)
          .single()
          .then(must),
        supabase.from('buy_ins').select('player_id, amount_pence').eq('game_id', id).then(must),
        supabase.from('settlements').select('from_player, to_player, amount_pence').eq('game_id', id).then(must),
      ])
      return { game, buyIns, settlements }
    },
  })
}

/** Per-player totals for a game: buy-in count, total in, and net once they have a stack */
export function playerTotals(players: GamePlayer[], buyIns: Pick<BuyIn, 'player_id' | 'amount_pence'>[]) {
  return players.map((p) => {
    const mine = buyIns.filter((b) => b.player_id === p.player_id)
    const totalIn = mine.reduce((sum, b) => sum + b.amount_pence, 0)
    return {
      playerId: p.player_id,
      count: mine.length,
      totalIn,
      finalStack: p.final_stack_pence,
      net: p.final_stack_pence === null ? null : p.final_stack_pence - totalIn,
    }
  })
}

/** Finished games, newest first. For a finished game the stacks add up to the pot. */
export function useHistory() {
  return useQuery({
    queryKey: ['history'],
    queryFn: async () => {
      const games = must(
        await supabase
          .from('games')
          .select('id, default_buy_in_pence, finished_at, game_players(final_stack_pence)')
          .eq('status', 'finished')
          .order('finished_at', { ascending: false }),
      )
      return games.map((g) => ({
        id: g.id,
        finishedAt: g.finished_at!,
        defaultBuyIn: g.default_buy_in_pence,
        players: g.game_players.length,
        pot: g.game_players.reduce((sum, p) => sum + (p.final_stack_pence ?? 0), 0),
      }))
    },
  })
}

/** All-time results per player, best first (from the leaderboard view) */
export function useLeaderboard() {
  return useQuery({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      const rows = must(await supabase.from('leaderboard').select('*').order('net_pence', { ascending: false }))
      // views make every column nullable; these never are
      return rows.map((r) => ({
        id: r.id!,
        name: r.name!,
        games: Number(r.games),
        buyIns: Number(r.buy_ins),
        rebuys: Number(r.rebuys),
        totalIn: Number(r.total_in_pence),
        net: Number(r.net_pence),
      }))
    },
  })
}
