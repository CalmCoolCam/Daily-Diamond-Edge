'use client'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import TeamBadge from '../ui/TeamBadge'
import TeamLogo from '../ui/TeamLogo'
import HeatDot from '../ui/HeatDot'
import Sparkline from '../ui/Sparkline'
import ErrorState from '../ui/ErrorState'
import { computeCategoryTiers } from '@/lib/mlbApi'
import { formatCSTTime, getTodayLabel } from '@/lib/utils'

const LIVE_REFRESH_MS = 60_000

// ── Stat categories ───────────────────────────────────────────────────────────

const STAT_CATEGORIES = [
  { id: 'hrbi',       label: 'H+R+RBI' },
  { id: 'hits',       label: 'HITS'    },
  { id: 'runs',       label: 'RUNS'    },
  { id: 'hr',         label: 'HR'      },
  { id: 'walks',      label: 'WALKS'   },
  { id: 'sb',         label: 'SB'      },
  { id: 'strikeouts', label: "K's"     },
]

function getStatValue(player, category, context = 'today') {
  if (context === 'today') {
    switch (category) {
      case 'hits':       return player.todayH   || 0
      case 'runs':       return player.todayR   || 0
      case 'hr':         return player.todayHR  || 0
      case 'walks':      return player.todayBB  || 0
      case 'sb':         return player.todaySB  || 0
      case 'strikeouts': return player.todaySO  || 0
      default: return (player.todayH || 0) + (player.todayR || 0) + (player.todayRBI || 0)
    }
  } else {
    switch (category) {
      case 'hits':       return player.last7Hits || 0
      case 'runs':       return player.last7Runs || 0
      case 'hr':         return player.last7HR   || 0
      case 'walks':      return player.last7BB   || 0
      case 'sb':         return player.last7SB   || 0
      case 'strikeouts': return player.last7SO   || 0
      default: return player.last7Total || 0
    }
  }
}

function getStatLabel(category, context) {
  if (category === 'strikeouts') return context === 'today' ? "K's Today" : "7-Day K's"
  const base = STAT_CATEGORIES.find((c) => c.id === category)?.label || 'H+R+RBI'
  return context === 'today' ? `Today ${base}` : `7-Day ${base}`
}

// ── Stat category tab strip ───────────────────────────────────────────────────

