'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import TeamBadge from '../ui/TeamBadge'
import HeatDot from '../ui/HeatDot'
import Sparkline from '../ui/Sparkline'
import ErrorState from '../ui/ErrorState'
import { playerDisplayName } from '@/lib/mlbApi'
import { formatCSTTime, getTodayLabel } from '@/lib/utils'
import { usePicks } from '@/hooks/usePicks'

const LIVE_REFRESH_MS = 60_000 // 60 seconds

// ── Rank badge ────────────────────────────────────────────────────────────────

function RankBadge({ rank }) {
  if (rank === 1) return (
    <div className="w-7 h-7 flex-shrink-0 bg-amber-400 rounded-full flex items-center justify-center">
      <span className="text-white font-bold text-xs">1</span>
    </div>
  )
  if (rank === 2) return (
    <div className="w-7 h-7 flex-shrink-0 bg-slate-400 rounded-full flex items-center justify-center">
      <span className="text-white font-bold text-xs">2</span>
    </div>
  )
  if (rank === 3) return (
    <div className="w-7 h-7 flex-shrink-0 bg-amber-700 rounded-full flex items-center justify-center">
      <span className="text-white font-bold text-xs">3</span>
    </div>
  )
  return (
    <div className="w-7 h-7 flex-shrink-0 flex items-center justify-center">
      <span className="text-[var(--text-muted)] font-semibold text-xs tabular-nums">{rank}</span>
    </div>
  )
}

// ── Game status indicator ─────────────────────────────────────────────────────

function GameStatusDot({ gameStatus }) {
  if (gameStatus === 'Live') {
    return <span className="live-dot w-1.5 h-1.5 bg-green-500 rounded-full inline-block flex-shrink-0" title="Live" />
  }
  if (gameStatus === 'Final') {
    return <span className="text-[10px] text-[var(--text-muted)]" title="Final">✓</span>
  }
  return null
}

// ── Shared row base class ─────────────────────────────────────────────────────

function rowClass(isStarred, isUpdated) {
  return [
    'border-b border-[var(--border)] transition-colors',
    isStarred
      ? 'bg-amber-50 dark:bg-amber-950/20 border-l-2 border-l-amber-400'
      : 'hover:bg-[var(--bg-hover)]',
    isUpdated ? 'stat-updated' : '',
  ].filter(Boolean).join(' ')
}

// ── LIVE NOW panel row ────────────────────────────────────────────────────────

function LiveNowRow({ player, rank, isStarred, isUpdated }) {
  const todayTotal = (player.todayH || 0) + (player.todayR || 0) + (player.todayRBI || 0)

  return (
    <tr className={rowClass(isStarred, isUpdated)}>
      <td className="px-2 py-2 text-center">
        <RankBadge rank={rank} />
      </td>
      <td className="px-2 py-2">
        <div className="flex items-center gap-1.5">
          <GameStatusDot gameStatus={player.gameStatus} />
          <div className="min-w-0">
            <div className="text-xs font-semibold text-[var(--text-primary)] truncate max-w-[110px]">
              {playerDisplayName(player.name, player.heatTier)}
            </div>
            <div className="text-[10px] text-[var(--text-muted)]">{player.position}</div>
          </div>
        </div>
      </td>
      <td className="px-1 py-2 text-center hidden sm:table-cell">
        <TeamBadge abbr={player.teamAbbr} size="xs" />
      </td>
      <td className="px-1 py-2 text-center">
        <span className="text-[10px] text-[var(--text-muted)] font-mono">{player.opponentAbbr || '--'}</span>
      </td>
      <td className="px-1 py-2 text-center">
        {/* H/R/RBI: hits + runs (NOT homeRuns) + rbi from liveData.boxscore */}
        <span className="text-[10px] font-mono text-[var(--text-secondary)] tabular-nums whitespace-nowrap">
          {player.todayH || 0}/{player.todayR || 0}/{player.todayRBI || 0}
        </span>
      </td>
      <td className="px-2 py-2 text-center">
        <span className={`text-sm font-bold tabular-nums ${
          todayTotal >= 3 ? 'text-green-600' : todayTotal >= 1 ? 'text-amber-500' : 'text-[var(--text-muted)]'
        }`}>
          {todayTotal}
        </span>
      </td>
    </tr>
  )
}

