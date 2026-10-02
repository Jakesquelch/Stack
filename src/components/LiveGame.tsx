import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { playerTotals, type LiveGame as Game } from '../lib/api'
import { formatTime } from '../lib/game'
import { formatPence } from '../lib/money'
import { must, supabase } from '../lib/supabase'
import { ActivityLog } from './ActivityLog'
import { AddPlayerSheet } from './AddPlayerSheet'
import { EndGame } from './EndGame'
import { PlayerRow } from './PlayerRow'
import { ConfirmSheet } from './Sheet'

export function LiveGame({ game, nameOf }: { game: Game; nameOf: (id: string | null) => string }) {
  const queryClient = useQueryClient()
  const [ending, setEnding] = useState(false)
  const [sheet, setSheet] = useState<'add' | 'cancel' | null>(null)

  const totals = playerTotals(game.players, game.buyIns)
  const pot = totals.reduce((sum, t) => sum + t.totalIn, 0)
  // still playing first, then cashed out; alphabetical within each
  const rows = [...totals].sort(
    (a, b) =>
      Number(a.finalStack !== null) - Number(b.finalStack !== null) || nameOf(a.playerId).localeCompare(nameOf(b.playerId)),
  )

  const cancel = useMutation({
    mutationFn: async () => must(await supabase.from('games').update({ status: 'cancelled' }).eq('id', game.id)),
    onSuccess: () => {
      setSheet(null)
      return queryClient.invalidateQueries({ queryKey: ['liveGame'] })
    },
  })

  if (ending) return <EndGame game={game} nameOf={nameOf} onBack={() => setEnding(false)} />

  return (
    <div className="flex flex-col gap-5">
      <header>
        <p className="text-sm text-slate-400">
          Live · {formatPence(game.default_buy_in_pence)} buy-in · started {formatTime(game.started_at)}
        </p>
        <h1 className="text-4xl font-bold tabular-nums">{formatPence(pot)}</h1>
        <p className="text-sm text-slate-400">in the pot</p>
      </header>

      <ul className="flex flex-col gap-2">
        {rows.map((t) => (
          <PlayerRow
            key={t.playerId}
            gameId={game.id}
            playerId={t.playerId}
            name={nameOf(t.playerId)}
            count={t.count}
            totalIn={t.totalIn}
            finalStack={t.finalStack}
            defaultBuyIn={game.default_buy_in_pence}
          />
        ))}
      </ul>

      <div className="grid grid-cols-2 gap-2">
        <button className="btn-secondary" onClick={() => setSheet('add')}>
          + Add player
        </button>
        <button className="btn-primary" onClick={() => setEnding(true)}>
          End game
        </button>
      </div>

      <ActivityLog buyIns={game.buyIns} nameOf={nameOf} />

      <button className="self-center py-3 text-sm font-medium text-rose-400" onClick={() => setSheet('cancel')}>
        Cancel game
      </button>

      {sheet === 'add' && (
        <AddPlayerSheet
          gameId={game.id}
          inGame={new Set(game.players.map((p) => p.player_id))}
          defaultBuyIn={game.default_buy_in_pence}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'cancel' && (
        <ConfirmSheet
          title="Cancel this game?"
          message={`Delete tonight's game and its ${game.buyIns.length} buy-in${game.buyIns.length === 1 ? '' : 's'}? Use this for a game started by mistake.`}
          confirmLabel="Cancel game"
          cancelLabel="Keep playing"
          pending={cancel.isPending}
          onConfirm={() => cancel.mutate()}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  )
}
