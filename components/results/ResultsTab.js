'use client'
import { useMemo } from 'react'
import TeamBadge from '../ui/TeamBadge'
import HeatDot from '../ui/HeatDot'
import Sparkline from '../ui/Sparkline'
import StarButton from '../StarButton'
import ErrorState from '../ui/ErrorState'
import { SkeletonTableRow } from '../ui/Skeleton'
import { computeHeat } from '@/lib/mlbApi'
import { usePicks } from '@/hooks/usePicks'

const RESULTS_COLS = [
  { key: '#', w: 'w-8' },
  { key: 'Player', w: 'min-w-[130px]' },
  { key: 'Team', w: 'w-16' },
  { key: 'Opp', w: 'w-12' },
  { key: 'H', w: 'w-10' },
  { key: 'R', w: 'w-10' },
  { key: 'RBI', w: 'w-12' },
  { key: 'Total', w: 'w-14' },
  { key: 'S.H', w: 'w-12' },
  { key: 'S.R', w: 'w-12' },
  { key: 'S.RBI', w: 'w-14' },
  { key: 'S.Total', w: 'w-16' },
  { key: 'Trend', w: 'w-20' },
  { key: '🌡', w: 'w-10' },
  { key: '✓', w: 'w-10' },
  { key: '★', w: 'w-14' },
]

function DeliveredBadge({ total }) {
  if (total >= 3) {
    return <span className="text-green-400 font-bold text-sm" title="Delivered 3+ H+R+RBI">✓</span>
  }
  if (total < 1) {
    return <span className="text-red-400 font-bold text-sm" title="Under 1 H+R+RBI">✗</span>
  }
  return <span className="text-slate-500 text-sm" title="1-2 H+R+RBI">—</span>
}

function ResultsRow({ player, rank, starred, onToggleStar }) {
  const { getCount } = usePicks()
  const pickCount = getCount(player.name, player.teamAbbr)
  const todayTotal = (player.todayH || 0) + (player.todayR || 0) + (player.todayRBI || 0)

  return (
    <tr
      className={`
        border-b border-navy-800/60 text-sm transition-colors duration-150
        hover:bg-navy-800/40
        ${starred ? 'starred-row' : ''}
      `}
    >
      <td className="px-2 py-2 text-center text-xs text-slate-600 tabular-nums">{rank}</td>

      {/* Name — sticky */}
      <td className="sticky-col px-3 py-2">
        <div className="font-medium text-white text-xs truncate max-w-[130px]">{player.name}</div>
        <div className="text-[10px] text-slate-500">{player.position}</div>
      </td>

      <td className="px-2 py-2 text-center">
        <TeamBadge abbr={player.teamAbbr} size="xs" />
      </td>

      <td className="px-2 py-2 text-center">
        <span className="text-xs text-slate-400 font-mono">{player.opponentAbbr || '--'}</span>
      </td>

      {/* H */}
      <td className="px-2 py-2 text-center">
        <span className="text-xs tabular-nums text-white">{player.todayH || 0}</span>
      </td>

      {/* R */}
      <td className="px-2 py-2 text-center">
        <span className="text-xs tabular-nums text-white">{player.todayR || 0}</span>
      </td>

      {/* RBI */}
      <td className="px-2 py-2 text-center">
        <span className="text-xs tabular-nums text-white">{player.todayRBI || 0}</span>
      </td>

      {/* Total */}
      <td className="px-2 py-2 text-center">
        <span className={`text-sm font-bold tabular-nums ${
          todayTotal >= 3 ? 'text-green-400' :
          todayTotal >= 1 ? 'text-gold-400' : 'text-slate-500'
        }`}>
          {todayTotal}
        </span>
      </td>

      {/* Season stats */}
      <td className="px-2 py-2 text-center">
        <span className="text-xs tabular-nums text-slate-300">{player.seasonH || 0}</span>
      </td>
      <td className="px-2 py-2 text-center">
        <span className="text-xs tabular-nums text-slate-300">{player.seasonR || 0}</span>
      </td>
      <td className="px-2 py-2 text-center">
        <span className="text-xs tabular-nums text-slate-300">{player.seasonRBI || 0}</span>
      </td>
      <td className="px-2 py-2 text-center">
        <span className="text-xs font-semibold tabular-nums text-slate-300">{player.seasonTotal || 0}</span>
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

      {/* Delivered */}
      <td className="px-2 py-2 text-center">
        <DeliveredBadge total={todayTotal} />
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

export default function ResultsTab({ players, loading, error, onRetry, stars, onToggleStar, selectedGamePk }) {
  const finishedPlayers = useMemo(() => {
    return players.filter((p) => p.gameStatus === 'Final')
      .filter((p) => !selectedGamePk || p.gamePk === selectedGamePk)
  }, [players, selectedGamePk])

  // Starred players at top
  const sorted = useMemo(() => {
    const starred = finishedPlayers.filter((p) => stars.includes(String(p.id)))
    const others = finishedPlayers.filter((p) => !stars.includes(String(p.id)))
    const sortFn = (a, b) => {
      const at = (a.todayH || 0) + (a.todayR || 0) + (a.todayRBI || 0)
      const bt = (b.todayH || 0) + (b.todayR || 0) + (b.todayRBI || 0)
      return bt - at
    }
    return [...starred.sort(sortFn), ...others.sort(sortFn)]
  }, [finishedPlayers, stars])

  const deliveredCount = sorted.filter((p) => (p.todayH || 0) + (p.todayR || 0) + (p.todayRBI || 0) >= 3).length
  const starredFinished = sorted.filter((p) => stars.includes(String(p.id))).length

  return (
    <div className="p-4 space-y-4">
      {/* Summary bar */}
      {sorted.length > 0 && (
        <div className="flex items-center gap-6 bg-navy-800/60 rounded-xl border border-navy-700 px-4 py-3">
          <div className="text-center">
            <div className="text-xl font-bold text-white tabular-nums">{sorted.length}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wide">Games Done</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-green-400 tabular-nums">{deliveredCount}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wide">Delivered 3+</div>
          </div>
          {starredFinished > 0 && (
            <div className="text-center">
              <div className="text-xl font-bold text-gold-400 tabular-nums">
                {sorted.filter((p) => stars.includes(String(p.id)) && (p.todayH || 0) + (p.todayR || 0) + (p.todayRBI || 0) >= 3).length}
                /{starredFinished}
              </div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wide">Stars Delivered</div>
            </div>
          )}
        </div>
      )}

      {error && <ErrorState message={error} onRetry={onRetry} compact />}

      {/* Table */}
      <div className="table-scroll-wrapper bg-navy-900/40 rounded-xl border border-navy-800 overflow-hidden">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10 bg-navy-900 border-b border-navy-800">
            <tr>
              {RESULTS_COLS.map((col) => (
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
              Array.from({ length: 8 }).map((_, i) => (
                <SkeletonTableRow key={i} cols={RESULTS_COLS.length} />
              ))
            )}

            {!loading && sorted.length === 0 && (
              <tr>
                <td colSpan={RESULTS_COLS.length} className="text-center py-12 text-slate-500 text-sm">
                  {players.length === 0
                    ? 'No completed games yet — check back later today'
                    : 'No finished games match your filter'}
                </td>
              </tr>
            )}

            {sorted.map((player, i) => (
              <ResultsRow
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
