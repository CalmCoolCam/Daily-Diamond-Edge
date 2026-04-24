'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import TeamBadge from '../ui/TeamBadge'
import { fmtERA, computeMatchupGrade, gradeColor, gradeBgColor } from '@/lib/mlbApi'
import { formatCSTTime, inningOrdinal } from '@/lib/utils'

// ── Date helpers ───────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
}

function offsetDate(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString('en-CA')
}

function formatDisplayDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

// 2026 MLB season bounds
const SEASON_START = '2026-03-26'
const SEASON_END   = '2026-10-04'

function clampDate(dateStr) {
  if (dateStr < SEASON_START) return SEASON_START
  if (dateStr > SEASON_END)   return SEASON_END
  return dateStr
}

// ── Game status ────────────────────────────────────────────────────────────────

function getGameStatus(game) {
  const state = game.status?.abstractGameState
  if (state === 'Final') return { label: 'FINAL', type: 'final' }
  if (state === 'Live') {
    const ls = game.linescore || {}
    const inning = ls.currentInning
    const half = ls.inningHalf === 'Top' ? '▲' : '▼'
    return {
      label: `${half} ${inning ? inningOrdinal(inning) : ''}`,
      type: 'live',
    }
  }
  const time = game.gameDate ? formatCSTTime(game.gameDate) + ' CST' : (game.status?.detailedState || 'Scheduled')
  return { label: time, type: 'scheduled' }
}

function extractPitcherStats(statsData) {
  const splits = statsData?.stats?.[0]?.splits || []
  const stat = splits[0]?.stat || {}
  return {
    era:   stat.era != null ? parseFloat(stat.era) : null,
    kPer9: stat.strikeoutsPer9Inn != null ? parseFloat(stat.strikeoutsPer9Inn) : null,
    whip:  stat.whip != null ? parseFloat(stat.whip) : null,
  }
}

// ── Generic pitcher placeholder SVG ───────────────────────────────────────────

function PitcherPlaceholder({ size = 48 }) {
  return (
    <div
      className="rounded-full bg-[var(--bg-subtle)] border border-[var(--border)] flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size }}
    >
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none"
           stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
           className="text-[var(--text-muted)]">
        <circle cx="12" cy="7" r="4" />
        <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
      </svg>
    </div>
  )
}

function PitcherHeadshot({ id, name, size = 48 }) {
  const [errored, setErrored] = useState(false)
  if (!id || errored) return <PitcherPlaceholder size={size} />
  return (
    <img
      src={`https://img.mlbstatic.com/mlb-photos/image/upload/w_100,q_auto:best/v1/people/${id}/headshot/67/current`}
      alt={name}
      width={size} height={size}
      className="rounded-full object-cover bg-[var(--bg-subtle)] flex-shrink-0"
      style={{ width: size, height: size }}
      onError={() => setErrored(true)}
    />
  )
}

// ── Game Detail View ───────────────────────────────────────────────────────────