// ── LEADERBOARD panel row ─────────────────────────────────────────────────────

function LeaderboardRow({ player, rank, isStarred, view }) {
  const total = view === 'today'
    ? (player.todayH || 0) + (player.todayR || 0) + (player.todayRBI || 0)
    : (player.last7Total || 0)

  return (
    <tr className={rowClass(isStarred, false)}>
      <td className="px-2 py-2 text-center">
        <RankBadge rank={rank} />
      </td>
      <td className="px-2 py-2">
        <div className="text-xs font-semibold text-[var(--text-primary)] truncate max-w-[120px]">
          {playerDisplayName(player.name, player.heatTier)}
        </div>
        <div className="text-[10px] text-[var(--text-muted)]">{player.position}</div>
      </td>
      <td className="px-1 py-2 text-center hidden sm:table-cell">
        <TeamBadge abbr={player.teamAbbr} size="xs" />
      </td>
      <td className="px-1 py-2 text-center hidden md:table-cell">
        <span className="text-[10px] text-[var(--text-muted)] font-mono">{player.opponentAbbr || '--'}</span>
      </td>
      <td className="px-2 py-2 text-center">
        <span className={`text-sm font-bold tabular-nums ${
          total >= 3 ? 'text-green-600' : total >= 1 ? 'text-amber-500' : 'text-[var(--text-muted)]'
        }`}>
          {total}
        </span>
      </td>
      <td className="px-1 py-2 text-center hidden lg:table-cell">
        <div className="flex justify-center">
          {/* Sparkline: 7-day calendar H+R+RBI per game (from gameLog date range) */}
          <Sparkline data={player.sparkline || []} heatTier={player.heatTier} width={48} height={16} />
        </div>
      </td>
      <td className="px-1 py-2 text-center">
        <div className="flex justify-center">
          <HeatDot heatTier={player.heatTier} />
        </div>
      </td>
    </tr>
  )
}

// ── Toggle component ──────────────────────────────────────────────────────────

