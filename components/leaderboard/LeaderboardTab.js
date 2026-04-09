'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import TeamBadge from '../ui/TeamBadge'
import HeatDot from '../ui/HeatDot'
import Sparkline from '../ui/Sparkline'
import StarButton from '../StarButton'
import ErrorState from '../ui/ErrorState'
import { SkeletonLeaderboardCard } from '../ui/Skeleton'
import { playerDisplayName } from '@/lib/mlbApi'
import { formatCSTTime, timeAgo, getTodayLabel } from '@/lib/utils'
import { usePicks } from '@/hooks/usePicks'

const REFRESH_MS = 90_000 // 90 seconds

// ── Rank number display ───────────────────────────────────────────────────────

function RankBadge({ rank }) {
  if (rank === 1) return (
    <div className="w-8 h-8 flex-shrink-0 bg-amber-400 rounded-full flex items-center justify-center">
      <span className="text-white font-bold text-sm">1</span>
    </div>
  )
  if (rank === 2) return (
    <div className="w-8 h-8 flex-shrink-0 bg-slate-400 rounded-full flex items-center justify-center">
      <span className="text-white font-bold text-sm">2</span>
    </div>
  )
  if (rank === 3) return (
    <div className="w-8 h-8 flex-shrink-0 bg-amber-700 rounded-full flex items-center justify-center">
      <span className="text-white font-bold text-sm">3</span>
    </div>
  )
  return (
    <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
      <span className="text-slate-400 font-semibold text-sm tabular-nums">{rank}</span>
    </div>
  )
}

// ── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ player }) {
  const todayTotal = (player.todayH || 0) + (player.todayR || 0) + (player.todayRBI || 0)
  const isLive = player.gameStatus === 'Live'

  if (todayTotal >= 3) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 border border-green-200 text-[10px] font-bold text-green-700 uppercase tracking-wide">
        ✓ Delivered
      </span>
    )
  }
  if (isLive && todayTotal >= 2) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 border border-amber-200 text-[10px] font-bold text-amber-700 uppercase tracking-wide">
        👀 Watch
      </span>
    )
  }
  return null
}

// ── Mobile card layout ────────────────────────────────────────────────────────

