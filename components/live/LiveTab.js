'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import StarredRail from './StarredRail'
import TeamBadge from '../ui/TeamBadge'
import HeatDot from '../ui/HeatDot'
import Sparkline from '../ui/Sparkline'
import StarButton from '../StarButton'
import ErrorState from '../ui/ErrorState'
import { SkeletonTableRow } from '../ui/Skeleton'
import { computeHeat } from '@/lib/mlbApi'
import { timeAgo } from '@/lib/utils'
import { usePicks } from '@/hooks/usePicks'

const REFRESH_MS = 60_000

function LivePlayerRow({ player, rank, starred, onToggleStar, updatedIds }) {
  const { getCount } = usePicks()
  const pickCount = getCount(player.name, player.teamAbbr)
  const isUpdated = updatedIds?.has(String(player.id))
  const todayTotal = (player.todayH || 0) + (player.todayR || 0) + (player.todayRBI || 0)

  return (
    <tr
      className={`
        border-b border-navy-800/60 text-sm transition-colors duration-150
        hover:bg-navy-800/40
        ${starred ? 'starred-row' : ''}
        ${isUpdated ? 'stat-updated' : ''}
      `}
    >
      <td className="px-2 py-2 text-center text-xs text-slate-600 tabular-nums">{rank}</td>

      {/* Name — sticky */}
      <td className="sticky-col px-3 py-2">
        <div className="flex items-center gap-1.5">
          {player.gameStatus === 'Live' && (
            <span className="live-dot w-1.5 h-1.5 bg-green-400 rounded-full inline-block flex-shrink-0" />
          )}
          <div>
            <div className="font-medium text-white text-xs truncate max-w-[130px]">{player.name}</div>
            <div className="text-[10px] text-slate-500">{player.position}</div>
          </div>
        </div>
      </td>

      <td className="px-2 py-2 text-center">
        <TeamBadge abbr={player.teamAbbr} size="xs" />
      </td>

      <td className="px-2 py-2 text-center">
        <span className="text-xs text-slate-400 font-mono">{player.opponentAbbr || '--'}</span>
      </td>

      {/* Today's H/R/RBI */}
      <td className="px-2 py-2 text-center">
        <span className="text-xs font-mono text-slate-300 whitespace-nowrap tabular-nums">
          {player.todayH || 0}/{player.todayR || 0}/{player.todayRBI || 0}
        </span>
      </td>

      {/* Today total — highlighted */}
      <td className="px-2 py-2 text-center">
        <span className={`text-sm font-bold tabular-nums ${todayTotal >= 3 ? 'text-green-400' : todayTotal >= 1 ? 'text-gold-400' : 'text-slate-400'}`}>
          {todayTotal}
        </span>
      </td>

      {/* 7-day total */}
      <td className="px-2 py-2 text-center">
        <span className="text-sm font-bold text-gold-400 tabular-nums">{player.last7Total || 0}</span>
      </td>

      {/* Trend */}
      <td className="px-2 py-2 text-center">
        <div className="flex justify-center">
          <Sparkline data={player.sparkline || []} width={56} height={18} />
        </div>
      </td>

      {/* Heat */}
      <td className="px-2 py-2 text-center">
        <div className="flex justify-center">
          <HeatDot total7Day={player.last7Total || 0} size="sm" showEmoji />
        </div>
      </td>

      {/* Star */}
      <td className="px-2 py-2 text-center">
        <div className="flex justify-center">
          <StarButton
            starred={starred}
            onToggle={() => onToggleStar(player.id, { name: player.name, teamAbbr: player.teamAbbr })}
            pickCount={pickCount}
            size="sm"
          />
        </div>
      </td>
    </tr>
  )
}

const LIVE_COLS = [
  { key: '#', w: 'w-8' },
  { key: 'Player', w: 'min-w-[130px]' },
  { key: 'Team', w: 'w-16' },
  { key: 'Opp', w: 'w-12' },
  { key: 'H/R/RBI', w: 'w-20' },
  { key: 'Today', w: 'w-14' },
  { key: '7-Day', w: 'w-14' },
  { key: 'Trend', w: 'w-20' },
  { key: '🌡', w: 'w-10' },
  { key: '★', w: 'w-14' },
]

