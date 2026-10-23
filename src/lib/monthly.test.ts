import { describe, expect, it } from 'vitest'
import type { GameBuyIn } from './awards'
import { addMonths, formatMonth, monthOf, standings, type ResultGame } from './monthly'

/** A finished game: stacks per player, plus the buy-ins each player made */
function game(id: string, players: Record<string, { stack: number; buyIns: number[] }>) {
  const g: ResultGame = {
    id,
    started_at: '2026-10-04T19:00:00Z',
    finished_at: '2026-10-04T23:00:00Z',
    game_players: Object.entries(players).map(([player_id, p]) => ({
      player_id,
      name: player_id,
      final_stack_pence: p.stack,
    })),
  }
  const buyIns: GameBuyIn[] = Object.entries(players).flatMap(([player_id, p]) =>
    p.buyIns.map((amount_pence) => ({ game_id: id, player_id, amount_pence })),
  )
  return { g, buyIns }
}

describe('monthOf', () => {
  it('uses UK time, so a game just after midnight in summer time counts for the new month', () => {
    // 00:30 BST on 1 October
    expect(monthOf('2026-09-30T23:30:00Z')).toBe('2026-10')
  })

  it('uses GMT in winter', () => {
    // 23:30 GMT on 31 October, after the clocks go back
    expect(monthOf('2026-10-31T23:30:00Z')).toBe('2026-10')
  })
})

describe('addMonths', () => {
  it('goes back across a year', () => {
    expect(addMonths('2026-01', -1)).toBe('2025-12')
  })

  it('goes forward across a year', () => {
    expect(addMonths('2025-12', 1)).toBe('2026-01')
  })
})

describe('formatMonth', () => {
  it('spells out the month', () => {
    expect(formatMonth('2026-10')).toBe('October 2026')
  })
})

describe('standings', () => {
  it('adds up each player across games, best first', () => {
    const a = game('g1', {
      sam: { stack: 8400, buyIns: [2000] }, // +£64
      tom: { stack: 0, buyIns: [2000, 2000, 2000] }, // −£60, 2 rebuys
      matt: { stack: 400, buyIns: [2000, 400] }, // −£20, 1 rebuy
    })
    const b = game('g2', {
      tom: { stack: 3000, buyIns: [2000] }, // +£10
      matt: { stack: 1000, buyIns: [2000] }, // −£10
    })
    expect(standings([a.g, b.g], [...a.buyIns, ...b.buyIns])).toEqual([
      { id: 'sam', name: 'sam', games: 1, buyIns: 1, rebuys: 0, totalIn: 2000, net: 6400 },
      { id: 'matt', name: 'matt', games: 2, buyIns: 3, rebuys: 1, totalIn: 4400, net: -3000 },
      { id: 'tom', name: 'tom', games: 2, buyIns: 4, rebuys: 2, totalIn: 8000, net: -5000 },
    ])
  })

  it("ignores buy-ins from games that aren't included", () => {
    const a = game('g1', { sam: { stack: 2000, buyIns: [2000] } })
    const other = game('g2', { sam: { stack: 0, buyIns: [2000] } })
    expect(standings([a.g], [...a.buyIns, ...other.buyIns])).toEqual([
      { id: 'sam', name: 'sam', games: 1, buyIns: 1, rebuys: 0, totalIn: 2000, net: 0 },
    ])
  })

  it('puts ties in name order', () => {
    const a = game('g1', {
      tom: { stack: 2000, buyIns: [2000] },
      dave: { stack: 2000, buyIns: [2000] },
    })
    expect(standings([a.g], a.buyIns).map((r) => r.id)).toEqual(['dave', 'tom'])
  })

  it('is empty with no games', () => {
    expect(standings([], [])).toEqual([])
  })
})
