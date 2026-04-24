'use client'
import Sparkline from '../ui/Sparkline'
import HeatDot from '../ui/HeatDot'
import TeamLogo from '../ui/TeamLogo'
import StarButton from '../StarButton'
import PlayerHeadshot from '../ui/PlayerHeadshot'
import { usePicks } from '@/hooks/usePicks'

// ── Single hot player card ────────────────────────────────────────────────────

function HotPlayerCard({ player, rank, starred, onToggleStar }) {
  const { getCount } = usePicks()
  const pickCount = getCount(player.name, player.teamAbbr)
  const isOnFire = player.heatTier === 1

  return (
    <div
      className={`
        flex-shrink-0 w-52 rounded-xl border p-3 space-y-2 card-shadow transition-all duration-150
        ${starred
          ? 'border-amber-300 bg-amber-50/70'
          : 'bg-[var(--bg-card)] border-[var(--border)] hover:border-amber-200'
        }
      `}
    >
      {/* Top row: rank + headshot + identity */}
      <div className="flex items-center gap-2.5">
        <div className="relative flex-shrink-0">
          <PlayerHeadshot
            personId={player.id}
            name={player.name}
            teamAbbr={player.teamAbbr}
            height={48}
          />
          {isOnFire && (
            <span
              className="absolute -top-1 -right-1 text-xs leading-none"
              title="On Fire"
            >
              🔥
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 mb-0.5">
            <TeamLogo teamId={player.teamId} abbr={player.teamAbbr} size="sm" />
            <span className="text-[9px] font-bold font-mono text-[var(--accent-blue)] flex-shrink-0">
              {player.teamAbbr}
            </span>
          </div>
          <div
            className="text-xs font-semibold text-[var(--text-primary)] truncate"
            title={player.name}
          >
            {player.name}
          </div>
          <div className="text-[10px] text-[var(--text-muted)]">{player.position}</div>
        </div>
        <HeatDot heatTier={player.heatTier} />
      </div>

      {/* 7-day total */}
      <div className="flex items-end justify-between">
        <div className="leading-none">
          <span className="text-2xl font-bold text-amber-500 tabular-nums">
            {player.last7Total ?? 0}
          </span>
          <span className="text-[9px] text-[var(--text-muted)] ml-1">H+R+RBI</span>
        </div>
        <StarButton
          starred={starred}
          onToggle={() => onToggleStar(player.id, { name: player.name, teamAbbr: player.teamAbbr })}
          pickCount={pickCount}
          size="sm"
        />
      </div>

      {/* Sparkline trendline */}
      <Sparkline data={player.sparkline || []} heatTier={player.heatTier} width={172} height={22} />
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function HotPlayers({ players, loading, starred, onToggleStar }) {
  // Show top 5 — tier system already marks top 5 as tier 1 (on fire)
  const top5 = players.slice(0, 5)

  return (
    <section aria-label="Hot Players — Last 7 Days">
      {/* Section header with gold underline accent */}
      <div className="mb-3">
        <h2
          className="text-lg font-bold text-[var(--text-primary)] tracking-wider inline-block pb-1"
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            borderBottom: '2px solid #f59e0b',
          }}
        >
          🔥 HOT PLAYERS — LAST 7 DAYS
        </h2>
      </div>

      {/* Horizontal scroll strip — same layout for desktop and mobile */}
      <div className="flex gap-3 overflow-x-auto score-scroll pb-2">
        {loading && !players.length ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-52 h-36 rounded-xl skeleton" />
          ))
        ) : top5.length === 0 ? (
          <div className="text-sm text-[var(--text-muted)] py-8 text-center w-full">
            No player data yet — check back once the season starts.
          </div>
        ) : (
          top5.map((player, i) => (
            <HotPlayerCard
              key={player.id}
              player={player}
              rank={i + 1}
              starred={starred.includes(String(player.id))}
              onToggleStar={onToggleStar}
            />
          ))
        )}
      </div>
    </section>
  )
}