export default function LiveTab({ players, loading, error, onRetry, stars, onToggleStar, selectedGamePk, lastRefresh }) {
  const [view, setView] = useState('today') // 'today' | 'heat'
  const [updatedIds, setUpdatedIds] = useState(new Set())
  const prevPlayersRef = useRef({})

  // Detect stat updates between refreshes
  useEffect(() => {
    if (!players.length) return
    const updated = new Set()

    players.forEach((p) => {
      const prev = prevPlayersRef.current[p.id]
      if (!prev) return
      const prevTotal = (prev.todayH || 0) + (prev.todayR || 0) + (prev.todayRBI || 0)
      const currTotal = (p.todayH || 0) + (p.todayR || 0) + (p.todayRBI || 0)
      if (currTotal !== prevTotal) updated.add(String(p.id))
    })

    setUpdatedIds(updated)
    players.forEach((p) => { prevPlayersRef.current[p.id] = p })

    if (updated.size > 0) {
      const t = setTimeout(() => setUpdatedIds(new Set()), 3000)
      return () => clearTimeout(t)
    }
  }, [players])

  // Sort players based on view toggle
  const sorted = [...players]
    .filter((p) => !selectedGamePk || p.gamePk === selectedGamePk)
    .sort((a, b) => {
      if (view === 'today') {
        const at = (a.todayH || 0) + (a.todayR || 0) + (a.todayRBI || 0)
        const bt = (b.todayH || 0) + (b.todayR || 0) + (b.todayRBI || 0)
        return bt - at
      }
      return (b.last7Total || 0) - (a.last7Total || 0)
    })

  const liveCount = players.filter((p) => p.gameStatus === 'Live').length

  return (
    <div className="p-4 space-y-4">
      {/* Starred rail */}
      <StarredRail players={players} starIds={stars} />

      {/* View toggle + refresh info */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex bg-navy-800 rounded-lg border border-navy-700 overflow-hidden">
          <button
            onClick={() => setView('today')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${view === 'today' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Today&apos;s Leaders
          </button>
          <button
            onClick={() => setView('heat')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${view === 'heat' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            7-Day Heat
          </button>
        </div>

        <div className="flex items-center gap-3">
          {liveCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-green-400">
              <span className="live-dot w-1.5 h-1.5 bg-green-400 rounded-full inline-block" />
              {liveCount} game{liveCount !== 1 ? 's' : ''} live
            </div>
          )}
          {lastRefresh && (
            <span className="text-xs text-slate-500">
              Updated {timeAgo(lastRefresh)}
            </span>
          )}
          <button
            onClick={onRetry}
            className="text-xs text-slate-500 hover:text-slate-300 border border-navy-700 rounded px-2 py-1"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={onRetry} compact />}

      {/* Live player board */}
      <div className="table-scroll-wrapper bg-navy-900/40 rounded-xl border border-navy-800 overflow-hidden">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10 bg-navy-900 border-b border-navy-800">
            <tr>
              {LIVE_COLS.map((col) => (
                <th
                  key={col.key}
                  className={`${col.w} px-2 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap`}
                >
                  {col.key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && !players.length && (
              Array.from({ length: 10 }).map((_, i) => (
                <SkeletonTableRow key={i} cols={LIVE_COLS.length} />
              ))
            )}
            {!loading && sorted.length === 0 && (
              <tr>
                <td colSpan={LIVE_COLS.length} className="text-center py-12 text-slate-500 text-sm">
                  {players.length === 0 ? 'No active games yet' : 'No players match filters'}
                </td>
              </tr>
            )}
            {sorted.map((player, i) => (
              <LivePlayerRow
                key={player.id}
                player={player}
                rank={i + 1}
                starred={stars.includes(String(player.id))}
                onToggleStar={onToggleStar}
                updatedIds={updatedIds}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
