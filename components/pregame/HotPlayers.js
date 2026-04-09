'use client'
import Sparkline from '../ui/Sparkline'
import HeatDot from '../ui/HeatDot'
import TeamBadge from '../ui/TeamBadge'
import StarButton from '../StarButton'
import { SkeletonHotCard } from '../ui/Skeleton'
import ErrorState from '../ui/ErrorState'
import { gradeColor, playerDisplayName } from '@/lib/mlbApi'
import { usePicks } from '@/hooks/usePicks'

// ── Desktop full card ─────────────────────────────────────────────────────────

function HotPlayerCardDesktop({ player, rank, starred, onToggleStar }) {
  const { getCount } = usePicks()
  const pickCount = getCount(player.name, player.teamAbbr)

  return (
    <div
      className={`
        relative rounded-xl border p-3.5 transition-all duration-150 animate-fade-in card-shadow
        ${starred
          ? 'starred-row border-amber-300 bg-amber-50/60'
          : 'bg-white border-slate-200 hover:border-slate-300'
        }
      `}
    >
      <div className="absolute top-3 left-3 text-[10px] font-bold text-slate-300 tabular-nums">
        #{rank}
      </div>

      <div className="flex items-start justify-between pl-5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-slate-900 truncate max-w-[140px]">
              {playerDisplayName(player.name, player.heatTier)}
            </span>
            <TeamBadge abbr={player.teamAbbr} size="xs" />
            <span className="text-[10px] text-slate-400 font-mono">{player.position}</span>
            <HeatDot heatTier={player.heatTier} />
          </div>

          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-slate-400">vs {player.opponentAbbr}</span>
            {player.matchupGrade && player.matchupGrade !== '--' && (
              <span className={`text-xs font-bold ${gradeColor(player.matchupGrade)}`}>
                {player.matchupGrade}
              </span>
            )}
          </div>

          <div className="mt-1.5 flex items-center gap-3">
            <span className="text-[10px] text-slate-400 uppercase tracking-wide">Yday</span>
            <span className="text-xs font-mono text-slate-600">
              {player.yesterdayH ?? 0}H / {player.yesterdayR ?? 0}R / {player.yesterdayRBI ?? 0}RBI
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 ml-3">
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-lg font-bold text-amber-500 tabular-nums leading-none">
                {player.last7Total ?? 0}
              </div>
              <div className="text-[9px] text-slate-400 text-right">7-day</div>
            </div>
            <StarButton
              starred={starred}
              onToggle={() => onToggleStar(player.id, { name: player.name, teamAbbr: player.teamAbbr })}
              pickCount={pickCount}
              size="sm"
            />
          </div>
          <Sparkline data={player.sparkline || []} heatTier={player.heatTier} width={64} height={22} />
        </div>
      </div>
    </div>
  )
}

// ── Mobile compact swipe card ─────────────────────────────────────────────────

function HotPlayerCardMobile({ player, starred, onToggleStar }) {
  const { getCount } = usePicks()
  const pickCount = getCount(player.name, player.teamAbbr)

  return (
    <div
      className={`
        flex-shrink-0 w-36 rounded-xl border p-3 space-y-1.5 card-shadow
        ${starred ? 'border-amber-300 bg-amber-50' : 'bg-white border-slate-200'}
      `}
    >
      {/* Team + heat */}
      <div className="flex items-center justify-between">
        <TeamBadge abbr={player.teamAbbr} size="xs" />
        <HeatDot heatTier={player.heatTier} />
      </div>

      {/* Name */}
      <div className="text-xs font-semibold text-slate-900 leading-tight truncate" title={player.name}>
        {playerDisplayName(player.name, player.heatTier)}
      </div>

      {/* 7-day total — large bold */}
      <div>
        <span className="text-xl font-bold text-amber-500 tabular-nums leading-none">
          {player.last7Total ?? 0}
        </span>
        <span className="text-[10px] text-slate-400 ml-1">7d</span>
      </div>

      {/* Star */}
      <div className="flex justify-end">
        <StarButton
          starred={starred}
          onToggle={() => onToggleStar(player.id, { name: player.name, teamAbbr: player.teamAbbr })}
          pickCount={pickCount}
          size="sm"
        />
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function HotPlayers({ players, loading, error, onRetry, starred, onToggleStar, selectedGamePk }) {
  const filtered = selectedGamePk
    ? players.filter((p) => p.gamePk === selectedGamePk)
    : players
  const top10 = filtered.slice(0, 10)

  const emptyMsg = (
    <div className="text-sm text-slate-400 py-8 text-center">
      No player data yet — check back once the season starts.
    </div>
  )

  return (
    <section aria-label="Hot Players">
      <div className="flex items-center justify-between mb-3">
        <h2
          className="text-lg text-slate-900 tracking-wider"
          style={{ fontFamily: "'Bebas Neue', sans-serif" }}
        >
          🔥 Hot Players
        </h2>
        <span className="text-xs text-slate-400">Last 7 games</span>
      </div>

      {error && <ErrorState message={error} onRetry={onRetry} compact />}

      {/* Mobile: horizontal scroll strip */}
      <div className="lg:hidden">
        {loading && !players.length ? (
          <div className="flex gap-3 overflow-x-auto score-scroll pb-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-36 h-32 rounded-xl bg-slate-100 skeleton" />
            ))}
          </div>
        ) : top10.length === 0 ? emptyMsg : (
          <div className="flex gap-3 overflow-x-auto score-scroll pb-1">
            {top10.map((player) => (
              <HotPlayerCardMobile
                key={player.id}
                player={player}
                starred={starred.includes(String(player.id))}
                onToggleStar={onToggleStar}
              />
            ))}
          </div>
        )}
      </div>

      {/* Desktop: vertical stack of full cards */}
      <div className="hidden lg:block space-y-2">
        {loading && !players.length && (
          Array.from({ length: 5 }).map((_, i) => <SkeletonHotCard key={i} />)
        )}
        {!loading && top10.length === 0 && emptyMsg}
        {top10.map((player, i) => (
          <HotPlayerCardDesktop
            key={player.id}
            player={player}
            rank={i + 1}
            starred={starred.includes(String(player.id))}
            onToggleStar={onToggleStar}
          />
        ))}
      </div>
    </section>
  )
}
