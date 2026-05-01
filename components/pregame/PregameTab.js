'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import DateSelector from './DateSelector'
import GameDetailView from './GameDetailView'
import TeamLogo from '../ui/TeamLogo'
import TeamBadge from '../ui/TeamBadge'
import { formatCSTTime, inningOrdinal } from '@/lib/utils'

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTodayStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
}

function getGameStatus(game) {
  const state = game.status?.abstractGameState
  if (state === 'Final') return { label: 'FINAL', live: false, final: true }
  if (state === 'Live') {
    const ls     = game.linescore || {}
    const inning = ls.currentInning
    const half   = ls.inningHalf === 'Top' ? '▲' : '▼'
    const outs   = ls.outs
    return {
      label:  'LIVE',
      detail: `${half} ${inning ? inningOrdinal(inning) : ''}`,
      outs:   outs != null ? `${outs} out${outs !== 1 ? 's' : ''}` : '',
      live:   true,
      final:  false,
    }
  }
  const time = game.gameDate ? formatCSTTime(game.gameDate) : (game.status?.detailedState || '')
  return { label: time, live: false, final: false, scheduled: true }
}

// ── TBA pitcher silhouette ────────────────────────────────────────────────────

function TBASilhouette({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Pitcher TBA">
      <circle cx="14" cy="14" r="14" fill="var(--bg-subtle)" />
      <circle cx="14" cy="10" r="4" fill="var(--text-muted)" />
      <path d="M6 25c0-4.418 3.582-8 8-8s8 3.582 8 8" fill="var(--text-muted)" />
    </svg>
  )
}

// ── Expand icon ───────────────────────────────────────────────────────────────

function ExpandIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1 5V1h4M9 1h4v4M13 9v4H9M5 13H1V9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Vertical Game Card (Fix 2) ────────────────────────────────────────────────

