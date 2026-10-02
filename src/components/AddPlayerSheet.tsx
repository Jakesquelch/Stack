import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { usePlayers } from '../lib/api'
import { formatPence } from '../lib/money'
import { createPlayer } from '../lib/players'
import { must, supabase } from '../lib/supabase'
import { Sheet } from './Sheet'

/** Late arrival: pick from the list or type a new name. They start on one default buy-in. */
export function AddPlayerSheet({
  gameId,
  inGame,
  defaultBuyIn,
  onClose,
}: {
  gameId: string
  inGame: Set<string>
  defaultBuyIn: number
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const players = usePlayers()
  const [newName, setNewName] = useState('')
  const available = players.data?.filter((p) => !inGame.has(p.id)) ?? []

  const add = useMutation({
    mutationFn: async (player: { id?: string; name?: string }) => {
      const id = player.id ?? (await createPlayer(player.name!)).id
      must(await supabase.rpc('add_to_game', { game_id: gameId, player_id: id }))
    },
    onSuccess: () => {
      onClose()
      queryClient.invalidateQueries({ queryKey: ['players'] })
      return queryClient.invalidateQueries({ queryKey: ['liveGame'] })
    },
  })

  return (
    <Sheet title={`Add a player · ${formatPence(defaultBuyIn)} buy-in`} onClose={onClose}>
      {available.length > 0 && (
        <div className="mb-4 grid max-h-64 grid-cols-2 gap-2 overflow-y-auto">
          {available.map((p) => (
            <button key={p.id} className="btn-secondary" disabled={add.isPending} onClick={() => add.mutate({ id: p.id })}>
              <span className="truncate">{p.name}</span>
            </button>
          ))}
        </div>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          add.mutate({ name: newName })
        }}
      >
        <input
          className="input"
          placeholder="New name"
          autoCapitalize="words"
          maxLength={40}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button className="btn-primary shrink-0" disabled={!newName.trim() || add.isPending}>
          Add
        </button>
      </form>
    </Sheet>
  )
}
