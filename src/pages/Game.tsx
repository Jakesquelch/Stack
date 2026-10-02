import { LiveGame } from '../components/LiveGame'
import { StartGame } from '../components/StartGame'
import { useLiveGame, usePlayerNames } from '../lib/api'

export function Game({ myPlayerId }: { myPlayerId: string }) {
  const live = useLiveGame()
  const nameOf = usePlayerNames([
    ...(live.data?.players.map((p) => p.player_id) ?? []),
    ...(live.data?.buyIns.map((b) => b.recorded_by) ?? []),
  ])

  if (live.isPending) return <p className="text-slate-400">Loading…</p>
  if (live.isError) return <p className="text-rose-400">Couldn't load the game. Pull down or reopen the app to retry.</p>
  if (!live.data) return <StartGame myPlayerId={myPlayerId} />
  return <LiveGame game={live.data} nameOf={nameOf} />
}
