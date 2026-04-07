'use client'
import TeamBadge from '../ui/TeamBadge'
import HeatDot from '../ui/HeatDot'
import { computeHeat } from '@/lib/mlbApi'

function StarredCard({ player }) {
  const heat = computeHeat(player.last7Total || 0)
  const isLive = player.gameStatus === 'Live'

  return (
    <div className="flex-shrink-0 w-36 bg-navy-800 border border-gold-500/30 rounded-xl p-3 space-y-1.5 hover:border-gold-500/60 transition-colors">
      {/* Name + team */}
      <div className="flex items-center justify-between">
        <TeamBadge abbr={player.teamAbbr} size="xs" />
        <HeatDot total7Day={player.last7Total} size="sm" showEmoji />
      </div>
      <div className="text-xs font-semibold text-white leading-tight truncate" title={player.name}>
        {player.name}
      </div>
      {/* Today's line */}
      <div className="flex items-center gap-1.5">
        {isLive && (
          <span className="live-dot w-1.5 h-1.5 bg-green-400 rounded-full inline-block" />
        )}
        <span className="text-xs font-mono text-gold-400 tabular-nums">
          {player.todayH ?? 0}H {player.todayR ?? 0}R {player.todayRBI ?? 0}RBI
        </span>
      </div>
      {/* Game status */}
      <div className="text-[10px] text-slate-500">
        {player.gameStatus === 'Final' ? 'Final' : isLive ? 'Live' : player.gameStatus || '--'}
      </div>
    </div>
  )
}

export default function StarredRail({ players, starIds }) {
  const starredPlayers = players.filter((p) => starIds.includes(String(p.id)))

  if (starIds.length === 0) {
    return (
      <div className="bg-navy-800/60 border border-navy-700 rounded-xl p-4 mb-4 text-center">
        <p className="text-sm text-slate-500">
          ★ Star players in the{' '}
          <span className="text-gold-500">Pregame</span> tab to track them here
        </p>
      </div>
    )
  }

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2 px-0.5">
        <span className="text-gold-500 text-sm">★</span>
        <span className="text-xs font-semibold text-white">My Stars Today</span>
        <span className="text-xs text-slate-500">({starredPlayers.length}/{starIds.length})</span>
      </div>
      <div className="score-scroll flex gap-2 overflow-x-auto pb-1">
        {starIds.map((id) => {
          const player = starredPlayers.find((p) => String(p.id) === id)
          if (!player) {
            return (
              <div key={id} className="flex-shrink-0 w-36 h-24 bg-navy-800/40 border border-navy-700/40 rounded-xl flex items-center justify-center">
                <span className="text-xs text-slate-600">Loading…</span>
              </div>
            )
          }
          return <StarredCard key={id} player={player} />
        })}
      </div>
    </div>
  )
}