function Toggle({ options, value, onChange }) {
  return (
    <div className="flex bg-[var(--bg-page)] rounded-lg border border-[var(--border)] overflow-hidden">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1 text-xs font-semibold transition-colors min-h-[28px] ${
            value === opt.value
              ? 'bg-blue-700 text-white'
              : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ── LIVE NOW panel ────────────────────────────────────────────────────────────

function LiveNowPanel({ players, loading, stars, updatedIds, lastRefresh, onRefresh, selectedGamePk }) {
  const anyLive = players.some((p) => p.gameStatus === 'Live')

  const sorted = [...players]
    .filter((p) => !selectedGamePk || p.gamePk === selectedGamePk)
    // Include players from both Live and Final games (do not filter out completed)
    .filter((p) => p.gameStatus === 'Live' || p.gameStatus === 'Final')
    .sort((a, b) => {
      const at = (a.todayH || 0) + (a.todayR || 0) + (a.todayRBI || 0)
      const bt = (b.todayH || 0) + (b.todayR || 0) + (b.todayRBI || 0)
      return bt - at
    })

  return (
    <div className="flex flex-col bg-[var(--bg-card)] rounded-xl border border-[var(--border)] card-shadow overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-subtle)]">
        <div className="flex items-center gap-2">
          <span className="font-bold text-[var(--text-primary)] tracking-widest text-base"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
            LIVE NOW
          </span>
          {anyLive && (
            <span className="flex items-center gap-1 text-[10px] text-green-600 font-medium">
              <span className="live-dot w-1.5 h-1.5 bg-green-500 rounded-full inline-block" />
              In progress
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {lastRefresh && (
            <span className="text-[10px] text-[var(--text-muted)]">
              {formatCSTTime(lastRefresh)} CST
            </span>
          )}
          <button
            onClick={onRefresh}
            className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] border border-[var(--border)] rounded px-2 py-1 transition-colors"
          >
            ↻
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[var(--bg-subtle)]">
              {[
                { l: '#' },
                { l: 'Player' },
                { l: 'Team', c: 'hidden sm:table-cell' },
                { l: 'Opp' },
                { l: 'H/R/RBI' },
                { l: 'Total' },
              ].map((h) => (
                <th key={h.l}
                  className={`px-2 py-2 text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)] text-center whitespace-nowrap ${h.c || ''}`}>
                  {h.l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && !sorted.length && Array.from({ length: 8 }).map((_, i) => (
              <tr key={i} className="border-b border-[var(--border)]">
                {Array.from({ length: 6 }).map((_, j) => (
                  <td key={j} className="px-2 py-2">
                    <div className="skeleton h-3.5 rounded" />
                  </td>
                ))}
              </tr>
            ))}
            {!loading && sorted.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-10 text-[var(--text-muted)] text-xs">
                  No active or completed games yet today
                </td>
              </tr>
            )}
            {sorted.map((player, i) => (
              <LiveNowRow
                key={player.id}
                player={player}
                rank={i + 1}
                isStarred={stars.includes(String(player.id))}
                isUpdated={updatedIds?.has(String(player.id))}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── LEADERBOARD panel ─────────────────────────────────────────────────────────

function LeaderboardPanel({ players, loading, stars, selectedGamePk }) {
  const [view, setView] = useState('today')

  const sorted = [...players]
    .filter((p) => !selectedGamePk || p.gamePk === selectedGamePk)
    .filter((p) => {
      if (view === 'today') {
        // Today: only players from Live or Final games
        return p.gameStatus === 'Live' || p.gameStatus === 'Final'
      }
      // 7-day: all players (includes those who haven't played today)
      return true
    })
    .sort((a, b) => {
      if (view === 'today') {
        const at = (a.todayH || 0) + (a.todayR || 0) + (a.todayRBI || 0)
        const bt = (b.todayH || 0) + (b.todayR || 0) + (b.todayRBI || 0)
        return bt - at
      }
      // 7-day: sort by calendar-aggregate total (hits+runs+rbi across 7 days, NOT homeRuns)
      return (b.last7Total || 0) - (a.last7Total || 0)
    })

  return (
    <div className="flex flex-col bg-[var(--bg-card)] rounded-xl border border-[var(--border)] card-shadow overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-subtle)]">
        <span className="font-bold text-[var(--text-primary)] tracking-widest text-base"
          style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
          LEADERBOARD
        </span>
        <Toggle
          options={[{ value: 'today', label: 'TODAY' }, { value: '7day', label: '7-DAY' }]}
          value={view}
          onChange={setView}
        />
      </div>

      {/* Table */}
      <div className="overflow-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[var(--bg-subtle)]">
              {[
                { l: '#' },
                { l: 'Player' },
                { l: 'Team', c: 'hidden sm:table-cell' },
                { l: 'Opp', c: 'hidden md:table-cell' },
                { l: view === 'today' ? 'Today' : '7-Day' },
                { l: 'Trend', c: 'hidden lg:table-cell' },
                { l: '🌡' },
              ].map((h) => (
                <th key={h.l}
                  className={`px-2 py-2 text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)] text-center whitespace-nowrap ${h.c || ''}`}>
                  {h.l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && !sorted.length && Array.from({ length: 8 }).map((_, i) => (
              <tr key={i} className="border-b border-[var(--border)]">
                {Array.from({ length: 7 }).map((_, j) => (
                  <td key={j} className="px-2 py-2">
                    <div className="skeleton h-3.5 rounded" />
                  </td>
                ))}
              </tr>
            ))}
            {!loading && sorted.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-10 text-[var(--text-muted)] text-xs">
                  {view === 'today' ? 'No game stats yet today' : 'No 7-day data available'}
                </td>
              </tr>
            )}
            {sorted.map((player, i) => (
              <LeaderboardRow
                key={player.id}
                player={player}
                rank={i + 1}
                isStarred={stars.includes(String(player.id))}
                view={view}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function LeaderboardTab({ players, loading, error, onRetry, stars, onToggleStar, selectedGamePk }) {
  const [lastRefresh, setLastRefresh] = useState(null)
  const [updatedIds, setUpdatedIds] = useState(new Set())
  const [mobileView, setMobileView] = useState('leaderboard') // default: leaderboard on mobile
  const intervalRef = useRef(null)
  const prevRef = useRef({})

  // Track stat changes for pulse animation
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
    players.forEach((p) => { prevRef.current[p.id] = p })
    if (updated.size) {
      setUpdatedIds(updated)
      const t = setTimeout(() => setUpdatedIds(new Set()), 3000)
      return () => clearTimeout(t)
    }
  }, [players])

  // Auto-refresh every 60s
  useEffect(() => {
    setLastRefresh(new Date())
    intervalRef.current = setInterval(() => {
      onRetry()
      setLastRefresh(new Date())
    }, LIVE_REFRESH_MS)
    return () => clearInterval(intervalRef.current)
  }, [onRetry])

  const handleRefresh = useCallback(() => {
    onRetry()
    setLastRefresh(new Date())
  }, [onRetry])

  const anyLive = players.some((p) => p.gameStatus === 'Live')

  return (
    <div className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2
          className="text-2xl text-[var(--text-primary)] tracking-wider"
          style={{ fontFamily: "'Bebas Neue', sans-serif" }}
        >
          🏆 {getTodayLabel()}
        </h2>
        {anyLive && (
          <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
            <span className="live-dot w-1.5 h-1.5 bg-green-500 rounded-full inline-block" />
            Live games in progress
          </span>
        )}
      </div>

      {error && <ErrorState message={error} onRetry={handleRefresh} compact />}

      {/* ── Mobile: sub-toggle → single panel ── */}
      <div className="lg:hidden">
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setMobileView('livenow')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border transition-colors min-h-[44px] ${
              mobileView === 'livenow'
                ? 'bg-blue-700 text-white border-blue-700'
                : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border)]'
            }`}
          >
            ⚡ Live Now
          </button>
          <button
            onClick={() => setMobileView('leaderboard')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border transition-colors min-h-[44px] ${
              mobileView === 'leaderboard'
                ? 'bg-blue-700 text-white border-blue-700'
                : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border)]'
            }`}
          >
            🏆 Leaderboard
          </button>
        </div>

        {mobileView === 'livenow' && (
          <LiveNowPanel
            players={players}
            loading={loading}
            stars={stars}
            updatedIds={updatedIds}
            lastRefresh={lastRefresh}
            onRefresh={handleRefresh}
            selectedGamePk={selectedGamePk}
          />
        )}
        {mobileView === 'leaderboard' && (
          <LeaderboardPanel
            players={players}
            loading={loading}
            stars={stars}
            selectedGamePk={selectedGamePk}
          />
        )}
      </div>

      {/* ── Desktop: side-by-side panels ── */}
      <div className="hidden lg:grid grid-cols-2 gap-4" style={{ minHeight: 'calc(100vh - 260px)' }}>
        <LiveNowPanel
          players={players}
          loading={loading}
          stars={stars}
          updatedIds={updatedIds}
          lastRefresh={lastRefresh}
          onRefresh={handleRefresh}
          selectedGamePk={selectedGamePk}
        />
        <LeaderboardPanel
          players={players}
          loading={loading}
          stars={stars}
          selectedGamePk={selectedGamePk}
        />
      </div>
    </div>
  )
}