function StatCategoryTabs({ value, onChange }) {
  return (
    <div className="flex gap-0 overflow-x-auto score-scroll border-b border-[var(--border)] shrink-0">
      {STAT_CATEGORIES.map((cat) => {
        const active = value === cat.id
        const isK    = cat.id === 'strikeouts'
        return (
          <button
            key={cat.id}
            onClick={() => onChange(cat.id)}
            className={`flex-shrink-0 px-3 py-2 text-[11px] font-semibold whitespace-nowrap transition-colors relative ${
              active
                ? (isK ? 'text-red-500' : 'text-[var(--accent-gold)]')
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            {cat.id === 'strikeouts' ? "K's (Avoid)" : cat.label}
            {active && (
              <span className={`absolute bottom-0 left-0 right-0 h-0.5 ${isK ? 'bg-red-500' : 'bg-[var(--accent-gold)]'}`} />
            )}
          </button>
        )
      })}
    </div>
  )
}

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

// ── Tier indicator for category (flame or warning for K's) ───────────────────

function TierIndicator({ tier, isKCategory }) {
  if (tier !== 1) return null
  return (
    <span className="text-sm" title={isKCategory ? 'High strikeout risk' : 'On fire'}>
      {isKCategory ? '⚠️' : '🔥'}
    </span>
  )
}

// ── Player name cell — Logo + Abbr + Name ─────────────────────────────────────

function PlayerNameCell({ player, size = 'sm' }) {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <TeamLogo teamId={player.teamId} abbr={player.teamAbbr} size={size} />
      <span className="font-bold text-[9px] font-mono flex-shrink-0"
        style={{ color: 'var(--accent-blue)' }}>
        {player.teamAbbr}
      </span>
      <div className="min-w-0">
        <div className="text-xs font-semibold text-[var(--text-primary)] truncate max-w-[100px]">
          {player.name}
        </div>
        <div className="text-[10px] text-[var(--text-muted)]">{player.position}</div>
      </div>
    </div>
  )
}

// ── LIVE NOW panel row ────────────────────────────────────────────────────────

function LiveNowRow({ player, rank, isStarred, isUpdated, category, catTier }) {
  const todayTotal = getStatValue(player, category, 'today')
  const isK = category === 'strikeouts'

  return (
    <tr className={rowClass(isStarred, isUpdated)}>
      <td className="px-2 py-2 text-center">
        <RankBadge rank={rank} />
      </td>
      <td className="px-2 py-2">
        <div className="flex items-center gap-1">
          <GameStatusDot gameStatus={player.gameStatus} />
          <PlayerNameCell player={player} size="sm" />
          <TierIndicator tier={catTier} isKCategory={isK} />
        </div>
      </td>
      <td className="px-1 py-2 text-center">
        <span className="text-[10px] text-[var(--text-muted)] font-mono">{player.opponentAbbr || '--'}</span>
      </td>
      {category === 'hrbi' && (
        <td className="px-1 py-2 text-center hidden sm:table-cell">
          <span className="text-[10px] font-mono text-[var(--text-secondary)] tabular-nums whitespace-nowrap">
            {player.todayH || 0}/{player.todayR || 0}/{player.todayRBI || 0}
          </span>
        </td>
      )}
      <td className="px-2 py-2 text-center">
        <span className={`text-sm font-bold tabular-nums ${
          isK
            ? (todayTotal >= 2 ? 'text-red-500' : todayTotal >= 1 ? 'text-orange-400' : 'text-[var(--text-muted)]')
            : (todayTotal >= 3 ? 'text-green-600' : todayTotal >= 1 ? 'text-amber-500' : 'text-[var(--text-muted)]')
        }`}>
          {todayTotal}
        </span>
      </td>
    </tr>
  )
}

// ── LEADERBOARD panel row ─────────────────────────────────────────────────────

function LeaderboardRow({ player, rank, isStarred, view, category, catTier }) {
  const total = getStatValue(player, category, view === 'today' ? 'today' : '7day')
  const isK   = category === 'strikeouts'

  return (
    <tr className={rowClass(isStarred, false)}>
      <td className="px-2 py-2 text-center">
        <RankBadge rank={rank} />
      </td>
      <td className="px-2 py-2">
        <div className="flex items-center gap-1 min-w-0">
          <PlayerNameCell player={player} size="sm" />
          <TierIndicator tier={catTier} isKCategory={isK} />
        </div>
      </td>
      <td className="px-1 py-2 text-center hidden md:table-cell">
        <span className="text-[10px] text-[var(--text-muted)] font-mono">{player.opponentAbbr || '--'}</span>
      </td>
      <td className="px-2 py-2 text-center">
        <span className={`text-sm font-bold tabular-nums ${
          isK
            ? (total >= 2 ? 'text-red-500' : total >= 1 ? 'text-orange-400' : 'text-[var(--text-muted)]')
            : (total >= 3 ? 'text-green-600' : total >= 1 ? 'text-amber-500' : 'text-[var(--text-muted)]')
        }`}>
          {total}
        </span>
      </td>
      <td className="px-1 py-2 text-center hidden lg:table-cell">
        <div className="flex justify-center">
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

// ── Empty state for Live Now (no games in progress) ───────────────────────────

function LiveNowEmptyState({ games }) {
  const nextGame = useMemo(() => {
    if (!games?.length) return null
    const now = Date.now()
    const scheduled = games
      .filter((g) => g.status?.abstractGameState === 'Preview' || g.status?.abstractGameState === 'Pre-Game' || g.status?.abstractGameState === 'Scheduled')
      .map((g) => ({ time: new Date(g.gameDate).getTime(), dateStr: g.gameDate }))
      .filter((g) => g.time > now)
      .sort((a, b) => a.time - b.time)
    return scheduled[0] || null
  }, [games])

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center gap-3">
      <div className="text-4xl opacity-40">⚾</div>
      <p className="text-sm font-semibold text-[var(--text-secondary)]">No games in progress right now</p>
      {nextGame ? (
        <p className="text-xs text-[var(--text-muted)]">
          Check back at {formatCSTTime(nextGame.dateStr)} CST
        </p>
      ) : (
        <p className="text-xs text-[var(--text-muted)]">No upcoming games scheduled today</p>
      )}
    </div>
  )
}

// ── LIVE NOW panel ────────────────────────────────────────────────────────────

function LiveNowPanel({ players, loading, stars, updatedIds, lastRefresh, onRefresh, selectedGamePk, category, games }) {
  const catTiers = useMemo(
    () => computeCategoryTiers(players.filter((p) => p.gameStatus === 'Live'), category, 'today'),
    [players, category]
  )

  // Live Now shows ONLY players in currently live games
  const sorted = useMemo(() => [...players]
    .filter((p) => !selectedGamePk || p.gamePk === selectedGamePk)
    .filter((p) => p.gameStatus === 'Live')
    .sort((a, b) => getStatValue(b, category, 'today') - getStatValue(a, category, 'today')),
    [players, selectedGamePk, category]
  )

  const isK = category === 'strikeouts'
  const colLabel = isK ? "K's" : (STAT_CATEGORIES.find((c) => c.id === category)?.label || 'Total')

  return (
    <div className="flex flex-col bg-[var(--bg-card)] rounded-xl border border-[var(--border)] card-shadow overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-subtle)]">
        <div className="flex items-center gap-2">
          <span className="font-bold text-[var(--text-primary)] tracking-widest text-base"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
            LIVE NOW
          </span>
          {sorted.length > 0 && (
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
      <div className="overflow-auto flex-1">
        {loading && !sorted.length ? (
          <table className="w-full border-collapse">
            <tbody>
              {Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-[var(--border)]">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <td key={j} className="px-2 py-2"><div className="skeleton h-3.5 rounded" /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : sorted.length === 0 ? (
          <LiveNowEmptyState games={games} />
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[var(--bg-subtle)]">
                {[
                  { l: '#' },
                  { l: 'Player' },
                  { l: 'Opp' },
                  ...(category === 'hrbi' ? [{ l: 'H/R/RBI', c: 'hidden sm:table-cell' }] : []),
                  { l: isK ? "K's (Avoid)" : colLabel },
                ].map((h) => (
                  <th key={h.l}
                    className={`px-2 py-2 text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)] text-center whitespace-nowrap ${h.c || ''}`}>
                    {h.l}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((player, i) => (
                <LiveNowRow
                  key={player.id}
                  player={player}
                  rank={i + 1}
                  isStarred={stars.includes(String(player.id))}
                  isUpdated={updatedIds?.has(String(player.id))}
                  category={category}
                  catTier={catTiers[player.id] || 4}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ── LEADERBOARD panel ─────────────────────────────────────────────────────────

function LeaderboardPanel({ players, loading, stars, selectedGamePk, category }) {
  const [view, setView] = useState('today')
  const isK = category === 'strikeouts'

  const catTiers = useMemo(
    () => computeCategoryTiers(
      players.filter((p) => view === 'today' ? (p.gameStatus === 'Live' || p.gameStatus === 'Final') : true),
      category,
      view === 'today' ? 'today' : '7day'
    ),
    [players, category, view]
  )

  const sorted = useMemo(() => [...players]
    .filter((p) => !selectedGamePk || p.gamePk === selectedGamePk)
    .filter((p) => {
      if (view === 'today') return p.gameStatus === 'Live' || p.gameStatus === 'Final'
      return true
    })
    .sort((a, b) => getStatValue(b, category, view === 'today' ? 'today' : '7day') - getStatValue(a, category, view === 'today' ? 'today' : '7day')),
    [players, selectedGamePk, category, view]
  )

  const colLabel = view === 'today'
    ? (isK ? "K's Today" : `Today`)
    : (isK ? '7-Day K\'s' : '7-Day')

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
      <div className="overflow-auto flex-1">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[var(--bg-subtle)]">
              {[
                { l: '#' },
                { l: 'Player' },
                { l: 'Opp', c: 'hidden md:table-cell' },
                { l: colLabel },
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
                category={category}
                catTier={catTiers[player.id] || 4}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function LeaderboardTab({ players, games, loading, error, onRetry, stars, onToggleStar, selectedGamePk }) {
  const [lastRefresh, setLastRefresh]   = useState(null)
  const [updatedIds, setUpdatedIds]     = useState(new Set())
  const [mobileView, setMobileView]     = useState('leaderboard')
  const [statCategory, setStatCategory] = useState('hrbi')
  const intervalRef = useRef(null)
  const prevRef     = useRef({})

  // Track stat changes for pulse animation
  useEffect(() => {
    if (!players.length) return
    const updated = new Set()
    players.forEach((p) => {
      const prev = prevRef.current[p.id]
      if (!prev) return
      const prevT = (prev.todayH || 0) + (prev.todayR || 0) + (prev.todayRBI || 0)
      const currT = (p.todayH  || 0) + (p.todayR  || 0) + (p.todayRBI  || 0)
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

        {/* Stat category strip — shared, below the toggle */}
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] card-shadow mb-3 overflow-hidden">
          <StatCategoryTabs value={statCategory} onChange={setStatCategory} />
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
            category={statCategory}
            games={games}
          />
        )}
        {mobileView === 'leaderboard' && (
          <LeaderboardPanel
            players={players}
            loading={loading}
            stars={stars}
            selectedGamePk={selectedGamePk}
            category={statCategory}
          />
        )}
      </div>

      {/* ── Desktop: side-by-side panels ── */}
      <div className="hidden lg:flex flex-col gap-0" style={{ minHeight: 'calc(100vh - 260px)' }}>
        {/* Shared category strip spans both panels */}
        <div className="bg-[var(--bg-card)] rounded-t-xl border-t border-x border-[var(--border)] overflow-hidden">
          <StatCategoryTabs value={statCategory} onChange={setStatCategory} />
        </div>
        <div className="grid grid-cols-2 gap-4 flex-1" style={{ minHeight: 0 }}>
          <LiveNowPanel
            players={players}
            loading={loading}
            stars={stars}
            updatedIds={updatedIds}
            lastRefresh={lastRefresh}
            onRefresh={handleRefresh}
            selectedGamePk={selectedGamePk}
            category={statCategory}
            games={games}
          />
          <LeaderboardPanel
            players={players}
            loading={loading}
            stars={stars}
            selectedGamePk={selectedGamePk}
            category={statCategory}
          />
        </div>
      </div>
    </div>
  )
}
