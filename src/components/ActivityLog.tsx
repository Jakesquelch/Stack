import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { BuyIn } from '../lib/api'
import { formatTime } from '../lib/game'
import { formatPence } from '../lib/money'
import { must, supabase } from '../lib/supabase'
import { ConfirmSheet } from './Sheet'

/** Every buy-in, newest first, with who recorded it. Tap one to remove it. */
export function ActivityLog({ buyIns, nameOf }: { buyIns: BuyIn[]; nameOf: (id: string | null) => string }) {
  const queryClient = useQueryClient()
  const [removing, setRemoving] = useState<BuyIn | null>(null)

  // each player's oldest buy-in is their first one; the rest are rebuys
  const firstIds = new Set<string>()
  const seen = new Set<string>()
  for (const b of [...buyIns].reverse()) {
    if (!seen.has(b.player_id)) firstIds.add(b.id)
    seen.add(b.player_id)
  }
  const label = (b: BuyIn) => (firstIds.has(b.id) ? 'buy-in' : 'rebuy')

  const remove = useMutation({
    mutationFn: async (id: string) => must(await supabase.from('buy_ins').delete().eq('id', id)),
    onSuccess: () => {
      setRemoving(null)
      return queryClient.invalidateQueries({ queryKey: ['liveGame'] })
    },
  })

  return (
    <section>
      <h2 className="mb-2 font-semibold text-slate-300">Activity</h2>
      <ul className="card divide-y divide-slate-800">
        {buyIns.map((b) => (
          <li key={b.id}>
            <button className="flex w-full items-center gap-3 px-4 py-3 text-left" onClick={() => setRemoving(b)}>
              <span className="text-sm text-slate-500 tabular-nums">{formatTime(b.created_at)}</span>
              <span className="min-w-0 flex-1 truncate">
                {nameOf(b.player_id)} <span className="text-slate-400">{label(b)}</span>
              </span>
              <span className="text-right">
                <span className="block font-medium tabular-nums">{formatPence(b.amount_pence)}</span>
                <span className="block text-xs text-slate-500">by {nameOf(b.recorded_by)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {removing && (
        <ConfirmSheet
          title="Remove this buy-in?"
          message={`${nameOf(removing.player_id)}'s ${formatPence(removing.amount_pence)} ${label(removing)} at ${formatTime(
            removing.created_at,
          )}, recorded by ${nameOf(removing.recorded_by)}.`}
          confirmLabel="Remove buy-in"
          pending={remove.isPending}
          onConfirm={() => remove.mutate(removing.id)}
          onClose={() => setRemoving(null)}
        />
      )}
    </section>
  )
}
