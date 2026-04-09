'use client'
import TeamBadge from '../ui/TeamBadge'
import HeatDot from '../ui/HeatDot'
import { playerDisplayName } from '@/lib/mlbApi'

function StarredCard({ player }) {
  const isLive = player.gameStatus === 'Live'
  const todayTotal = (player.todayH || 0) + (player.todayR || 0) + (player.todayRBI || 0)

  return (
    <div className="flex-shrink-0 w-36 bg-white border border-amber-200 rounded-xl p-3 space-y-1.5 card-shadow hover:border-amber-300 transition-colors">
      <div className="flex items-center justify-between">
        <TeamBadge abbr={player.teamAbbr} size="xs" />
        <HeatDot heatTier={player.heatTier} />
      </div>
      <div className="text-xs font-semibold text-slate-800 leading-tight truncate" title={player.name}>
        {playerDisplayName(player.name, player.heatTier)}
      </div>
      <div className="flex items-center gap-1">
        {isLive && <span className="live-dot w-1.5 h-1.5 bg-green-500 rounded-full inline-block flex-shrink-0" />}
        <span className="text-xs font-mono text-slate-500 tabular-nums text-[11px]">
          {player.todayH ?? 0}H {player.todayR ?? 0}R {player.todayRBI ?? 0}RBI
        </span>
      </div>
      <div>
        <span className={`text-xl font-bold tabular-nums leading-none ${
          todayTotal >= 3 ? 'text-green-600' : todayTotal >= 1 ? 'text-amber-500' : 'text-slate-300'
        }`}>
          {todayTotal}
        </span>
        <span className="text-[10px] text-slate-400 ml-1">today</span>
      </div>
    </div>
  )
}

export default function StarredRail({ players, starIds }) {
  const starredPlayers = players.filter((p) => starIds.includes(String(p.id)))

  if (starIds.length === 0) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 text-center">
        <p className="text-sm text-slate-500">
          ★ Star players in the{' '}
          <span className="text-amber-500 font-medium">Pregame</span> tab to track them here
        </p>
      </div>
    )
  }

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-amber-500 text-sm">★</span>
        <span className="text-xs font-semibold text-slate-700">My Stars Today</span>
        <span className="text-xs text-slate-400">({starredPlayers.length}/{starIds.length})</span>
      </div>
      <div className="score-scroll flex gap-2 overflow-x-auto pb-1">
        {starIds.map((id) => {
          const player = starredPlayers.find((p) => String(p.id) === id)
          if (!player) {
            return (
              <div key={id} className="flex-shrink-0 w-36 h-24 bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-center">
                <span className="text-xs text-slate-400">Loading…</span>
              </div>
            )
          }
          return <StarredCard key={id} player={player} />
        })}
      </div>
    </div>
  )
}
