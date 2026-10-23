import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { useRegulars } from '../lib/api'
import { setRegular } from '../lib/players'

/** Admin only: who shows on the all-time leaderboard. Everyone else is tucked under "Show all players". */
export function Regulars() {
  const players = useRegulars()

  return (
    <div className="flex flex-col gap-4">
      <header>
        <Link to="/leaderboard" className="text-sm text-slate-400">
          ← Leaderboard
        </Link>
        <h1 className="text-2xl font-bold">Regulars</h1>
        <p className="text-sm text-slate-400">
          Regulars show on the all-time leaderboard. Everyone else is under Show all players.
        </p>
      </header>

      {players.isPending && <p className="text-slate-400">Loading…</p>}
      {players.isError && <p className="text-rose-400">Couldn't load the players.</p>}

      {!!players.data?.length && (
        <ul className="card divide-y divide-slate-800">
          {players.data.map((p) => (
            <RegularRow key={p.id} id={p.id} name={p.name} regular={p.is_regular} />
          ))}
        </ul>
      )}
    </div>
  )
}

function RegularRow({ id, name, regular }: { id: string; name: string; regular: boolean }) {
  const queryClient = useQueryClient()
  const save = useMutation({
    mutationFn: (on: boolean) => setRegular(id, on),
    // stays pending until the lists have refreshed, so the switch doesn't flick back
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['players'] }),
        queryClient.invalidateQueries({ queryKey: ['leaderboard'] }),
      ]),
  })
  // show where it's heading while it saves
  const on = save.isPending ? save.variables : regular

  return (
    <li>
      <button
        role="switch"
        aria-checked={on}
        disabled={save.isPending}
        className="flex min-h-14 w-full items-center gap-3 px-4 text-left"
        onClick={() => save.mutate(!on)}
      >
        <span className="min-w-0 flex-1 truncate font-semibold">{name}</span>
        <span className={`text-xs ${on ? 'text-emerald-400' : 'text-slate-500'}`}>{on ? 'Regular' : 'Occasional'}</span>
        <span
          className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? 'bg-emerald-500' : 'bg-slate-700'}`}
          aria-hidden="true"
        >
          <span
            className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white transition ${on ? 'translate-x-5' : ''}`}
          />
        </span>
      </button>
    </li>
  )
}
