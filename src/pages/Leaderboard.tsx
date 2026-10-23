import { useMemo, useState, type ReactNode } from 'react'
import { useLeaderboard, useResults } from '../lib/api'
import { awards, type Awards as AwardsData, type GameBuyIn } from '../lib/awards'
import { formatNet, formatPence } from '../lib/money'
import { addMonths, formatMonth, monthOf, standings, type ResultGame, type Standing } from '../lib/monthly'

// gold, silver, bronze badges for the top 3
const MEDALS = ['bg-amber-400', 'bg-slate-300', 'bg-[#c2773a]']

const TABS = [
  { id: 'allTime', label: 'All-time' },
  { id: 'monthly', label: 'Monthly' },
] as const
type Tab = (typeof TABS)[number]['id']

/** All-time or one month's profit/loss, with a few awards on top. Tap a row for buy-ins, rebuys and total bought in. */
export function Leaderboard({ myPlayerId }: { myPlayerId: string }) {
  // fetched side by side, and the page waits for both so it appears all at once
  const leaderboard = useLeaderboard()
  const results = useResults()
  const [tab, setTab] = useState<Tab>('allTime')
  // results only add awards to the all-time tab: if they fail, still show the leaderboard
  const loading = leaderboard.isPending || results.isPending

  const allTimeAwards = useMemo(() => results.data && awards(results.data.games, results.data.buyIns), [results.data])

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Leaderboard</h1>

      {loading && <p className="text-slate-400">Loading…</p>}
      {leaderboard.isError && <p className="text-rose-400">Couldn't load the leaderboard.</p>}
      {!loading && leaderboard.data?.length === 0 && <p className="text-slate-400">No finished games yet.</p>}

      {!loading && !!leaderboard.data?.length && (
        <>
          <div role="tablist" aria-label="Leaderboard period" className="card grid grid-cols-2 gap-1 p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                className={`min-h-10 rounded-xl font-semibold transition ${tab === t.id ? 'bg-slate-700 text-slate-100' : 'text-slate-400'}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'allTime' && (
            <>
              {allTimeAwards && (
                <Awards awards={allTimeAwards} nameOf={(id) => leaderboard.data.find((r) => r.id === id)?.name ?? '…'} />
              )}
              <Standings rows={leaderboard.data} myPlayerId={myPlayerId} />
            </>
          )}

          {tab === 'monthly' &&
            (results.data ? (
              <Monthly games={results.data.games} buyIns={results.data.buyIns} myPlayerId={myPlayerId} />
            ) : (
              <p className="text-rose-400">Couldn't load the monthly leaderboard.</p>
            ))}
        </>
      )}
    </div>
  )
}

/** One month at a time, starting on this month. The arrows go back as far as the first game. */
function Monthly({ games, buyIns, myPlayerId }: { games: ResultGame[]; buyIns: GameBuyIn[]; myPlayerId: string }) {
  const [thisMonth] = useState(() => monthOf(new Date().toISOString()))
  const [month, setMonth] = useState(thisMonth)

  const firstMonth = games.reduce((first, g) => (monthOf(g.started_at) < first ? monthOf(g.started_at) : first), thisMonth)
  const monthGames = useMemo(() => games.filter((g) => monthOf(g.started_at) === month), [games, month])
  const rows = useMemo(() => standings(monthGames, buyIns), [monthGames, buyIns])
  const monthAwards = useMemo(() => awards(monthGames, buyIns), [monthGames, buyIns])

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          className="btn-secondary w-12 px-0 text-xl"
          aria-label="Previous month"
          disabled={month <= firstMonth}
          onClick={() => setMonth(addMonths(month, -1))}
        >
          ‹
        </button>
        <h2 className="flex-1 text-center font-semibold">{formatMonth(month)}</h2>
        <button
          className="btn-secondary w-12 px-0 text-xl"
          aria-label="Next month"
          disabled={month >= thisMonth}
          onClick={() => setMonth(addMonths(month, 1))}
        >
          ›
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="text-slate-400">No games in {formatMonth(month)}.</p>
      ) : (
        <>
          <Awards awards={monthAwards} nameOf={(id) => rows.find((r) => r.id === id)?.name ?? '…'} />
          <Standings rows={rows} myPlayerId={myPlayerId} />
        </>
      )}
    </>
  )
}

