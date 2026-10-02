import { Link } from 'react-router'
import { useHistory } from '../lib/api'
import { formatDate } from '../lib/game'
import { formatPence } from '../lib/money'

export function History() {
  const history = useHistory()

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">History</h1>

      {history.isPending && <p className="text-slate-400">Loading…</p>}
      {history.isError && <p className="text-rose-400">Couldn't load past games.</p>}
      {history.data?.length === 0 && <p className="text-slate-400">No finished games yet.</p>}

      {!!history.data?.length && (
        <ul className="card divide-y divide-slate-800">
          {history.data.map((g) => (
            <li key={g.id}>
              <Link to={`/history/${g.id}`} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{formatDate(g.finishedAt)}</div>
                  <div className="text-sm text-slate-400 tabular-nums">
                    {g.players} players · {formatPence(g.defaultBuyIn)} buy-in
                  </div>
                </div>
                <div className="text-right tabular-nums">
                  <div className="font-semibold">{formatPence(g.pot)}</div>
                  <div className="text-xs text-slate-500">pot</div>
                </div>
                <span className="text-slate-600" aria-hidden="true">
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