function LeaderboardCard({ player, rank, starred, onToggleStar, isYourPick }) {
  const { getCount } = usePicks()
  const pickCount = getCount(player.name, player.teamAbbr)
  const todayTotal = (player.todayH || 0) + (player.todayR || 0) + (player.todayRBI || 0)
  const isTop5 = rank <= 5

  return (
    <div className={`
      bg-white rounded-xl border p-4 card-shadow transition-all duration-150
      ${isYourPick ? 'border-l-2 border-l-amber-400 border-r-slate-200 border-t-slate-200 border-b-slate-200' : 'border-slate-200'}
      ${isTop5 ? 'shadow-sm' : ''}
    `}>
      <div className="flex items-start gap-3">
        <RankBadge rank={rank} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-900 text-sm">
              {playerDisplayName(player.name, player.heatTier)}
            </span>
            <TeamBadge abbr={player.teamAbbr} size="xs" />
            <HeatDot heatTier={player.heatTier} />
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-slate-400">vs {player.opponentAbbr}</span>
            <StatusBadge player={player} />
          </div>

          {/* Stat line */}
          <div className="flex items-center gap-4 mt-2">
            <div className="text-center">
              <div className="text-lg font-bold text-slate-900 tabular-nums leading-none">{player.todayH || 0}</div>
              <div className="text-[9px] text-slate-400 uppercase tracking-wide">H</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-slate-900 tabular-nums leading-none">{player.todayR || 0}</div>
              <div className="text-[9px] text-slate-400 uppercase tracking-wide">R</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-slate-900 tabular-nums leading-none">{player.todayRBI || 0}</div>
              <div className="text-[9px] text-slate-400 uppercase tracking-wide">RBI</div>
            </div>
            <div className="text-center border-l border-slate-200 pl-4">
              <div className={`text-2xl font-bold tabular-nums leading-none ${
                todayTotal >= 3 ? 'text-green-600' : todayTotal >= 1 ? 'text-amber-500' : 'text-slate-300'
              }`}>{todayTotal}</div>
              <div className="text-[9px] text-slate-400 uppercase tracking-wide">Total</div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Sparkline data={player.sparkline || []} heatTier={player.heatTier} width={48} height={18} />
              <StarButton
                starred={starred}
                onToggle={() => onToggleStar(player.id, { name: player.name, teamAbbr: player.teamAbbr })}
                pickCount={pickCount}
                size="sm"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Desktop table row ─────────────────────────────────────────────────────────

function LeaderboardRow({ player, rank, starred, onToggleStar }) {
  const { getCount } = usePicks()
  const pickCount = getCount(player.name, player.teamAbbr)
  const todayTotal = (player.todayH || 0) + (player.todayR || 0) + (player.todayRBI || 0)

  return (
    <tr className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${starred ? 'starred-row' : ''}`}>
      <td className="px-3 py-2.5 text-center w-12">
        <RankBadge rank={rank} />
      </td>
      <td className="sticky-col px-3 py-2.5 min-w-[150px]">
        <div className="font-medium text-slate-900 text-sm truncate">
          {playerDisplayName(player.name, player.heatTier)}
        </div>
        <div className="text-[10px] text-slate-400">{player.position}</div>
      </td>
      <td className="px-2 py-2.5 text-center">
        <TeamBadge abbr={player.teamAbbr} size="xs" />
      </td>
      <td className="px-2 py-2.5 text-center">
        <span className="text-xs text-slate-400 font-mono">{player.opponentAbbr}</span>
      </td>
      <td className="px-2 py-2.5 text-center">
        <span className="text-sm font-semibold text-slate-700 tabular-nums">{player.todayH || 0}</span>
      </td>
      <td className="px-2 py-2.5 text-center">
        <span className="text-sm font-semibold text-slate-700 tabular-nums">{player.todayR || 0}</span>
      </td>
      <td className="px-2 py-2.5 text-center">
        <span className="text-sm font-semibold text-slate-700 tabular-nums">{player.todayRBI || 0}</span>
      </td>
      <td className="px-2 py-2.5 text-center">
        <span className={`text-lg font-bold tabular-nums ${
          todayTotal >= 3 ? 'text-green-600' : todayTotal >= 1 ? 'text-amber-500' : 'text-slate-300'
        }`}>{todayTotal}</span>
      </td>
      <td className="px-2 py-2.5 text-center">
        <div className="flex justify-center">
          <Sparkline data={player.sparkline || []} heatTier={player.heatTier} width={52} height={18} />
        </div>
      </td>
      <td className="px-2 py-2.5 text-center">
        <div className="flex justify-center">
          <HeatDot heatTier={player.heatTier} />
        </div>
      </td>
      <td className="px-2 py-2.5 text-center">
        <StatusBadge player={player} />
      </td>
      <td className="px-2 py-2.5 text-center">
        <div className="flex justify-center">
          <StarButton
            starred={starred}
            onToggle={() => onToggleStar(player.id, { name: player.name, teamAbbr: player.teamAbbr })}
            pickCount={getCount(player.name, player.teamAbbr)}
            size="sm"
          />
        </div>
      </td>
    </tr>
  )
}

const DESKTOP_COLS = ['#', 'Player', 'Team', 'Opp', 'H', 'R', 'RBI', 'Total', 'Trend', '🌡', 'Status', '★']

// ── Main export ───────────────────────────────────────────────────────────────

export default function LeaderboardTab({ players, loading, error, onRetry, stars, onToggleStar, selectedGamePk }) {
  const [lastRefresh, setLastRefresh] = useState(null)
  const intervalRef = useRef(null)

  // Auto-refresh every 90s
  useEffect(() => {
    setLastRefresh(new Date())
    intervalRef.current = setInterval(() => {
      onRetry()
      setLastRefresh(new Date())
    }, REFRESH_MS)
    return () => clearInterval(intervalRef.current)
  }, [onRetry])

  // All players with at least one game stat, sorted by today's total
  const allRanked = [...players]
    .filter((p) => !selectedGamePk || p.gamePk === selectedGamePk)
    .sort((a, b) => {
      const at = (a.todayH || 0) + (a.todayR || 0) + (a.todayRBI || 0)
      const bt = (b.todayH || 0) + (b.todayR || 0) + (b.todayRBI || 0)
      return bt - at
    })

  // Top 20 — the actual leaderboard
  const top20 = allRanked.slice(0, 20)

  // Starred players that didn't crack top 20
  const top20Ids = new Set(top20.map((p) => p.id))
  const starredOutside = allRanked.filter(
    (p) => stars.includes(String(p.id)) && !top20Ids.has(p.id)
  )

  const anyLive = players.some((p) => p.gameStatus === 'Live')
  const anyFinal = players.some((p) => p.gameStatus === 'Final')

  const statusLabel = loading
    ? 'Loading…'
    : anyLive
    ? '⚡ Updating live'
    : anyFinal
    ? '✓ Final'
    : 'Pre-game'

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h2
            className="text-2xl text-slate-900 tracking-wider"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >
            🏆 Today&apos;s Leaderboard
          </h2>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-slate-400">{getTodayLabel()}</span>
            <span className={`text-xs font-medium ${anyLive ? 'text-green-600' : 'text-slate-400'}`}>
              {statusLabel}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lastRefresh && (
            <span className="text-xs text-slate-400">
              Last updated {formatCSTTime(lastRefresh)} CST
            </span>
          )}
          <button
            onClick={() => { onRetry(); setLastRefresh(new Date()) }}
            className="text-xs text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg px-2.5 py-1.5 hover:bg-slate-50 transition-colors min-h-[36px]"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={onRetry} compact />}

      {/* Your Picks Today — starred players outside top 20 */}
      {starredOutside.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            ★ Your Picks Today (outside top 20)
          </h3>
          <div className="space-y-2">
            {starredOutside.map((player) => {
              const rank = allRanked.findIndex((p) => p.id === player.id) + 1
              return (
                <LeaderboardCard
                  key={player.id}
                  player={player}
                  rank={rank}
                  starred
                  onToggleStar={onToggleStar}
                  isYourPick
                />
              )
            })}
          </div>
          <div className="border-t border-slate-200 mt-4 mb-2" />
        </div>
      )}

      {/* Loading skeletons */}
      {loading && !players.length && (
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => <SkeletonLeaderboardCard key={i} />)}
        </div>
      )}

      {!loading && top20.length === 0 && (
        <div className="py-16 text-center">
          <div className="text-4xl mb-3">🏆</div>
          <p className="text-slate-400 text-sm">No game stats yet today</p>
          <p className="text-slate-300 text-xs mt-1">Check back once games are underway</p>
        </div>
      )}

      {/* Mobile: card list */}
      <div className="lg:hidden space-y-2">
        {top20.map((player, i) => (
          <LeaderboardCard
            key={player.id}
            player={player}
            rank={i + 1}
            starred={stars.includes(String(player.id))}
            onToggleStar={onToggleStar}
            isYourPick={stars.includes(String(player.id))}
          />
        ))}
      </div>

      {/* Desktop: full table */}
      <div className="hidden lg:block table-scroll-wrapper bg-white rounded-xl border border-slate-200 card-shadow overflow-hidden">
        <table className="w-full border-collapse">
          <thead className="border-b border-slate-200">
            <tr>
              {DESKTOP_COLS.map((col) => (
                <th key={col} className="px-2 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap bg-slate-50 text-center">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {top20.map((player, i) => (
              <LeaderboardRow
                key={player.id}
                player={player}
                rank={i + 1}
                starred={stars.includes(String(player.id))}
                onToggleStar={onToggleStar}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
