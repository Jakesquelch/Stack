import { Navigate, Route, Routes } from 'react-router'
import { BottomNav } from './components/BottomNav'
import { useMe } from './lib/api'
import { friendlyError } from './lib/supabase'
import { Game } from './pages/Game'
import { GameDetail } from './pages/GameDetail'
import { History } from './pages/History'
import { Join } from './pages/Join'
import { Leaderboard } from './pages/Leaderboard'

export default function App() {
  const me = useMe()

  if (me.isPending) {
    return <div className="flex min-h-dvh items-center justify-center text-slate-500">Loading…</div>
  }
  if (me.isError) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4">
        <p className="text-rose-400">{friendlyError(me.error)}</p>
        <button className="btn-secondary" onClick={() => me.refetch()}>
          Try again
        </button>
      </div>
    )
  }

  const { isMember, playerId, userId } = me.data
  if (!isMember || !playerId) return <Join isMember={isMember} userId={userId} />

  return (
    <>
      <main className="mx-auto max-w-md px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[calc(6rem+env(safe-area-inset-bottom))]">
        <Routes>
          <Route path="/" element={<Game myPlayerId={playerId} />} />
          <Route path="/history" element={<History />} />
          <Route path="/history/:id" element={<GameDetail />} />
          <Route path="/leaderboard" element={<Leaderboard myPlayerId={playerId} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <BottomNav />
    </>
  )
}
