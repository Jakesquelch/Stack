import { describe, expect, it } from 'vitest'
import { settle, type Balance, type Transfer } from './settle'

/** Each player's net after applying the transfers (paying out counts as getting back) */
function netsAfter(balances: Balance[], transfers: Transfer[]): Map<string, number> {
  const result = new Map(balances.map((b) => [b.playerId, b.net]))
  for (const t of transfers) {
    result.set(t.from, result.get(t.from)! + t.amount)
    result.set(t.to, result.get(t.to)! - t.amount)
  }
  return result
}

describe('settle', () => {
  it('settles a simple balanced game', () => {
    const balances = [
      { playerId: 'jake', net: -5300 },
      { playerId: 'alice', net: 4000 },
      { playerId: 'bob', net: 1300 },
    ]
    expect(settle(balances)).toEqual([
      { from: 'jake', to: 'alice', amount: 4000 },
      { from: 'jake', to: 'bob', amount: 1300 },
    ])
  })

  it('settles one big loser paying everyone', () => {
    const balances = [
      { playerId: 'a', net: -6000 },
      { playerId: 'b', net: 3000 },
      { playerId: 'c', net: 2000 },
      { playerId: 'd', net: 1000 },
    ]
    expect(settle(balances)).toEqual([
      { from: 'a', to: 'b', amount: 3000 },
      { from: 'a', to: 'c', amount: 2000 },
      { from: 'a', to: 'd', amount: 1000 },
    ])
  })

  it('needs no transfers when everyone is even', () => {
    expect(settle([{ playerId: 'a', net: 0 }, { playerId: 'b', net: 0 }])).toEqual([])
    expect(settle([])).toEqual([])
  })

  it('handles odd pence amounts', () => {
    const balances = [
      { playerId: 'a', net: -1225 },
      { playerId: 'b', net: 1215 },
      { playerId: 'c', net: 10 },
    ]
    expect(settle(balances)).toEqual([
      { from: 'a', to: 'b', amount: 1215 },
      { from: 'a', to: 'c', amount: 10 },
    ])
  })

  it('throws when the nets do not balance', () => {
    expect(() => settle([{ playerId: 'a', net: -500 }, { playerId: 'b', net: 0 }])).toThrow(
      "Nets don't balance (off by -500p)",
    )
  })

  it('settles random balanced games correctly', () => {
    // small seeded PRNG so a failure is reproducible
    let seed = 42
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31
      return seed / 2 ** 31
    }

    for (let game = 0; game < 2000; game++) {
      const players = 2 + Math.floor(random() * 11) // 2–12 players
      const balances: Balance[] = []
      let sum = 0
      for (let i = 0; i < players - 1; i++) {
        const net = Math.floor(random() * 20001) - 10000 // −£100 to +£100
        balances.push({ playerId: `p${i}`, net })
        sum += net
      }
      balances.push({ playerId: `p${players - 1}`, net: -sum })

      const transfers = settle(balances)

      // everyone ends exactly even: losers paid what they lost, winners got what they won
      for (const [id, net] of netsAfter(balances, transfers)) {
        expect(net, `game ${game}, ${id}`).toBe(0)
      }
      expect(transfers.length).toBeLessThanOrEqual(players - 1)
      for (const t of transfers) {
        expect(Number.isInteger(t.amount) && t.amount > 0).toBe(true)
        expect(t.from).not.toBe(t.to)
      }
    }
  })
})
