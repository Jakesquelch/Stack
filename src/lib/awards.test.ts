import { describe, expect, it } from 'vitest'
import { awards, type FinishedGame, type GameBuyIn } from './awards'

/** A finished game: stacks per player, plus the buy-ins each player made */
function game(id: string, finishedAt: string, players: Record<string, { stack: number; buyIns: number[] }>) {
  const g: FinishedGame = {
    id,
    finished_at: finishedAt,
    game_players: Object.entries(players).map(([player_id, p]) => ({ player_id, final_stack_pence: p.stack })),
  }
  const buyIns: GameBuyIn[] = Object.entries(players).flatMap(([player_id, p]) =>
    p.buyIns.map((amount_pence) => ({ game_id: id, player_id, amount_pence })),
  )
  return { g, buyIns }
}

describe('awards', () => {
  it('finds the biggest night, worst night and most rebuys', () => {
    const a = game('g1', '2026-10-04T23:00:00Z', {
      sam: { stack: 8400, buyIns: [2000] }, // +£64
      tom: { stack: 0, buyIns: [2000, 2000, 2000] }, // −£60, 2 rebuys
      matt: { stack: 0, buyIns: [2000, 400] }, // −£24, 1 rebuy
    })
    const b = game('g2', '2026-10-11T23:00:00Z', {
      tom: { stack: 3000, buyIns: [2000, 2000] }, // −£10, 1 rebuy (3 in total)
      matt: { stack: 1000, buyIns: [2000] }, // −£10
      dave: { stack: 4000, buyIns: [2000] }, // +£20
    })
    expect(awards([a.g, b.g], [...a.buyIns, ...b.buyIns])).toEqual({
      biggestNight: { playerId: 'sam', net: 6400 },
      worstNight: { playerId: 'tom', net: -6000 },
      mostRebuys: { playerId: 'tom', rebuys: 3 },
    })
  })

  it('gives a tie to whoever set the record first, whatever order the games arrive in', () => {
    const later = game('g2', '2026-10-11T23:00:00Z', {
      dave: { stack: 4000, buyIns: [2000] },
      ben: { stack: 0, buyIns: [2000, 2000] },
    })
    const earlier = game('g1', '2026-10-04T23:00:00Z', {
      sam: { stack: 4000, buyIns: [2000] },
      alex: { stack: 0, buyIns: [2000, 2000] },
    })
    expect(awards([later.g, earlier.g], [...later.buyIns, ...earlier.buyIns])).toEqual({
      biggestNight: { playerId: 'sam', net: 2000 },
      worstNight: { playerId: 'alex', net: -4000 },
      mostRebuys: { playerId: 'alex', rebuys: 1 },
    })
  })

  it('gives no awards when nobody won, lost or rebought', () => {
    const a = game('g1', '2026-10-04T23:00:00Z', {
      sam: { stack: 2000, buyIns: [2000] },
      tom: { stack: 2000, buyIns: [2000] },
    })
    expect(awards([a.g], a.buyIns)).toEqual({ biggestNight: null, worstNight: null, mostRebuys: null })
  })

  it("ignores buy-ins from games that aren't finished", () => {
    const a = game('g1', '2026-10-04T23:00:00Z', {
      sam: { stack: 4000, buyIns: [2000] },
      tom: { stack: 0, buyIns: [2000, 2000] },
    })
    const live = [2000, 2000, 2000, 2000].map((amount_pence) => ({ game_id: 'live', player_id: 'sam', amount_pence }))
    expect(awards([a.g], [...a.buyIns, ...live])).toEqual({
      biggestNight: { playerId: 'sam', net: 2000 },
      worstNight: { playerId: 'tom', net: -4000 },
      mostRebuys: { playerId: 'tom', rebuys: 1 },
    })
  })

  it('gives no awards before any games are finished', () => {
    expect(awards([], [])).toEqual({ biggestNight: null, worstNight: null, mostRebuys: null })
  })
})
