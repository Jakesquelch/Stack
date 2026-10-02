import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { playerTotals, useGame, usePlayerNames } from '../lib/api'
import { formatDate } from '../lib/game'
import { formatNet, formatPence } from '../lib/money'

/** A finished game: everyone's result and who pays whom. Also where Settle lands. */
export function GameDetail() {
  const { id } = useParams()
  const game = useGame(id!)
  const nameOf = usePlayerNames(game.data?.game.game_players.map((p) => p.player_id))
  const [copied, setCopied] = useState(false)

  if (game.isPending) return <p className="text-slate-400">Loading…</p>
  if (game.isError) return <p className="text-rose-400">Couldn't load this game.</p>

  const { game: g, buyIns, settlements } = game.data
  const date = formatDate(g.finished_at ?? g.started_at)
  const rows = playerTotals(g.game_players, buyIns).sort((a, b) => (b.net ?? 0) - (a.net ?? 0))
  const transferLines = settlements.map(
    (s) => `${nameOf(s.from_player)} → ${nameOf(s.to_player)} ${formatPence(s.amount_pence)}`,
  )

  const copy = async () => {
    const text = [`Poker · ${date}`, ...(transferLines.length ? transferLines : ['Everyone broke even'])].join('\n')
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <Link to="/history" className="text-sm text-slate-400">
          ← History
        </Link>
        <h1 className="text-2xl font-bold">{date}</h1>
        <p className="text-sm text-slate-400">
          {formatPence(g.default_buy_in_pence)} buy-in
          {g.status !== 'finished' && ` · ${g.status}`}
        </p>
      </header>

      <section>
        <h2 className="mb-2 font-semibold text-slate-300">Who pays whom</h2>
        <div className="card p-4">
          {transferLines.length === 0 ? (
            <p className="text-slate-400">Nothing to pay. Everyone broke even.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {settlements.map((s, i) => (
                <li key={i} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate">
                    {nameOf(s.from_player)} <span className="text-slate-500">→</span> {nameOf(s.to_player)}
                  </span>
                  <span className="font-semibold tabular-nums">{formatPence(s.amount_pence)}</span>
                </li>
              ))}
            </ul>
          )}
          <button className="btn-secondary mt-4 w-full" onClick={copy}>
            {copied ? 'Copied ✓' : 'Copy for the group chat'}
          </button>
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-semibold text-slate-300">Results</h2>
        <table className="card w-full overflow-hidden text-sm tabular-nums">
          <thead className="text-left text-xs text-slate-400">
            <tr>
              <th className="py-2 pl-4 font-medium">Player</th>
              <th className="px-1 py-2 text-right font-medium">Buy-ins</th>
              <th className="px-1 py-2 text-right font-medium">In</th>
              <th className="px-1 py-2 text-right font-medium">Stack</th>
              <th className="py-2 pr-4 text-right font-medium">Net</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {rows.map((r) => (
              <tr key={r.playerId}>
                <td className="max-w-24 truncate py-2.5 pl-4 font-medium">{nameOf(r.playerId)}</td>
                <td className="px-1 text-right">{r.count}</td>
                <td className="px-1 text-right">{formatPence(r.totalIn)}</td>
                <td className="px-1 text-right">{r.finalStack === null ? '–' : formatPence(r.finalStack)}</td>
                <td
                  className={`pr-4 text-right font-semibold ${(r.net ?? 0) > 0 ? 'text-emerald-400' : (r.net ?? 0) < 0 ? 'text-rose-400' : ''}`}
                >
                  {r.net === null ? '–' : formatNet(r.net)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
