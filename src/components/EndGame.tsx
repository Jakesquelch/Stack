import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { playerTotals, type LiveGame } from '../lib/api'
import { formatNet, formatPence, parsePounds, penceToInput } from '../lib/money'
import { settle } from '../lib/settle'
import { must, supabase } from '../lib/supabase'
import { MoneyInput } from './MoneyInput'

/** Enter everyone's final stack, check they add up to the pot, then settle */
export function EndGame({ game, nameOf, onBack }: { game: LiveGame; nameOf: (id: string) => string; onBack: () => void }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const totals = playerTotals(game.players, game.buyIns)
  const pot = totals.reduce((sum, t) => sum + t.totalIn, 0)

  // cashed-out players are filled in already; still-playing players start empty
  const [stacks, setStacks] = useState<Record<string, string>>(() =>
    Object.fromEntries(totals.map((t) => [t.playerId, t.finalStack === null ? '' : penceToInput(t.finalStack)])),
  )
  const parsed = totals.map((t) => ({ ...t, stack: parsePounds(stacks[t.playerId] ?? '') }))
  const allEntered = parsed.every((p) => p.stack !== null)
  const stackTotal = parsed.reduce((sum, p) => sum + (p.stack ?? 0), 0)
  const difference = stackTotal - pot
  const balanced = allEntered && difference === 0

  const finish = useMutation({
    mutationFn: async () => {
      const rows = parsed.map((p) => ({ game_id: game.id, player_id: p.playerId, final_stack_pence: p.stack! }))
      must(await supabase.from('game_players').upsert(rows))

      const transfers = settle(parsed.map((p) => ({ playerId: p.playerId, net: p.stack! - p.totalIn })))
      must(await supabase.rpc('finish_game', { game_id: game.id, transfers }))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['liveGame'] })
      navigate(`/history/${game.id}`)
    },
    // the game may have been settled on another phone; refetching shows that
    onError: () => queryClient.invalidateQueries({ queryKey: ['liveGame'] }),
  })

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Final stacks</h1>
        <button className="text-slate-400" onClick={onBack}>
          Back
        </button>
      </div>

      <ul className="flex flex-col gap-2">
        {parsed.map((p) => (
          <li key={p.playerId} className="card flex items-center gap-3 p-2 pl-4">
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{nameOf(p.playerId)}</div>
              <div className="text-sm text-slate-400 tabular-nums">
                in {formatPence(p.totalIn)}
                {p.stack !== null && (
                  <span className={p.stack - p.totalIn >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                    {' '}· {formatNet(p.stack - p.totalIn)}
                  </span>
                )}
              </div>
            </div>
            <MoneyInput
              className="w-32"
              aria-label={`${nameOf(p.playerId)}'s stack`}
              placeholder="Stack"
              value={stacks[p.playerId] ?? ''}
              onChange={(v) => setStacks((prev) => ({ ...prev, [p.playerId]: v }))}
            />
          </li>
        ))}
      </ul>

      <div className="card p-4 tabular-nums">
        <div className="flex justify-between text-slate-400">
          <span>Pot</span>
          <span>{formatPence(pot)}</span>
        </div>
        <div className="flex justify-between text-slate-400">
          <span>Stacks</span>
          <span>{formatPence(stackTotal)}</span>
        </div>
        <p
          className={`mt-2 font-semibold ${!allEntered ? 'text-slate-400' : balanced ? 'text-emerald-400' : 'text-amber-400'}`}
        >
          {!allEntered
            ? 'Enter every stack'
            : balanced
              ? 'Stacks match the pot'
              : `Stacks are ${formatPence(Math.abs(difference))} ${difference < 0 ? 'short' : 'over'}`}
        </p>
        {allEntered && !balanced && (
          <p className="mt-1 text-sm text-slate-400">
            Recount a stack, or check the activity log for a missing or doubled buy-in.
          </p>
        )}
      </div>

      <button className="btn-primary min-h-14 text-lg" disabled={!balanced || finish.isPending} onClick={() => finish.mutate()}>
        {finish.isPending ? 'Settling…' : 'Settle'}
      </button>
    </div>
  )
}
