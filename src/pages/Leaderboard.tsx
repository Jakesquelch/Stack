import { useState } from 'react'
import { useLeaderboard } from '../lib/api'
import { formatNet, formatPence } from '../lib/money'

/** All-time profit/loss. Tap a row for buy-ins, rebuys and total bought in. */
export function Leaderboard({ myPlayerId }: { myPlayerId: string }) {
  const leaderboard = useLeaderboard()
  const [open, setOpen] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Leaderboard</h1>

      {leaderboard.isPending && <p className="text-slate-400">Loading…</p>}
      {leaderboard.isError && <p className="text-rose-400">Couldn't load the leaderboard.</p>}
      {leaderboard.data?.length === 0 && <p className="text-slate-400">No finished games yet.</p>}

      {!!leaderboard.data?.length && (
        <div className="card overflow-hidden">
          <div className="flex gap-3 px-4 py-2 text-xs text-slate-400">
            <span className="w-6">#</span>
            <span className="flex-1">Player</span>
            <span className="w-20 text-right">Net</span>
            <span className="w-12 text-right">Games</span>
          </div>
          <ul className="divide-y divide-slate-800">
            {leaderboard.data.map((r, i) => {
              const mine = r.id === myPlayerId
              const expanded = open === r.id
              return (
                <li key={r.id} className={mine ? 'bg-emerald-500/10' : ''}>
                  <button
                    className="flex w-full items-center gap-3 px-4 py-3 text-left tabular-nums"
                    aria-expanded={expanded}
                    onClick={() => setOpen(expanded ? null : r.id)}
                  >
                    <span className="w-6 text-slate-500">{i + 1}</span>
                    <span className={`min-w-0 flex-1 truncate font-medium ${mine ? 'text-emerald-300' : ''}`}>
                      {r.name}
                      {mine && <span className="text-xs text-emerald-400/70"> (you)</span>}
                    </span>
                    <span
                      className={`w-20 text-right font-semibold ${r.net > 0 ? 'text-emerald-400' : r.net < 0 ? 'text-rose-400' : ''}`}
                    >
                      {formatNet(r.net)}
                    </span>
                    <span className="w-12 text-right text-slate-400">{r.games}</span>
                  </button>
                  {expanded && (
                    <dl className="grid grid-cols-3 gap-2 px-4 pb-3 pl-13 text-sm tabular-nums">
                      <div>
                        <dt className="text-xs text-slate-500">Buy-ins</dt>
                        <dd>{r.buyIns}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">Rebuys</dt>
                        <dd>{r.rebuys}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">Total in</dt>
                        <dd>{formatPence(r.totalIn)}</dd>
                      </div>
                    </dl>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
