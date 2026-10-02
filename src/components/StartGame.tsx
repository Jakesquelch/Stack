import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { usePlayers } from '../lib/api'
import { formatPence, parsePounds } from '../lib/money'
import { createPlayer } from '../lib/players'
import { must, supabase } from '../lib/supabase'
import { MoneyInput } from './MoneyInput'

const BUY_IN_OPTIONS = [1000, 1500, 2000]

export function StartGame({ myPlayerId }: { myPlayerId: string }) {
  const queryClient = useQueryClient()
  const players = usePlayers()
  const [buyIn, setBuyIn] = useState<number | 'other'>(2000)
  const [otherBuyIn, setOtherBuyIn] = useState('')
  const [selected, setSelected] = useState<Set<string>>(() => new Set([myPlayerId]))
  const [guestName, setGuestName] = useState('')

  const buyInPence = buyIn === 'other' ? parsePounds(otherBuyIn) : buyIn
  const validBuyIn = buyInPence !== null && buyInPence > 0

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const addGuest = useMutation({
    mutationFn: () => createPlayer(guestName),
    onSuccess: (player) => {
      queryClient.setQueryData(['players'], (old: typeof players.data) =>
        [...(old ?? []), player].sort((a, b) => a.name.localeCompare(b.name)),
      )
      setSelected((prev) => new Set(prev).add(player.id))
      setGuestName('')
    },
  })

  const start = useMutation({
    mutationFn: async () =>
      must(
        await supabase.rpc('start_game', {
          default_buy_in_pence: buyInPence!,
          player_ids: [...selected],
        }),
      ),
    // also refetch on failure: if someone else just started a game, this shows it
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['liveGame'] }),
  })

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">New game</h1>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-slate-300">Buy-in</h2>
        <div className="grid grid-cols-4 gap-2">
          {BUY_IN_OPTIONS.map((pence) => (
            <button
              key={pence}
              className={buyIn === pence ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setBuyIn(pence)}
            >
              {formatPence(pence)}
            </button>
          ))}
          <button className={buyIn === 'other' ? 'btn-primary' : 'btn-secondary'} onClick={() => setBuyIn('other')}>
            Other
          </button>
        </div>
        {buyIn === 'other' && (
          <MoneyInput value={otherBuyIn} onChange={setOtherBuyIn} placeholder="e.g. 25" autoFocus />
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-slate-300">Who's playing? ({selected.size})</h2>
        <div className="grid grid-cols-2 gap-2">
          {players.data?.map((p) => {
            const on = selected.has(p.id)
            return (
              <button
                key={p.id}
                aria-pressed={on}
                className={`btn ${on ? 'bg-emerald-500/15 text-emerald-300 ring-2 ring-emerald-500' : 'bg-slate-800 text-slate-300'}`}
                onClick={() => toggle(p.id)}
              >
                <span className="flex w-full items-center gap-2">
                  <span className={`h-4 w-4 shrink-0 rounded-full border-2 ${on ? 'border-emerald-400 bg-emerald-400' : 'border-slate-500'}`} />
                  <span className="truncate">{p.name}</span>
                </span>
              </button>
            )
          })}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            addGuest.mutate()
          }}
        >
          <input
            className="input"
            placeholder="New name"
            autoCapitalize="words"
            maxLength={40}
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
          />
          <button className="btn-secondary shrink-0" disabled={!guestName.trim() || addGuest.isPending}>
            Add
          </button>
        </form>
      </section>

      <button
        className="btn-primary min-h-14 text-lg"
        disabled={!validBuyIn || selected.size < 2 || start.isPending}
        onClick={() => start.mutate()}
      >
        {selected.size < 2
          ? 'Pick at least 2 players'
          : `Start game · ${selected.size} × ${validBuyIn ? formatPence(buyInPence) : '…'}`}
      </button>
    </div>
  )
}