function VerticalGameCard({ game, selected, onSelect, onExpand, showExpand }) {
  const home      = game.teams?.home
  const away      = game.teams?.away
  const status    = getGameStatus(game)
  const homeScore = game.linescore?.teams?.home?.runs
  const awayScore = game.linescore?.teams?.away?.runs
  const hasScore  = homeScore != null && awayScore != null && !status.scheduled

  const homePitcher = home?.probablePitcher
  const awayPitcher = away?.probablePitcher

  return (
    <div
      className={`
        relative flex items-stretch rounded-xl border transition-all duration-150 card-shadow overflow-hidden cursor-pointer
        ${selected
          ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/20 shadow-[0_0_0_2px_rgba(245,158,11,0.15)]'
          : 'border-[var(--border)] bg-[var(--bg-card)] hover:border-amber-300 hover:shadow-md'
        }
      `}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect()}
      aria-pressed={selected}
    >
      {/* Gold left accent when selected */}
      {selected && (
        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-amber-400 flex-shrink-0" />
      )}

      <div className={`flex-1 min-w-0 py-3 ${selected ? 'pl-4' : 'pl-3'} pr-2`}>

        {/* Away row */}
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <TeamLogo teamId={away?.team?.id} abbr={away?.team?.abbreviation} size="sm" />
            <TeamBadge abbr={away?.team?.abbreviation} size="xs" />
            <span className="text-[10px] text-[var(--text-muted)] truncate hidden sm:inline">
              {awayPitcher ? `SP: ${awayPitcher.fullName}` : <em>SP: TBA</em>}
            </span>
          </div>
          {hasScore ? (
            <span className={`text-sm font-bold tabular-nums ml-2 flex-shrink-0 ${awayScore > homeScore ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
              {awayScore}
            </span>
          ) : status.scheduled ? (
            <span className="text-xs text-blue-600 font-semibold tabular-nums ml-2 whitespace-nowrap flex-shrink-0">{status.label} CST</span>
          ) : null}
        </div>

        {/* Home row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <TeamLogo teamId={home?.team?.id} abbr={home?.team?.abbreviation} size="sm" />
            <TeamBadge abbr={home?.team?.abbreviation} size="xs" />
            <span className="text-[10px] text-[var(--text-muted)] truncate hidden sm:inline">
              {homePitcher ? `SP: ${homePitcher.fullName}` : <em>SP: TBA</em>}
            </span>
          </div>
          {hasScore ? (
            <span className={`text-sm font-bold tabular-nums ml-2 flex-shrink-0 ${homeScore > awayScore ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
              {homeScore}
            </span>
          ) : null}
        </div>

        {/* Status row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {status.live ? (
              <>
                <span className="live-dot w-1.5 h-1.5 bg-green-500 rounded-full inline-block flex-shrink-0" />
                <span className="text-[10px] font-bold text-green-600 uppercase">Live</span>
                {status.detail && <span className="text-[10px] text-[var(--text-muted)]">{status.detail}</span>}
                {status.outs  && <span className="text-[10px] text-[var(--text-muted)]">· {status.outs}</span>}
              </>
            ) : status.final ? (
              <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">Final</span>
            ) : null}
          </div>

          {/* SP names on mobile (desktop shows inline with team rows) */}
          <div className="sm:hidden flex flex-col items-end gap-0.5 min-w-0 flex-shrink overflow-hidden">
            <span className="text-[9px] text-[var(--text-muted)] truncate">
              {awayPitcher ? `SP: ${awayPitcher.fullName}` : 'SP: TBA'}
            </span>
            <span className="text-[9px] text-[var(--text-muted)] truncate">
              {homePitcher ? `SP: ${homePitcher.fullName}` : 'SP: TBA'}
            </span>
          </div>
        </div>
      </div>

      {/* Right: expand icon + chevron */}
      <div className="flex flex-col items-center justify-center gap-2 pr-3 pl-1 flex-shrink-0">
        {showExpand && (
          <button
            className="hidden lg:flex items-center justify-center w-7 h-7 rounded-md text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] transition-colors"
            onClick={(e) => { e.stopPropagation(); onExpand?.() }}
            aria-label="Open full-screen view"
            title="Open in modal"
          >
            <ExpandIcon />
          </button>
        )}
        <svg className="text-[var(--text-muted)] opacity-40" width="7" height="12" viewBox="0 0 7 12" fill="none" aria-hidden="true">
          <path d="M1 1l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  )
}

// ── Game Modal — Fix 3 (desktop only) ────────────────────────────────────────

function GameModal({ game, players, stars, onToggleStar, onClose }) {
  const overlayRef = useRef(null)

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  function handleBackdropClick(e) {
    if (e.target === overlayRef.current) onClose()
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 hidden lg:flex items-center justify-center modal-backdrop"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={handleBackdropClick}
      aria-modal="true"
      role="dialog"
    >
      <div className="modal-content relative flex flex-col w-[80vw] max-w-[960px] max-h-[90vh] bg-[var(--bg-card)] rounded-2xl shadow-2xl overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors text-base leading-none"
          aria-label="Close modal"
        >
          ✕
        </button>
        <div className="overflow-y-auto flex-1 p-5">
          <GameDetailView
            game={game}
            players={players}
            stars={stars}
            onToggleStar={onToggleStar}
            onDeselect={onClose}
          />
        </div>
      </div>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function GameListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-[88px] rounded-xl skeleton" />
      ))}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function PregameTab({
  players,
  stars,
  onToggleStar,
  selectedGamePk,
  onSelectGame,
}) {
  const [selectedDate, setSelectedDate] = useState(getTodayStr)
  const [gamesData,    setGamesData]    = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [fetchError,   setFetchError]   = useState(null)
  const [modalGame,    setModalGame]    = useState(null)

  const fetchGames = useCallback(async (date) => {
    setLoading(true)
    setFetchError(null)
    try {
      const res = await fetch(`/api/mlb/games/today?date=${date}`)
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      setGamesData(data)
    } catch (e) {
      setFetchError(e.message)
      setGamesData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchGames(selectedDate)
    onSelectGame(null)
  }, [selectedDate]) // eslint-disable-line react-hooks/exhaustive-deps

  const games        = gamesData?.games || []
  const selectedGame = selectedGamePk
    ? games.find((g) => g.gamePk === selectedGamePk) || null
    : null

  function handleSelectGame(pk) {
    onSelectGame(selectedGamePk === pk ? null : pk)
  }

  return (
    <div className="p-4 max-w-screen-2xl mx-auto w-full">

      {/* Fix 1 — Date Selector */}
      <div className="mb-4">
        <DateSelector selectedDate={selectedDate} onDateChange={setSelectedDate} />
      </div>

      {/* Error */}
      {fetchError && !loading && (
        <div className="text-center py-10">
          <div className="text-3xl mb-3">⚾</div>
          <p className="text-sm text-[var(--text-secondary)] mb-3">{fetchError}</p>
          <button
            onClick={() => fetchGames(selectedDate)}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Fix 2 — Mobile: vertical game list, selected game expands inline */}
      {!fetchError && (
        <div className="lg:hidden space-y-2">
          {loading && <GameListSkeleton />}
          {!loading && games.length === 0 && (
            <div className="text-center py-10 text-sm text-[var(--text-muted)]">
              No games scheduled for this date
            </div>
          )}
          {!loading && games.map((game) => (
            <div key={game.gamePk}>
              <VerticalGameCard
                game={game}
                selected={selectedGamePk === game.gamePk}
                onSelect={() => handleSelectGame(game.gamePk)}
                showExpand={false}
              />
              {selectedGamePk === game.gamePk && (
                <div className="mt-2 mb-1">
                  <GameDetailView
                    game={game}
                    players={players}
                    stars={stars}
                    onToggleStar={onToggleStar}
                    onDeselect={() => onSelectGame(null)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Fix 2 — Desktop: left panel (380px) + right panel */}
      {!fetchError && (
        <div className="hidden lg:flex gap-5 items-start">
          {/* Left panel */}
          <div className="w-[380px] flex-shrink-0 space-y-2">
            {loading && <GameListSkeleton />}
            {!loading && games.length === 0 && (
              <div className="text-center py-10 text-sm text-[var(--text-muted)]">
                No games scheduled for this date
              </div>
            )}
            {!loading && games.map((game) => (
              <VerticalGameCard
                key={game.gamePk}
                game={game}
                selected={selectedGamePk === game.gamePk}
                onSelect={() => handleSelectGame(game.gamePk)}
                onExpand={() => setModalGame(game)}
                showExpand
              />
            ))}
          </div>

          {/* Right panel */}
          <div className="flex-1 min-w-0">
            {selectedGame ? (
              <GameDetailView
                game={selectedGame}
                players={players}
                stars={stars}
                onToggleStar={onToggleStar}
                onDeselect={() => onSelectGame(null)}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-[var(--text-muted)] text-sm gap-2">
                <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <circle cx="18" cy="18" r="16" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
                  <path d="M11 18h14M18 11v14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.25" />
                </svg>
                <span className="opacity-50">Select a game to view details</span>
                <span className="text-[11px] opacity-35">Use the expand icon to open in a modal</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fix 3 — Desktop modal */}
      {modalGame && (
        <GameModal
          game={modalGame}
          players={players}
          stars={stars}
          onToggleStar={onToggleStar}
          onClose={() => setModalGame(null)}
        />
      )}
    </div>
  )
}