function GameDetailView({ game, onClose }) {
  const home = game.teams?.home
  const away = game.teams?.away
  const homePitcher = home?.probablePitcher
  const awayPitcher = away?.probablePitcher
  const homePitcherStats = extractPitcherStats(game.homePitcherStats)
  const awayPitcherStats = extractPitcherStats(game.awayPitcherStats)
  const avgERA = ((awayPitcherStats.era ?? 4.5) + (homePitcherStats.era ?? 4.5)) / 2
  const grade = computeMatchupGrade(avgERA, avgERA)
  const status = getGameStatus(game)

  const awayScore = game.linescore?.teams?.away?.runs
  const homeScore = game.linescore?.teams?.home?.runs
  const hasScore = awayScore != null && homeScore != null

  // Lineup from roster (active roster as proxy; real lineup requires live feed)
  const awayRoster = game.awayRoster?.roster?.filter((m) => m.position?.abbreviation !== 'P') || []
  const homeRoster = game.homeRoster?.roster?.filter((m) => m.position?.abbreviation !== 'P') || []
  const isLiveOrFinal = status.type === 'live' || status.type === 'final'

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-subtle)] flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <TeamBadge abbr={away?.team?.abbreviation} size="sm" />
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              {away?.team?.abbreviation}
            </span>
            {hasScore && (
              <span className={`text-xl font-bold tabular-nums ${awayScore > homeScore ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
                {awayScore}
              </span>
            )}
          </div>
          <span className="text-[var(--text-muted)] text-sm">@</span>
          <div className="flex items-center gap-2">
            {hasScore && (
              <span className={`text-xl font-bold tabular-nums ${homeScore > awayScore ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
                {homeScore}
              </span>
            )}
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              {home?.team?.abbreviation}
            </span>
            <TeamBadge abbr={home?.team?.abbreviation} size="sm" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {status.type === 'live' && (
            <span className="live-dot w-2 h-2 bg-green-500 rounded-full inline-block" />
          )}
          <span className={`text-xs font-semibold ${
            status.type === 'live' ? 'text-green-500'
            : status.type === 'final' ? 'text-[var(--text-muted)]'
            : 'text-blue-500'
          }`}>{status.label}</span>
          {onClose && (
            <button
              onClick={onClose}
              className="ml-2 w-7 h-7 flex items-center justify-center rounded-full hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors text-lg leading-none"
              aria-label="Close"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">

        {/* Pitcher Matchup */}
        <div>
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
            Starting Pitchers
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              { side: 'away', pitcher: awayPitcher, stats: awayPitcherStats, teamAbbr: away?.team?.abbreviation },
              { side: 'home', pitcher: homePitcher, stats: homePitcherStats, teamAbbr: home?.team?.abbreviation },
            ].map(({ side, pitcher, stats, teamAbbr }) => (
              <div key={side} className="stat-box">
                <div className="stat-box-label mb-2">{teamAbbr} Starter</div>
                {pitcher ? (
                  <div className="flex items-center gap-3">
                    <PitcherHeadshot id={pitcher.id} name={pitcher.fullName} />
                    <div className="min-w-0">
                      <div className="stat-box-name truncate mb-1">{pitcher.fullName}</div>
                      <div className="flex gap-4">
                        <div className="text-center">
                          <div className="stat-box-label">ERA</div>
                          <div className="stat-box-value">{fmtERA(stats.era)}</div>
                        </div>
                        <div className="text-center">
                          <div className="stat-box-label">K/9</div>
                          <div className="stat-box-value">{stats.kPer9?.toFixed(1) || '--'}</div>
                        </div>
                        <div className="text-center">
                          <div className="stat-box-label">WHIP</div>
                          <div className="stat-box-value">{stats.whip?.toFixed(2) || '--'}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <PitcherPlaceholder size={48} />
                    <div>
                      <div className="stat-box-name">TBA</div>
                      <div className="stat-box-label">Pitcher not yet announced</div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Matchup Grade */}
        <div className={`rounded-xl border p-3 ${gradeBgColor(grade)}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-[var(--text-muted)] mb-0.5">Matchup Grade</div>
              <div className="text-xs text-[var(--text-secondary)]">Based on opposing pitcher ERA</div>
            </div>
            <span className={`text-5xl font-bold ${gradeColor(grade)}`}
              style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
              {grade}
            </span>
          </div>
        </div>

        {/* Lineups */}
        <div>
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
            Rosters
          </h3>
          {isLiveOrFinal || awayRoster.length > 0 || homeRoster.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: `${away?.team?.abbreviation} Batters`, roster: awayRoster },
                { label: `${home?.team?.abbreviation} Batters`, roster: homeRoster },
              ].map(({ label, roster }) => (
                <div key={label}>
                  <div className="stat-box-label mb-2">{label}</div>
                  {roster.length > 0 ? (
                    <div className="space-y-1">
                      {roster.slice(0, 12).map((m) => (
                        <div key={m.person?.id} className="flex items-center justify-between text-xs">
                          <span className="text-[var(--text-primary)] truncate max-w-[120px]">
                            {m.person?.fullName}
                          </span>
                          <span className="text-[var(--text-muted)] ml-1 flex-shrink-0">
                            {m.position?.abbreviation}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--text-muted)] italic">
                      Lineup not yet announced — check back closer to game time
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[var(--text-muted)] italic">
              Lineup not yet announced — check back closer to game time
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Game Card ──────────────────────────────────────────────────────────────────

function GameCard({ game, isExpanded, isSelected, onToggle, onSelect, onOpenModal }) {
  const home = game.teams?.home
  const away = game.teams?.away
  const status = getGameStatus(game)
  const awayScore = game.linescore?.teams?.away?.runs
  const homeScore = game.linescore?.teams?.home?.runs
  const hasScore = awayScore != null && homeScore != null

  const awayPitcher = away?.probablePitcher
  const homePitcher = home?.probablePitcher

  return (
    <div className={`rounded-xl border transition-all duration-150 bg-[var(--bg-card)] card-shadow ${
      isSelected || isExpanded ? 'border-amber-400' : 'border-[var(--border)] hover:border-[var(--border-strong)]'
    }`}>
      {/* Card main row */}
      <button
        onClick={onToggle || onSelect}
        className="w-full text-left p-3.5"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-3">
          {/* Teams + scores */}
          <div className="flex-1 min-w-0">
            {/* Away */}
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <TeamBadge abbr={away?.team?.abbreviation} size="xs" />
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                  {away?.team?.abbreviation}
                </span>
              </div>
              {hasScore && (
                <span className={`text-base font-bold tabular-nums ${awayScore > homeScore ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
                  {awayScore}
                </span>
              )}
            </div>
            {/* Home */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TeamBadge abbr={home?.team?.abbreviation} size="xs" />
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                  {home?.team?.abbreviation}
                </span>
              </div>
              {hasScore && (
                <span className={`text-base font-bold tabular-nums ${homeScore > awayScore ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
                  {homeScore}
                </span>
              )}
            </div>
          </div>

          {/* Status + chevron */}
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            {/* Status badge */}
            <div className="flex items-center gap-1.5">
              {status.type === 'live' && (
                <span className="live-dot w-1.5 h-1.5 bg-green-500 rounded-full inline-block" />
              )}
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                status.type === 'live'
                  ? 'bg-green-100 text-green-700'
                  : status.type === 'final'
                    ? 'bg-[var(--bg-subtle)] text-[var(--text-muted)]'
                    : 'bg-blue-50 text-blue-600'
              }`}>
                {status.label}
              </span>
            </div>
            {/* Chevron */}
            <svg
              width="16" height="16" viewBox="0 0 16 16" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className={`text-[var(--text-muted)] transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
            >
              <path d="M6 3l5 5-5 5" />
            </svg>
          </div>
        </div>

        {/* Probable pitchers */}
        <div className="mt-2.5 pt-2.5 border-t border-[var(--border)] flex gap-4">
          <div className="flex-1 min-w-0">
            <span className="text-[10px] text-[var(--text-muted)]">SP: </span>
            <span className="text-[10px] text-[var(--text-secondary)] truncate">
              {awayPitcher?.fullName || 'TBA'}
            </span>
          </div>
          <div className="flex-1 min-w-0 text-right">
            <span className="text-[10px] text-[var(--text-muted)]">SP: </span>
            <span className="text-[10px] text-[var(--text-secondary)] truncate">
              {homePitcher?.fullName || 'TBA'}
            </span>
          </div>
        </div>
      </button>

      {/* Desktop: expand icon for modal */}
      {onOpenModal && (
        <div className="hidden lg:block absolute top-3 right-10">
          <button
            onClick={(e) => { e.stopPropagation(); onOpenModal() }}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            title="Open in modal"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M8 2h4v4M6 8L12 2M2 6v6h6" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}

// ── Date Selector ──────────────────────────────────────────────────────────────

function DateSelector({ date, onChange }) {
  const [showPicker, setShowPicker] = useState(false)
  const today = todayStr()
  const isToday = date === today

  return (
    <div className="flex items-center justify-between gap-2 py-2 px-1">
      <button
        onClick={() => onChange(clampDate(offsetDate(date, -1)))}
        disabled={date <= SEASON_START}
        className="w-9 h-9 flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        aria-label="Previous day"
      >
        ‹
      </button>

      <div className="flex-1 flex justify-center">
        {showPicker ? (
          <input
            type="date"
            value={date}
            min={SEASON_START}
            max={SEASON_END}
            autoFocus
            onChange={(e) => { onChange(e.target.value); setShowPicker(false) }}
            onBlur={() => setShowPicker(false)}
            className="form-input text-center text-sm font-semibold w-full max-w-[180px]"
          />
        ) : (
          <button
            onClick={() => setShowPicker(true)}
            className="text-sm font-semibold text-[var(--text-primary)] hover:text-amber-500 transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-[var(--bg-hover)]"
          >
            {isToday ? (
              <span className="text-amber-500">Today</span>
            ) : (
              formatDisplayDate(date)
            )}
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="1" y="2" width="10" height="9" rx="1.5" />
              <path d="M4 1v2M8 1v2M1 5h10" />
            </svg>
          </button>
        )}
      </div>

      <button
        onClick={() => onChange(clampDate(offsetDate(date, 1)))}
        disabled={date >= SEASON_END}
        className="w-9 h-9 flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        aria-label="Next day"
      >
        ›
      </button>

      {!isToday && (
        <button
          onClick={() => onChange(today)}
          className="text-xs text-amber-500 hover:text-amber-400 font-medium px-2 py-1 rounded border border-amber-300 hover:bg-amber-50 transition-colors"
        >
          Today
        </button>
      )}
    </div>
  )
}

// ── Modal ──────────────────────────────────────────────────────────────────────

function GameModal({ game, onClose }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Modal */}
      <div className="relative z-10 w-full max-w-3xl max-h-[90vh] bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] shadow-2xl flex flex-col overflow-hidden animate-fade-in">
        <GameDetailView game={game} onClose={onClose} />
      </div>
    </div>
  )
}

// ── Main Export ────────────────────────────────────────────────────────────────

export default function DailyMatchupsTab() {
  const [selectedDate, setSelectedDate] = useState(todayStr)
  const [gamesData, setGamesData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Desktop: selected game for right panel
  const [selectedGamePk, setSelectedGamePk] = useState(null)
  // Mobile: expanded game inline
  const [expandedGamePk, setExpandedGamePk] = useState(null)
  // Modal game
  const [modalGamePk, setModalGamePk] = useState(null)

  const fetchGames = useCallback(async (date) => {
    setLoading(true)
    setError(null)
    setSelectedGamePk(null)
    setExpandedGamePk(null)
    try {
      const res = await fetch(`/api/mlb/games/today?date=${date}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setGamesData(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchGames(selectedDate)
  }, [selectedDate, fetchGames])

  const games = gamesData?.games || []
  const selectedGame = games.find((g) => g.gamePk === selectedGamePk)
  const modalGame = games.find((g) => g.gamePk === modalGamePk)

  function handleCardClick(gamePk) {
    // Mobile: toggle expand
    setExpandedGamePk((prev) => prev === gamePk ? null : gamePk)
  }

  function handleDesktopSelect(gamePk) {
    setSelectedGamePk((prev) => prev === gamePk ? null : gamePk)
  }

  return (
    <div className="p-3 lg:p-4">
      {/* Date selector */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] px-3 mb-4 card-shadow">
        <DateSelector date={selectedDate} onChange={setSelectedDate} />
      </div>

      {/* ── Mobile layout: full-width vertical list ── */}
      <div className="lg:hidden">
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-28 rounded-xl skeleton" />
            ))}
          </div>
        )}
        {!loading && error && (
          <div className="text-center py-12">
            <p className="text-[var(--text-muted)] text-sm mb-3">{error}</p>
            <button onClick={() => fetchGames(selectedDate)} className="text-sm text-amber-500 underline">
              Retry
            </button>
          </div>
        )}
        {!loading && !error && games.length === 0 && (
          <div className="text-center py-12 text-[var(--text-muted)] text-sm">
            No games scheduled for this date
          </div>
        )}
        {!loading && !error && (
          <div className="space-y-3">
            {games.map((game) => (
              <div key={game.gamePk} className="relative">
                <GameCard
                  game={game}
                  isExpanded={expandedGamePk === game.gamePk}
                  isSelected={false}
                  onToggle={() => handleCardClick(game.gamePk)}
                />
                {/* Inline expanded detail */}
                {expandedGamePk === game.gamePk && (
                  <div className="mt-1 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden animate-fade-in">
                    <GameDetailView game={game} onClose={null} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Desktop layout: left panel + right panel ── */}
      <div className="hidden lg:flex gap-4" style={{ minHeight: 'calc(100vh - 260px)' }}>
        {/* Left: game list ~420px */}
        <div className="w-[420px] flex-shrink-0 space-y-3 overflow-y-auto pr-1">
          {loading && (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-28 rounded-xl skeleton" />
            ))
          )}
          {!loading && error && (
            <div className="text-center py-12">
              <p className="text-[var(--text-muted)] text-sm mb-3">{error}</p>
              <button onClick={() => fetchGames(selectedDate)} className="text-sm text-amber-500 underline">
                Retry
              </button>
            </div>
          )}
          {!loading && !error && games.length === 0 && (
            <div className="text-center py-12 text-[var(--text-muted)] text-sm">
              No games scheduled for this date
            </div>
          )}
          {!loading && !error && games.map((game) => (
            <div key={game.gamePk} className="relative">
              <GameCard
                game={game}
                isExpanded={false}
                isSelected={selectedGamePk === game.gamePk}
                onSelect={() => handleDesktopSelect(game.gamePk)}
                onToggle={() => handleDesktopSelect(game.gamePk)}
                onOpenModal={() => setModalGamePk(game.gamePk)}
              />
            </div>
          ))}
        </div>

        {/* Right: game detail panel */}
        <div className="flex-1 min-w-0 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] card-shadow overflow-hidden">
          {selectedGame ? (
            <GameDetailView game={selectedGame} onClose={() => setSelectedGamePk(null)} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="text-4xl mb-3">⚾</div>
              <p className="text-[var(--text-secondary)] font-medium mb-1">Select a game to view details</p>
              <p className="text-xs text-[var(--text-muted)]">Pitcher matchup, stats, and rosters</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal overlay */}
      {modalGame && (
        <GameModal game={modalGame} onClose={() => setModalGamePk(null)} />
      )}
    </div>
  )
}
