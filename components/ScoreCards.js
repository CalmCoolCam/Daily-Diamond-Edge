'use client'
import { useRef } from 'react'
import TeamBadge from './ui/TeamBadge'
import { SkeletonScoreCard } from './ui/Skeleton'
import ErrorState from './ui/ErrorState'
import { formatCSTTime, inningOrdinal } from '@/lib/utils'

function getGameStatus(game) {
  const state = game.status?.abstractGameState
  if (state === 'Final') return { label: 'Final', live: false, final: true }
  if (state === 'Live') {
    const ls = game.linescore || {}
    const inning = ls.currentInning
    const half = ls.inningHalf === 'Top' ? '▲' : '▼'
    const outs = ls.outs
    return {
      label: `${half} ${inning ? inningOrdinal(inning) : ''}`,
      outs: outs != null ? `${outs} out${outs !== 1 ? 's' : ''}` : '',
      live: true, final: false,
    }
  }
  const time = game.gameDate ? formatCSTTime(game.gameDate) : (game.status?.detailedState || '')
  return { label: time, live: false, final: false }
}

function ScoreCard({ game, selected, onClick }) {
  const home = game.teams?.home
  const away = game.teams?.away
  const status = getGameStatus(game)
  const homeScore = game.linescore?.teams?.home?.runs
  const awayScore = game.linescore?.teams?.away?.runs
  const hasScore = homeScore != null && awayScore != null

  return (
    <button
      onClick={() => onClick(game.gamePk)}
      className={`
        flex-shrink-0 w-44 rounded-xl border transition-all duration-150
        p-3 text-left min-h-[80px]
        ${selected
          ? 'border-amber-400 bg-amber-50 shadow-[0_0_0_2px_rgba(245,158,11,0.2)]'
          : status.live
            ? 'border-t-2 border-t-blue-500 border-x-slate-200 border-b-slate-200 bg-white card-shadow hover:border-blue-400'
            : status.final
              ? 'border-slate-200 bg-white card-shadow hover:border-slate-300'
              : 'border-slate-200 bg-white card-shadow hover:border-amber-300'
        }
      `}
      aria-label={`${away?.team?.abbreviation} at ${home?.team?.abbreviation}`}
    >
      {/* Status row */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1">
          {status.live && (
            <span className="live-dot w-1.5 h-1.5 bg-green-500 rounded-full inline-block flex-shrink-0" />
          )}
          <span className={`text-[10px] font-semibold ${
            status.live ? 'text-green-600' : status.final ? 'text-slate-400' : 'text-blue-600'
          }`}>
            {status.label}
          </span>
        </div>
        {status.outs && (
          <span className="text-[9px] text-slate-400">{status.outs}</span>
        )}
      </div>

      {/* Away */}
      <div className="flex items-center justify-between mb-0.5">
        <div className="flex items-center gap-1.5">
          <TeamBadge abbr={away?.team?.abbreviation} size="xs" />
          <span className="text-xs text-slate-500">{away?.team?.abbreviation}</span>
        </div>
        {hasScore && (
          <span className={`text-sm font-bold tabular-nums ${awayScore > homeScore ? 'text-slate-900' : 'text-slate-400'}`}>
            {awayScore}
          </span>
        )}
      </div>

      {/* Home */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <TeamBadge abbr={home?.team?.abbreviation} size="xs" />
          <span className="text-xs text-slate-500">{home?.team?.abbreviation}</span>
        </div>
        {hasScore && (
          <span className={`text-sm font-bold tabular-nums ${homeScore > awayScore ? 'text-slate-900' : 'text-slate-400'}`}>
            {homeScore}
          </span>
        )}
      </div>
    </button>
  )
}

export default function ScoreCards({ games, loading, error, onRetry, selectedGamePk, onSelectGame }) {
  const scrollRef = useRef(null)

  return (
    <div className="bg-white border-b border-slate-200">
      <div
        ref={scrollRef}
        className="score-scroll flex gap-3 px-4 py-3 overflow-x-auto"
        role="list"
        aria-label="Today's games"
      >
        {loading && !games?.length && (
          Array.from({ length: 5 }).map((_, i) => <SkeletonScoreCard key={i} />)
        )}

        {error && !loading && (
          <div className="w-full py-1">
            <ErrorState message={error} onRetry={onRetry} compact />
          </div>
        )}

        {!loading && !error && games?.length === 0 && (
          <div className="flex items-center text-sm text-slate-400 py-3">
            No games scheduled today
          </div>
        )}

        {games?.map((game) => (
          <ScoreCard
            key={game.gamePk}
            game={game}
            selected={selectedGamePk === game.gamePk}
            onClick={(pk) => onSelectGame(selectedGamePk === pk ? null : pk)}
          />
        ))}
      </div>
    </div>
  )
}
