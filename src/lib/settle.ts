// Settle-up: works out who pays whom after a game. All amounts are pence.

export type Balance = { playerId: string; net: number }
export type Transfer = { from: string; to: string; amount: number }

/**
 * Repeatedly matches the biggest loser with the biggest winner.
 * Gives at most `players − 1` transfers. Throws if the nets don't sum to zero.
 */
export function settle(balances: Balance[]): Transfer[] {
  const total = balances.reduce((sum, b) => sum + b.net, 0)
  if (total !== 0) throw new Error(`Nets don't balance (off by ${total}p)`)

  const debtors = balances.filter((b) => b.net < 0).map((b) => ({ ...b, net: -b.net }))
  const creditors = balances.filter((b) => b.net > 0).map((b) => ({ ...b }))
  const transfers: Transfer[] = []

  while (debtors.length && creditors.length) {
    debtors.sort((a, b) => b.net - a.net)
    creditors.sort((a, b) => b.net - a.net)
    const d = debtors[0]
    const c = creditors[0]
    const amount = Math.min(d.net, c.net)
    transfers.push({ from: d.playerId, to: c.playerId, amount })
    d.net -= amount
    c.net -= amount
    if (d.net === 0) debtors.shift()
    if (c.net === 0) creditors.shift()
  }
  return transfers
}
