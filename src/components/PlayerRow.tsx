import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { addBuyIn, setStack } from '../lib/game'
import { formatNet, formatPence, parsePounds, penceToInput } from '../lib/money'
import { MoneyInput } from './MoneyInput'
import { Sheet } from './Sheet'

type Props = {
  gameId: string
  playerId: string
  name: string
  count: number
  totalIn: number
  finalStack: number | null
  defaultBuyIn: number
}

export function PlayerRow({ gameId, playerId, name, count, totalIn, finalStack, defaultBuyIn }: Props) {
  const queryClient = useQueryClient()
  const [cashingOut, setCashingOut] = useState(false)
  const saving = useRef(false)
  const cashedOut = finalStack !== null

  const rebuy = useMutation({
    mutationFn: () => addBuyIn(gameId, playerId, defaultBuyIn),
    onSettled: () => {
      saving.current = false
      return queryClient.invalidateQueries({ queryKey: ['liveGame'] })
    },
  })

  // a ref as well as isPending: two quick taps can both land before React re-renders
  // a different amount? Tap the rebuy in Activity afterwards to change it
  const tapRebuy = () => {
    if (saving.current) return
    saving.current = true
    rebuy.mutate()
  }

  return (
    <li className={`card flex items-center gap-2 p-2 pl-4 ${cashedOut ? 'opacity-50' : ''}`}>
      <button className="flex min-h-12 min-w-0 flex-1 flex-col items-start justify-center text-left" onClick={() => setCashingOut(true)}>
        <span className="w-full truncate font-semibold">{name}</span>
        <span className="text-sm text-slate-400 tabular-nums">
          {count} × · {formatPence(totalIn)}
          {cashedOut && (
            <>
              {' '}· out on {formatPence(finalStack)}{' '}
              <span className={finalStack - totalIn >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {formatNet(finalStack - totalIn)}
              </span>
            </>
          )}
        </span>
      </button>

      {!cashedOut && (
        <button className="btn-primary w-28" disabled={rebuy.isPending} onClick={tapRebuy}>
          {rebuy.isPending ? 'Saving…' : '+ Rebuy'}
        </button>
      )}

      {cashingOut && (
        <CashOutSheet
          gameId={gameId}
          playerId={playerId}
          name={name}
          totalIn={totalIn}
          finalStack={finalStack}
          onClose={() => setCashingOut(false)}
        />
      )}
    </li>
  )
}

function CashOutSheet({
  gameId,
  playerId,
  name,
  totalIn,
  finalStack,
  onClose,
}: {
  gameId: string
  playerId: string
  name: string
  totalIn: number
  finalStack: number | null
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [stack, setStackText] = useState(finalStack === null ? '' : penceToInput(finalStack))
  const stackPence = parsePounds(stack)
  const cashedOut = finalStack !== null

  const save = useMutation({
    mutationFn: (pence: number | null) => setStack(gameId, playerId, pence),
    onSuccess: () => {
      onClose()
      return queryClient.invalidateQueries({ queryKey: ['liveGame'] })
    },
  })

  return (
    <Sheet title={cashedOut ? `${name} (cashed out)` : `Cash out ${name}`} onClose={onClose}>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (stackPence !== null) save.mutate(stackPence)
        }}
      >
        <label className="text-sm text-slate-400" htmlFor="stack">
          Their stack · bought in for {formatPence(totalIn)}
        </label>
        <MoneyInput id="stack" value={stack} onChange={setStackText} placeholder="0" autoFocus={!cashedOut} />
        <button className="btn-primary" disabled={stackPence === null || save.isPending}>
          {stackPence === null
            ? cashedOut
              ? 'Save stack'
              : 'Cash out'
            : `${cashedOut ? 'Save' : 'Cash out'} · ${formatNet(stackPence - totalIn)}`}
        </button>
        {cashedOut && (
          <button type="button" className="btn-secondary" disabled={save.isPending} onClick={() => save.mutate(null)}>
            Put back in the game
          </button>
        )}
      </form>
    </Sheet>
  )
}
