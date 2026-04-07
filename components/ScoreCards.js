'use client'
import { useEffect, useRef } from 'react'
import TeamBadge from './ui/TeamBadge'
import { SkeletonScoreCard } from './ui/Skeleton'
import ErrorState from './ui/ErrorState'
import { formatCSTTime, inningOrdinal } from '@/lib/utils'

function getGameStatus(game) {
  const state = game.status?.abstractGameState
  const detail = game.status?.detailedState || ''

  if (state === 'Final') {
    return { label: 'Final', live: false, final: true }
  }
  if (state === 'Live') {
    const linescore = game.linescore || {}
    const inning = linescore.currentInning
    const half = linescore.inningHalf === 'Top' ? '▲' : '▼'
    const outs = linescore.outs
    return {
      label: `${half} ${inning ? inningOrdinal(inning) : ''}`,
      outs: outs != null ? `${outs} out${outs !== 1 ? 's' : ''}` : '',
      live: true,
      final: false,
    }
  }
  // Scheduled / Preview
  const time = game.gameDate ? formatCSTTime(game.gameDate) : detail
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
        p-3 text-left min-h-[76px] hover:border-gold-500/60 hover:bg-navy-700/60
        ${selected
          ? 'border-gold-500 bg-navy-700/80 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
          : 'border-navy-700 bg-navy-800/60'
        }
      `}
      aria-label={`${away?.team?.abbreviation} vs ${home?.team?.abbreviation}`}
    >
      {/* Status row */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1">
          {status.live && (
            <span className="live-dot w-1.5 h-1.5 bg-green-400 rounded-full inline-block" />
          )}
          <span className={`text-[10px] font-medium ${status.live ? 'text-green-400' : status.final ? 'text-slate-400' : 'text-blue-400'}`}>
            {status.label}
          </span>
        </div>
        {status.outs && (
          <span className="text-[9px] text-slate-500">{status.outs}</span>
        )}
      </div>

      {/* Away team */}
      <div className="flex items-center justify-between mb-0.5">
        <div className="flex items-center gap-1.5">
          <TeamBadge abbr={away?.team?.abbreviation} size="xs" />
          <span className="text-xs text-slate-400 truncate max-w-[64px]">
            {away?.team?.abbreviation}
          </span>
        </div>
        {hasScore && (
          <span className={`text-sm font-bold tabular-nums ${awayScore > homeScore ? 'text-white' : 'text-slate-400'}`}>
            {awayScore}
          </span>
        )}
      </div>

      {/* Home team */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <TeamBadge abbr={home?.team?.abbreviation} size="xs" />
          <span className="text-xs text-slate-400 truncate max-w-[64px]">
            {home?.team?.abbreviation}
          </span>
        </div>
        {hasScore && (
          <span className={`text-sm font-bold tabular-nums ${homeScore > awayScore ? 'text-white' : 'text-slate-400'}`}>
            {homeScore}
          </span>
        )}
      </div>
    </button>
  )
}

export default function ScoreCards({ games, loading, error, onRetry, selectedGamePk, onSelectGame }) {
  const scrollRef = useRef(null)

  // Auto-scroll to keep selected card visible
  useEffect(() => {
    if (!selectedGamePk || !scrollRef.current) return
    const selected = scrollRef.current.querySelector('[aria-pressed="true"]')
    selected?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [selectedGamePk])

  return (
    <div className="bg-[#060d1a]/80 border-b border-navy-800">
      <div
        ref={scrollRef}
        className="score-scroll flex gap-3 px-4 py-3 overflow-x-auto"
        role="list"
        aria-label="Today's games"
      >
        {loading && !games?.length && (
          <>
            {Array.from({ length: 6 }).map((_, i) => <SkeletonScoreCard key={i} />)}
          </>
        )}

        {error && !loading && (
          <div className="w-full">
            <ErrorState message={error} onRetry={onRetry} compact />
          </div>
        )}

        {!loading && !error && games?.length === 0 && (
          <div className="flex items-center text-sm text-slate-500 py-4">
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
