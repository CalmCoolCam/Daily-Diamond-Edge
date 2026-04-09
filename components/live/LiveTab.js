'use client'
import { useState, useEffect, useRef } from 'react'
import StarredRail from './StarredRail'
import TeamBadge from '../ui/TeamBadge'
import HeatDot from '../ui/HeatDot'
import Sparkline from '../ui/Sparkline'
import StarButton from '../StarButton'
import ErrorState from '../ui/ErrorState'
import { SkeletonTableRow } from '../ui/Skeleton'
import { playerDisplayName } from '@/lib/mlbApi'
import { timeAgo } from '@/lib/utils'
import { usePicks } from '@/hooks/usePicks'

const LIVE_COLS = [
  { key: '#',       w: 'w-8' },
  { key: 'Player',  w: 'min-w-[130px]' },
  { key: 'Team',    w: 'w-16',  mobile: false },
  { key: 'Opp',    w: 'w-12',  mobile: false },
  { key: 'H/R/RBI', w: 'w-24', mobile: false },
  { key: 'Today',  w: 'w-14' },
  { key: '7-Day',  w: 'w-14' },
  { key: 'Trend',  w: 'w-20',  mobile: false },
  { key: '🌡',      w: 'w-10',  mobile: false },
  { key: '★',       w: 'w-14' },
]

function LivePlayerRow({ player, rank, starred, onToggleStar, updatedIds }) {
  const { getCount } = usePicks()
  const pickCount = getCount(player.name, player.teamAbbr)
  const isUpdated = updatedIds?.has(String(player.id))
  const isLive = player.gameStatus === 'Live'
  const todayTotal = (player.todayH || 0) + (player.todayR || 0) + (player.todayRBI || 0)

  return (
    <tr className={`
      border-b border-slate-100 text-sm transition-colors duration-150
      hover:bg-slate-50
      ${starred ? 'starred-row' : ''}
      ${isUpdated ? 'stat-updated' : ''}
    `}>
      <td className="px-2 py-2.5 text-center text-xs text-slate-300 tabular-nums hidden lg:table-cell">
        {rank}
      </td>

      {/* Name — sticky */}
      <td className="sticky-col px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          {isLive && <span className="live-dot w-1.5 h-1.5 bg-green-500 rounded-full inline-block flex-shrink-0" />}
          <div>
            <div className="font-medium text-slate-900 text-xs truncate max-w-[130px]">
              {playerDisplayName(player.name, player.heatTier)}
            </div>
            <div className="text-[10px] text-slate-400">{player.position}</div>
          </div>
        </div>
      </td>

      <td className="px-2 py-2.5 text-center hidden lg:table-cell">
        <TeamBadge abbr={player.teamAbbr} size="xs" />
      </td>

      <td className="px-2 py-2.5 text-center hidden lg:table-cell">
        <span className="text-xs text-slate-400 font-mono">{player.opponentAbbr || '--'}</span>
      </td>

      <td className="px-2 py-2.5 text-center hidden lg:table-cell">
        <span className="text-xs font-mono text-slate-500 whitespace-nowrap tabular-nums">
          {player.todayH || 0}/{player.todayR || 0}/{player.todayRBI || 0}
        </span>
      </td>

      {/* Today total */}
      <td className="px-2 py-2.5 text-center">
        <span className={`text-sm font-bold tabular-nums ${
          todayTotal >= 3 ? 'text-green-600' : todayTotal >= 1 ? 'text-amber-500' : 'text-slate-300'
        }`}>
          {todayTotal}
        </span>
      </td>

      {/* 7-day */}
      <td className="px-2 py-2.5 text-center">
        <span className="text-sm font-bold text-amber-500 tabular-nums">{player.last7Total || 0}</span>
      </td>

      <td className="px-2 py-2.5 text-center hidden lg:table-cell">
        <div className="flex justify-center">
          <Sparkline data={player.sparkline || []} heatTier={player.heatTier} width={56} height={18} />
        </div>
      </td>

      <td className="px-2 py-2.5 text-center hidden lg:table-cell">
        <div className="flex justify-center">
          <HeatDot heatTier={player.heatTier} />
        </div>
      </td>

      <td className="px-2 py-2.5 text-center">
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

export default function LiveTab({ players, loading, error, onRetry, stars, onToggleStar, selectedGamePk, lastRefresh }) {
  const [view, setView] = useState('today')
  const [updatedIds, setUpdatedIds] = useState(new Set())
  const prevRef = useRef({})

  useEffect(() => {
    if (!players.length) return
    const updated = new Set()
    players.forEach((p) => {
      const prev = prevRef.current[p.id]
      if (!prev) return
      const prevT = (prev.todayH || 0) + (prev.todayR || 0) + (prev.todayRBI || 0)
      const currT = (p.todayH || 0) + (p.todayR || 0) + (p.todayRBI || 0)
      if (currT !== prevT) updated.add(String(p.id))
    })
    setUpdatedIds(updated)
    players.forEach((p) => { prevRef.current[p.id] = p })
    if (updated.size) {
      const t = setTimeout(() => setUpdatedIds(new Set()), 3000)
      return () => clearTimeout(t)
    }
  }, [players])

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
      <StarredRail players={players} starIds={stars} />

      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex bg-white rounded-lg border border-slate-200 overflow-hidden card-shadow">
          <button onClick={() => setView('today')}
            className={`px-4 py-2 text-sm font-medium transition-colors min-h-[36px] ${view === 'today' ? 'bg-blue-700 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
            Today&apos;s Leaders
          </button>
          <button onClick={() => setView('heat')}
            className={`px-4 py-2 text-sm font-medium transition-colors min-h-[36px] ${view === 'heat' ? 'bg-blue-700 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
            7-Day Heat
          </button>
        </div>

        <div className="flex items-center gap-3">
          {liveCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
              <span className="live-dot w-1.5 h-1.5 bg-green-500 rounded-full inline-block" />
              {liveCount} live
            </div>
          )}
          {lastRefresh && (
            <span className="text-xs text-slate-400">Updated {timeAgo(lastRefresh)}</span>
          )}
          <button onClick={onRetry}
            className="text-xs text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg px-2.5 py-1.5 hover:bg-slate-50 transition-colors min-h-[36px]">
            ↻ Refresh
          </button>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={onRetry} compact />}

      <div className="table-scroll-wrapper bg-white rounded-xl border border-slate-200 card-shadow overflow-hidden">
        <table className="w-full border-collapse">
          <thead className="border-b border-slate-200">
            <tr>
              {LIVE_COLS.map((col) => (
                <th key={col.key}
                  className={`${col.w} px-2 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap bg-slate-50 ${col.mobile === false ? 'hidden lg:table-cell' : ''}`}>
                  {col.key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && !players.length && Array.from({ length: 10 }).map((_, i) => (
              <SkeletonTableRow key={i} cols={LIVE_COLS.length} />
            ))}
            {!loading && sorted.length === 0 && (
              <tr>
                <td colSpan={LIVE_COLS.length} className="text-center py-12 text-slate-400 text-sm">
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
