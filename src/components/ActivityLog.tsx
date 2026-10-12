import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { BuyIn } from '../lib/api'
import { formatTime } from '../lib/game'
import { formatPence, parsePounds, penceToInput } from '../lib/money'
import { must, supabase } from '../lib/supabase'
import { MoneyInput } from './MoneyInput'
import { Sheet } from './Sheet'

/** Every buy-in, newest first, with who recorded it. Tap one to change its amount or remove it. */
export function ActivityLog({ buyIns, nameOf }: { buyIns: BuyIn[]; nameOf: (id: string | null) => string }) {
  const [editing, setEditing] = useState<BuyIn | null>(null)

  // each player's oldest buy-in is their first one; the rest are rebuys
  const firstIds = new Set<string>()
  const seen = new Set<string>()
  for (const b of [...buyIns].reverse()) {
    if (!seen.has(b.player_id)) firstIds.add(b.id)
    seen.add(b.player_id)
  }
  const label = (b: BuyIn) => (firstIds.has(b.id) ? 'buy-in' : 'rebuy')

  return (
    <section>
      <h2 className="mb-2 font-semibold text-slate-300">Activity</h2>
      <ul className="card divide-y divide-slate-800">
        {buyIns.map((b) => (
          <li key={b.id}>
            <button className="flex w-full items-center gap-3 px-4 py-3 text-left" onClick={() => setEditing(b)}>
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

      {editing && (
        <BuyInSheet
          buyIn={editing}
          title={`${nameOf(editing.player_id)}'s ${label(editing)}`}
          detail={`${formatTime(editing.created_at)}, recorded by ${nameOf(editing.recorded_by)}`}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  )
}

/** Change a buy-in's amount (say someone started on £15, not £20), or remove it */
function BuyInSheet({
  buyIn,
  title,
  detail,
  onClose,
}: {
  buyIn: BuyIn
  title: string
  detail: string
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [amount, setAmount] = useState(penceToInput(buyIn.amount_pence))
  const amountPence = parsePounds(amount)
  const changed = amountPence !== null && amountPence > 0 && amountPence !== buyIn.amount_pence

  const save = useMutation({
    mutationFn: async (pence: number | null) =>
      must(
        pence === null
          ? await supabase.from('buy_ins').delete().eq('id', buyIn.id)
          : await supabase.from('buy_ins').update({ amount_pence: pence }).eq('id', buyIn.id),
      ),
    onSuccess: () => {
      onClose()
      return queryClient.invalidateQueries({ queryKey: ['liveGame'] })
    },
  })

  return (
    <Sheet title={title} onClose={onClose}>
      <p className="mb-4 text-sm text-slate-400">{detail}</p>
      <form
        className="mb-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (changed) save.mutate(amountPence)
        }}
      >
        <MoneyInput className="flex-1" value={amount} onChange={setAmount} aria-label="Amount" />
        <button className="btn-primary" disabled={!changed || save.isPending}>
          Save
        </button>
      </form>
      <button className="btn-danger w-full" disabled={save.isPending} onClick={() => save.mutate(null)}>
        Remove {formatPence(buyIn.amount_pence)}
      </button>
    </Sheet>
  )
}
