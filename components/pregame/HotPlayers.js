'use client'
import Sparkline from '../ui/Sparkline'
import HeatDot from '../ui/HeatDot'
import TeamBadge from '../ui/TeamBadge'
import StarButton from '../StarButton'
import { SkeletonHotCard } from '../ui/Skeleton'
import ErrorState from '../ui/ErrorState'
import { computeHeat, gradeColor } from '@/lib/mlbApi'
import { usePlayerGameLog } from '@/hooks/useMLBData'
import { usePicks } from '@/hooks/usePicks'

function HotPlayerCard({ player, rank, starred, onToggleStar, season }) {
  const { sparkline, last7Total, yesterday } = usePlayerGameLog(player.id, season)
  const { getCount } = usePicks()
  const heat = computeHeat(last7Total)
  const pickCount = getCount(player.name, player.teamAbbr)

  return (
    <div
      className={`
        relative rounded-xl border p-3.5 transition-all duration-150
        hover:border-navy-600 cursor-pointer animate-fade-in
        ${starred ? 'starred-row border-gold-500/30' : 'bg-navy-800/80 border-navy-700'}
      `}
    >
      {/* Rank badge */}
      <div className="absolute top-3 left-3 text-[10px] font-bold text-slate-600 tabular-nums">
        #{rank}
      </div>

      <div className="flex items-start justify-between pl-5">
        {/* Player info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-white truncate max-w-[140px]">
              {player.name}
            </span>
            <TeamBadge abbr={player.teamAbbr} size="xs" />
            <span className="text-[10px] text-slate-500 font-mono">{player.position}</span>
            <HeatDot total7Day={last7Total} size="sm" showEmoji />
          </div>

          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-slate-500">vs {player.opponentAbbr}</span>
            {player.matchupGrade && player.matchupGrade !== '--' && (
              <span className={`text-xs font-bold ${gradeColor(player.matchupGrade)}`}>
                {player.matchupGrade}
              </span>
            )}
          </div>

          {/* Yesterday line */}
          <div className="mt-1.5 flex items-center gap-3">
            <div className="text-[10px] text-slate-500 uppercase tracking-wide">Yday</div>
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-white">{yesterday.h}H</span>
              <span className="text-slate-500">/</span>
              <span className="text-white">{yesterday.r}R</span>
              <span className="text-slate-500">/</span>
              <span className="text-white">{yesterday.rbi}RBI</span>
            </div>
          </div>
        </div>

        {/* Right: 7-day total + sparkline + star */}
        <div className="flex flex-col items-end gap-1 ml-3">
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-lg font-bold text-gold-500 tabular-nums leading-none">
                {last7Total}
              </div>
              <div className="text-[9px] text-slate-500 text-right">7-day</div>
            </div>
            <StarButton
              starred={starred}
              onToggle={() => onToggleStar(player.id, { name: player.name, teamAbbr: player.teamAbbr })}
              pickCount={pickCount}
              size="sm"
            />
          </div>
          <Sparkline data={sparkline} width={64} height={22} />
        </div>
      </div>
    </div>
  )
}

export default function HotPlayers({ players, loading, error, onRetry, starred, onToggleStar, season, selectedGamePk }) {
  // Filter by selected game if applicable
  const filtered = selectedGamePk
    ? players.filter((p) => p.gamePk === selectedGamePk)
    : players

  // Sort by last7Total (computed via game log; show top 10)
  const top10 = filtered.slice(0, 10)

  return (
    <section aria-label="Hot Players">
      <div className="flex items-center justify-between mb-3">
        <h2
          className="text-lg text-white tracking-wider"
          style={{ fontFamily: "'Bebas Neue', sans-serif" }}
        >
          🔥 Hot Players
        </h2>
        <span className="text-xs text-slate-500">Last 7 games</span>
      </div>

      {error && <ErrorState message={error} onRetry={onRetry} compact />}

      {loading && !players.length && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <SkeletonHotCard key={i} />)}
        </div>
      )}

      {!loading && !error && top10.length === 0 && (
        <div className="text-sm text-slate-500 py-8 text-center">
          No player data yet. Select a game or check back during the season.
        </div>
      )}

      <div className="space-y-2">
        {top10.map((player, i) => (
          <HotPlayerCard
            key={player.id}
            player={player}
            rank={i + 1}
            starred={starred.includes(String(player.id))}
            onToggleStar={onToggleStar}
            season={season}
          />
        ))}
      </div>
    </section>
  )
}