/** The ranked list. Tap a row for buy-ins, rebuys and total bought in. */
function Standings({ rows, myPlayerId }: { rows: Standing[]; myPlayerId: string }) {
  const [open, setOpen] = useState<string | null>(null)

  return (
    <ul className="card divide-y divide-slate-800 overflow-hidden">
      {rows.map((r, i) => {
        const mine = r.id === myPlayerId
        const expanded = open === r.id
        return (
          <li key={r.id} className={mine ? 'bg-emerald-500/10' : ''}>
            <button
              className="flex w-full items-center gap-3 px-4 py-3 text-left tabular-nums"
              aria-expanded={expanded}
              onClick={() => setOpen(expanded ? null : r.id)}
            >
              {i < 3 ? (
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-slate-900 ${MEDALS[i]}`}
                >
                  {i + 1}
                </span>
              ) : (
                <span className="w-7 shrink-0 text-center text-slate-400">{i + 1}</span>
              )}
              <span className={`min-w-0 flex-1 truncate font-semibold ${mine ? 'text-emerald-300' : ''}`}>
                {r.name}
                {mine && <span className="text-xs font-medium"> (you)</span>}
              </span>
              <span className="flex flex-col items-end">
                <span
                  className={`font-bold ${r.net > 0 ? 'text-emerald-400' : r.net < 0 ? 'text-rose-400' : ''}`}
                >
                  {formatNet(r.net)}
                </span>
                <span className="text-xs text-slate-400">
                  {r.games} game{r.games === 1 ? '' : 's'}
                </span>
              </span>
            </button>
            {expanded && (
              <dl className="grid grid-cols-3 gap-2 px-4 pb-3 pl-14 text-sm tabular-nums">
                <div>
                  <dt className="text-xs text-slate-400">Buy-ins</dt>
                  <dd>{r.buyIns}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">Rebuys</dt>
                  <dd>{r.rebuys}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">Total in</dt>
                  <dd>{formatPence(r.totalIn)}</dd>
                </div>
              </dl>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** Biggest night, most rebuys and worst night. An award only shows once someone has earned it. */
function Awards({ awards, nameOf }: { awards: AwardsData; nameOf: (id: string) => string }) {
  const { biggestNight, mostRebuys, worstNight } = awards

  if (!biggestNight && !mostRebuys && !worstNight) return null

  return (
    <section aria-label="Awards" className="grid grid-cols-3 gap-2 tabular-nums">
      {biggestNight && (
        <Award
          label="Biggest night"
          name={nameOf(biggestNight.playerId)}
          value={<span className="text-emerald-400">{formatNet(biggestNight.net)}</span>}
          icon={
            <svg {...ICON} className="h-[18px] w-[18px] text-emerald-400">
              <path d="M3 17l6-6 4 4 8-8M15 7h6v6" />
            </svg>
          }
        />
      )}
      {mostRebuys && (
        <Award
          label="Most rebuys"
          name={nameOf(mostRebuys.playerId)}
          value={<span className="text-slate-300">{mostRebuys.rebuys} rebuy{mostRebuys.rebuys === 1 ? '' : 's'}</span>}
          icon={
            <svg {...ICON} className="h-[18px] w-[18px] text-amber-400">
              <path d="M21 12a9 9 0 1 1-3-6.7M21 3v6h-6" />
            </svg>
          }
        />
      )}
      {worstNight && (
        <Award
          label="Worst night"
          name={nameOf(worstNight.playerId)}
          value={<span className="text-rose-400">{formatNet(worstNight.net)}</span>}
          icon={
            <svg {...ICON} className="h-[18px] w-[18px] text-rose-400">
              <path d="M3 7l6 6 4-4 8 8M15 17h6v-6" />
            </svg>
          }
        />
      )}
    </section>
  )
}

const ICON = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const

function Award({ label, name, value, icon }: { label: string; name: string; value: ReactNode; icon: ReactNode }) {
  return (
    <div className="card flex min-w-0 flex-col gap-0.5 px-3 py-2.5">
      {icon}
      <div className="mt-0.5 text-xs text-slate-400">{label}</div>
      <div className="truncate font-semibold">{name}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  )
}
