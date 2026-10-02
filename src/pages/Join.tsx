import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { usePlayers } from '../lib/api'
import { must, supabase } from '../lib/supabase'
import { createPlayer } from '../lib/players'

const isInstalled =
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

export function Join({ isMember, userId }: { isMember: boolean; userId: string }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 pt-[max(2rem,env(safe-area-inset-top))] pb-8">
      <header>
        <h1 className="text-3xl font-bold">Stack</h1>
        <p className="text-slate-400">Poker night buy-ins and settle-up</p>
      </header>
      {isMember ? <PickName userId={userId} /> : <Passphrase />}
    </main>
  )
}

function Passphrase() {
  const queryClient = useQueryClient()
  const [passphrase, setPassphrase] = useState('')
  const [wrong, setWrong] = useState(false)

  const join = useMutation({
    mutationFn: async () => must(await supabase.rpc('join_crew', { passphrase })),
    onSuccess: (ok) => {
      if (ok) queryClient.invalidateQueries({ queryKey: ['me'] })
      else setWrong(true)
    },
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setWrong(false)
    join.mutate()
  }

  return (
    <>
      {!isInstalled && <InstallHint />}
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label htmlFor="passphrase" className="font-medium">
          Crew passphrase
        </label>
        <input
          id="passphrase"
          className="input"
          type="text"
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          placeholder="three random words"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
        />
        {wrong && <p className="text-rose-400">That's not it. Check the group chat.</p>}
        <button className="btn-primary" disabled={!passphrase.trim() || join.isPending}>
          {join.isPending ? 'Checking…' : 'Join'}
        </button>
      </form>
    </>
  )
}

function InstallHint() {
  return (
    <section className="card p-4 text-sm text-slate-300">
      <p className="mb-2 font-semibold text-slate-100">Add Stack to your home screen first</p>
      <p className="mb-1">
        <span className="font-medium text-slate-100">iPhone:</span> in Safari tap Share → Add to Home Screen.
      </p>
      <p className="mb-2">
        <span className="font-medium text-slate-100">Android (cringe):</span> in Chrome tap ⋮ → Install app.
      </p>
      <p className="text-slate-400">Then open it from your home screen and join there. Joining here won't carry over.</p>
    </section>
  )
}

function PickName({ userId }: { userId: string }) {
  const queryClient = useQueryClient()
  const players = usePlayers()
  const [newName, setNewName] = useState('')

  const pick = useMutation({
    mutationFn: async (playerId: string) => {
      must(await supabase.from('members').update({ player_id: playerId }).eq('user_id', userId))
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
  })

  const addMe = useMutation({
    mutationFn: () => createPlayer(newName),
    onSuccess: (player) => {
      queryClient.invalidateQueries({ queryKey: ['players'] })
      pick.mutate(player.id)
    },
  })

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Who are you?</h2>
      <div className="grid grid-cols-2 gap-2">
        {players.data?.map((p) => (
          <button key={p.id} className="btn-secondary" disabled={pick.isPending} onClick={() => pick.mutate(p.id)}>
            {p.name}
          </button>
        ))}
      </div>
      {players.data?.length === 0 && <p className="text-slate-400">No one's here yet. Add yourself below.</p>}

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          addMe.mutate()
        }}
      >
        <input
          className="input"
          placeholder="Not on the list? Your name"
          autoCapitalize="words"
          maxLength={40}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button className="btn-primary shrink-0" disabled={!newName.trim() || addMe.isPending}>
          Add
        </button>
      </form>
    </section>
  )
}
