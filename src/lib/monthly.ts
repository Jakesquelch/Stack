// The monthly leaderboard, worked out from finished games. All amounts are pence.
import type { GameBuyIn } from './awards'

/** A finished game with who played. Works with awards() too. */
export type ResultGame = {
  id: string
  started_at: string
  finished_at: string
  game_players: { player_id: string; name: string; final_stack_pence: number | null }[]
}

/** One player's row on the leaderboard */
export type Standing = {
  id: string
  name: string
  games: number
  buyIns: number
  rebuys: number
  totalIn: number
  net: number
}

const UK_MONTH = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit' })

/** "2026-10": the month a moment falls in, in UK time. Games count towards the month they started in. */
export function monthOf(iso: string) {
  const parts = UK_MONTH.formatToParts(new Date(iso))
  const part = (type: string) => parts.find((p) => p.type === type)!.value
  return `${part('year')}-${part('month')}`
}

/** addMonths("2026-01", -1) is "2025-12" */
export function addMonths(month: string, n: number) {
  const [year, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(year, m - 1 + n, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** "2026-10" is "October 2026" */
export function formatMonth(month: string) {
  const [year, m] = month.split('-').map(Number)
  return new Date(Date.UTC(year, m - 1, 1)).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** Per-player results across the given games, best first. Same numbers as the all-time leaderboard view. */
export function standings(games: ResultGame[], buyIns: GameBuyIn[]): Standing[] {
  const gameIds = new Set(games.map((g) => g.id))
  const key = (gameId: string, playerId: string) => `${gameId}/${playerId}`
  const bought = new Map<string, { total: number; count: number }>()
  for (const b of buyIns) {
    if (!gameIds.has(b.game_id)) continue
    const k = key(b.game_id, b.player_id)
    const prev = bought.get(k) ?? { total: 0, count: 0 }
    bought.set(k, { total: prev.total + b.amount_pence, count: prev.count + 1 })
  }

  const rows = new Map<string, Standing>()
  for (const game of games) {
    for (const p of game.game_players) {
      const b = bought.get(key(game.id, p.player_id))
      // like the view, someone with no buy-ins in a game didn't play it
      if (!b) continue
      const row = rows.get(p.player_id) ?? { id: p.player_id, name: p.name, games: 0, buyIns: 0, rebuys: 0, totalIn: 0, net: 0 }
      row.games += 1
      row.buyIns += b.count
      row.rebuys += b.count - 1 // the first buy-in of a game isn't a rebuy
      row.totalIn += b.total
      row.net += (p.final_stack_pence ?? 0) - b.total
      rows.set(p.player_id, row)
    }
  }

  return [...rows.values()].sort((a, b) => b.net - a.net || a.name.localeCompare(b.name))
}
