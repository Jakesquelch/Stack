// The leaderboard's awards, worked out from every finished game. All amounts are pence.

export type FinishedGame = {
  id: string
  finished_at: string
  game_players: { player_id: string; final_stack_pence: number | null }[]
}
export type GameBuyIn = { game_id: string; player_id: string; amount_pence: number }

export type NightAward = { playerId: string; net: number }
export type RebuyAward = { playerId: string; rebuys: number }

export type Awards = {
  biggestNight: NightAward | null // best single-game profit (only if someone finished up)
  worstNight: NightAward | null // worst single-game loss (only if someone finished down)
  mostRebuys: RebuyAward | null // most rebuys across all games (only if anyone has rebought)
}

/** Ties go to whoever got there first, so a record holder keeps it until someone beats it */
export function awards(games: FinishedGame[], buyIns: GameBuyIn[]): Awards {
  // total in and number of buy-ins per game + player
  const key = (gameId: string, playerId: string) => `${gameId}/${playerId}`
  const bought = new Map<string, { total: number; count: number }>()
  for (const b of buyIns) {
    const k = key(b.game_id, b.player_id)
    const prev = bought.get(k) ?? { total: 0, count: 0 }
    bought.set(k, { total: prev.total + b.amount_pence, count: prev.count + 1 })
  }

  let biggestNight: NightAward | null = null
  let worstNight: NightAward | null = null
  let mostRebuys: RebuyAward | null = null
  const rebuysSoFar = new Map<string, number>()

  const oldestFirst = [...games].sort((a, b) => a.finished_at.localeCompare(b.finished_at))
  for (const game of oldestFirst) {
    for (const p of game.game_players) {
      const { total, count } = bought.get(key(game.id, p.player_id)) ?? { total: 0, count: 0 }
      const net = (p.final_stack_pence ?? 0) - total

      if (net > 0 && net > (biggestNight?.net ?? 0)) biggestNight = { playerId: p.player_id, net }
      if (net < 0 && net < (worstNight?.net ?? 0)) worstNight = { playerId: p.player_id, net }

      // the first buy-in of a game isn't a rebuy
      const rebuys = (rebuysSoFar.get(p.player_id) ?? 0) + Math.max(count - 1, 0)
      rebuysSoFar.set(p.player_id, rebuys)
      if (rebuys > (mostRebuys?.rebuys ?? 0)) mostRebuys = { playerId: p.player_id, rebuys }
    }
  }

  return { biggestNight, worstNight, mostRebuys }
}
