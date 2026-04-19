'use client'
import { useState, useCallback } from 'react'
import TeamBadge from '../ui/TeamBadge'
import TeamLogo from '../ui/TeamLogo'
import { SkeletonMatchupCard } from '../ui/Skeleton'
import {
  computeMatchupGrade,
  computeCompositeMatchupScore,
  scoreToGrade,
  gradeColor,
  gradeColorHex,
  gradeBgColor,
  fmtERA,
  currentSeason,
} from '@/lib/mlbApi'
import { formatCSTTime } from '@/lib/utils'
import { getCached, setCached } from '@/lib/storage'

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractPitcherStats(statsData) {
  const splits = statsData?.stats?.[0]?.splits || []
  const stat   = splits[0]?.stat || {}
  return {
    era:   stat.era   != null ? parseFloat(stat.era)                 : null,
    kPer9: stat.strikeoutsPer9Inn != null ? parseFloat(stat.strikeoutsPer9Inn) : null,
    whip:  stat.whip  != null ? parseFloat(stat.whip)                : null,
  }
}

function StatPill({ label, value }) {
  return (
    <div className="text-center">
      <div className="text-[9px] text-slate-400 uppercase tracking-wider">{label}</div>
      <div className="text-xs font-semibold text-slate-700 tabular-nums">{value}</div>
    </div>
  )
}

function ComponentBar({ label, weight, score, missing = false }) {
  const pct = missing ? 0 : Math.round(score ?? 0)
  const color = pct >= 60 ? '#16a34a' : pct >= 40 ? '#f59e0b' : '#dc2626'
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-slate-500">{label}</span>
        <span className="text-slate-400 font-mono">{weight}% · {missing ? 'N/A' : `${pct}/100`}</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

// ── Day-scoped matchup cache (module level, resets when page reloads after 3am CST) ──

const matchupMemCache = {}

function matchupCacheKey(batterId, pitcherId) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
  return `matchup_${batterId}_${pitcherId}_${today}`
}

async function fetchMatchupDetail(batterId, pitcherId, season) {
  const key = matchupCacheKey(batterId, pitcherId)

  // 1. Module-level in-memory (fastest)
  if (matchupMemCache[key]) return matchupMemCache[key]

  // 2. localStorage
  const lsCached = getCached(key)
  if (lsCached) {
    matchupMemCache[key] = lsCached
    return lsCached
  }

  // 3. Fetch from API
  const res = await fetch(`/api/mlb/matchup?batterId=${batterId}&pitcherId=${pitcherId}&season=${season}`)
  if (!res.ok) throw new Error(`Matchup fetch failed: ${res.status}`)
  const data = await res.json()

  // Cache for full day (TTL = 24h in ms, but storage.js TTL is 60s by default —
  // use a very long TTL so it lasts all day)
  const DAY_MS = 20 * 60 * 60 * 1000  // 20 hours
  setCached(key, data, DAY_MS)
  matchupMemCache[key] = data
  return data
}

// ── Plain-English summary builder ─────────────────────────────────────────────

function buildSummary(grade, components, vsPlayer, lastStartsAvg) {
  const parts = []

  if (grade === 'A' || grade === 'B') {
    parts.push('Favorable matchup')
    if (vsPlayer?.sufficient) {
      parts.push(`batter is ${vsPlayer.h} for ${vsPlayer.ab} lifetime${vsPlayer.hr > 0 ? ` with ${vsPlayer.hr} HR` : ''}`)
    }
    if (lastStartsAvg?.era != null && lastStartsAvg.era > 4.5) {
      parts.push(`pitcher has struggled recently (${parseFloat(lastStartsAvg.era).toFixed(2)} ERA last 3)`)
    }
    if (components.starter?.score < 40) {
      parts.push('weak starter')
    }
  } else if (grade === 'D' || grade === 'F') {
    parts.push('Tough matchup')
    if (vsPlayer?.sufficient && vsPlayer.ab > 0) {
      const avg = (vsPlayer.h / vsPlayer.ab).toFixed(3)
      if (parseFloat(avg) < 0.200) parts.push(`batter is just ${vsPlayer.h} for ${vsPlayer.ab} vs this pitcher`)
    }
    if (lastStartsAvg?.era != null && lastStartsAvg.era < 3.0) {
      parts.push(`pitcher is sharp recently (${parseFloat(lastStartsAvg.era).toFixed(2)} ERA last 3)`)
    }
    if (components.starter?.score > 70) {
      parts.push('elite starter')
    }
  } else {
    parts.push('Average matchup')
    if (components.batterForm?.score > 60) parts.push('batter is in good recent form')
  }

  return parts.length > 1 ? `${parts[0]} — ${parts.slice(1).join(', ')}.` : `${parts[0]}.`
}

// ── Expanded matchup detail panel ─────────────────────────────────────────────

function MatchupDetailPanel({ game, batterId, batterLast7, playerName }) {
  const [detail, setDetail]   = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const season = currentSeason()

  // Determine which pitcher this batter faces
  // (will be called from context, so we pass isHome via usage)
  const home     = game.teams?.home
  const away     = game.teams?.away
  const homePitcherStats = extractPitcherStats(game.homePitcherStats)
  const awayPitcherStats = extractPitcherStats(game.awayPitcherStats)

  const loadDetail = useCallback(async (isHome, pitcherId) => {
    if (!pitcherId || loading || detail) return
    setLoading(true)
    setError(null)
    try {
      const data = await fetchMatchupDetail(batterId, pitcherId, season)
      setDetail({ ...data, isHome })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [batterId, season, loading, detail])

  // ── Grade computation ────────────────────────────────────────────────────────
  // We show one panel per game (not per batter), so we compute an average/overview grade
  // for the game matchup using the away batter perspective (faces home pitcher)
  const starterERA = awayPitcherStats.era ?? 4.5
  const bullpenERA = 4.5  // Default; not per-team here since this is game-level view

  // Last 3 starts avg from detail
  const lastStartsAvg = detail?.lastStarts?.length > 0
    ? {
        era:   detail.lastStarts.reduce((s, x) => s + (parseFloat(x.era) || 4.5), 0) / detail.lastStarts.length,
        whip:  detail.lastStarts.reduce((s, x) => s + (parseFloat(x.whip) || 1.3), 0) / detail.lastStarts.length,
        kPer9: null,
      }
    : null

  const vsPlayer = detail?.vsPlayer || null

  const { score, components } = computeCompositeMatchupScore({
    starterSeason: awayPitcherStats.era != null ? awayPitcherStats : null,
    batterForm:    batterLast7 || 0,
    bullpenERA,
    lastStartsAvg,
    vsPlayer,
  })

  const grade = scoreToGrade(score, [])  // standalone grade, no peer comparison here
  const summary = buildSummary(grade, components, vsPlayer, lastStartsAvg)

  return (
    <div className={`mt-2 rounded-xl border p-3.5 card-shadow filter-drawer ${gradeBgColor(grade)}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TeamLogo teamId={away?.team?.id} abbr={away?.team?.abbreviation} size="sm" />
          <TeamBadge abbr={away?.team?.abbreviation} size="xs" />
          <span className="text-xs text-slate-400">@</span>
          <TeamLogo teamId={home?.team?.id} abbr={home?.team?.abbreviation} size="sm" />
          <TeamBadge abbr={home?.team?.abbreviation} size="xs" />
          <span className="text-xs text-slate-400">{formatCSTTime(game.gameDate)}</span>
        </div>
        <div className="flex flex-col items-end">
          <span
            className="text-2xl font-bold leading-none"
            style={{ fontFamily: "'Bebas Neue', sans-serif", color: gradeColorHex(grade) }}
          >
            {grade}
          </span>
          <span className="text-[9px] text-slate-400">score: {score}/100</span>
        </div>
      </div>

      {/* Pitcher season stats */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-white/80 rounded-lg p-2 border border-white">
          <div className="text-[9px] text-slate-400 uppercase tracking-wide mb-1">
            {away?.team?.abbreviation} Starter
          </div>
          {away?.probablePitcher ? (
            <>
              <div className="text-xs font-medium text-slate-800 truncate mb-1.5">
                {away.probablePitcher.fullName}
              </div>
              <div className="flex gap-3">
                <StatPill label="ERA"  value={fmtERA(awayPitcherStats.era)} />
                <StatPill label="K/9"  value={awayPitcherStats.kPer9?.toFixed(1) || '--'} />
                <StatPill label="WHIP" value={awayPitcherStats.whip?.toFixed(2) || '--'} />
              </div>
            </>
          ) : <div className="text-xs text-slate-400 italic">TBD</div>}
        </div>

        <div className="bg-white/80 rounded-lg p-2 border border-white">
          <div className="text-[9px] text-slate-400 uppercase tracking-wide mb-1">
            {home?.team?.abbreviation} Starter
          </div>
          {home?.probablePitcher ? (
            <>
              <div className="text-xs font-medium text-slate-800 truncate mb-1.5">
                {home.probablePitcher.fullName}
              </div>
              <div className="flex gap-3">
                <StatPill label="ERA"  value={fmtERA(homePitcherStats.era)} />
                <StatPill label="K/9"  value={homePitcherStats.kPer9?.toFixed(1) || '--'} />
                <StatPill label="WHIP" value={homePitcherStats.whip?.toFixed(2) || '--'} />
              </div>
            </>
          ) : <div className="text-xs text-slate-400 italic">TBD</div>}
        </div>
      </div>

      {/* 5-component breakdown */}
      <div className="bg-white/60 rounded-lg p-2.5 border border-white space-y-2 mb-3">
        <div className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold mb-1">
          Grade Components
        </div>
        <ComponentBar
          label={`vs ${home?.probablePitcher?.fullName || 'Starter'} (lifetime)`}
          weight={30}
          score={components.h2h?.score}
          missing={!components.h2h?.sufficient && components.h2h?.score == null}
        />
        <ComponentBar label="Starter season stats"   weight={25} score={components.starter?.score} />
        <ComponentBar label="Batter 7-day form"       weight={25} score={components.batterForm?.score} />
        <ComponentBar label="Bullpen ERA"              weight={15} score={components.bullpen?.score} />
        <ComponentBar
          label="Pitcher last 3 starts"
          weight={5}
          score={components.lastStarts?.score}
          missing={components.lastStarts?.score == null}
        />
      </div>

      {/* H2H history */}
      {vsPlayer && (
        <div className="bg-white/60 rounded-lg p-2 border border-white mb-2">
          <div className="text-[9px] text-slate-400 uppercase tracking-wide mb-1">Career vs Starter</div>
          {vsPlayer.sufficient ? (
            <div className="text-xs font-mono text-slate-700">
              {vsPlayer.h} for {vsPlayer.ab}
              {vsPlayer.hr > 0 ? `, ${vsPlayer.hr} HR` : ''}
              {vsPlayer.rbi > 0 ? `, ${vsPlayer.rbi} RBI` : ''}
              {' '}({vsPlayer.avg})
            </div>
          ) : (
            <div className="text-xs text-slate-400 italic">
              {vsPlayer.ab > 0 ? `Only ${vsPlayer.ab} career AB — insufficient sample` : 'No career matchup data'}
            </div>
          )}
        </div>
      )}

      {/* Pitcher last 3 starts */}
      {detail?.lastStarts?.length > 0 && (
        <div className="bg-white/60 rounded-lg p-2 border border-white mb-2">
          <div className="text-[9px] text-slate-400 uppercase tracking-wide mb-1.5">
            {home?.probablePitcher?.fullName?.split(' ').pop() || 'Pitcher'} — Last 3 Starts
          </div>
          <table className="w-full text-[10px]">
            <thead>
              <tr className="text-slate-400">
                <th className="text-left font-medium pb-1">Date</th>
                <th className="text-center font-medium pb-1">Opp</th>
                <th className="text-center font-medium pb-1">IP</th>
                <th className="text-center font-medium pb-1">ER</th>
                <th className="text-center font-medium pb-1">K</th>
                <th className="text-center font-medium pb-1">ERA</th>
              </tr>
            </thead>
            <tbody>
              {detail.lastStarts.map((s, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="py-0.5 text-slate-600 font-mono">{s.date?.slice(5) || '--'}</td>
                  <td className="py-0.5 text-center text-slate-500">{s.opponent}</td>
                  <td className="py-0.5 text-center font-mono text-slate-600">{s.ip}</td>
                  <td className="py-0.5 text-center font-mono text-slate-600">{s.er}</td>
                  <td className="py-0.5 text-center font-mono text-slate-600">{s.k}</td>
                  <td className="py-0.5 text-center font-mono text-slate-600">{s.era || '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Plain-English summary */}
      <div className="text-[10px] text-slate-500 italic border-t border-slate-200 pt-2">
        {summary}
      </div>

      {/* Load detail button (if not loaded) */}
      {!detail && !loading && batterId && (home?.probablePitcher?.id || away?.probablePitcher?.id) && (
        <button
          onClick={() => {
            const pitcherId = home?.probablePitcher?.id
            if (pitcherId) loadDetail(false, pitcherId)
          }}
          className="mt-2 w-full text-[10px] text-blue-600 hover:text-blue-800 border border-blue-200 rounded px-2 py-1 bg-white/60 transition-colors"
        >
          Load full matchup detail ↓
        </button>
      )}
      {loading && (
        <div className="mt-2 text-[10px] text-slate-400 text-center animate-pulse">Loading matchup data…</div>
      )}
      {error && (
        <div className="mt-2 text-[10px] text-red-500">{error}</div>
      )}
    </div>
  )
}

// ── Mobile chip + expandable drawer ──────────────────────────────────────────

function MatchupChipMobile({ game, isExpanded, onToggle }) {
  const home = game.teams?.home
  const away = game.teams?.away
  const homePitcherStats = extractPitcherStats(game.homePitcherStats)
  const awayPitcherStats = extractPitcherStats(game.awayPitcherStats)
  const avgERA = ((awayPitcherStats.era ?? 4.5) + (homePitcherStats.era ?? 4.5)) / 2
  const grade  = computeMatchupGrade(avgERA, avgERA)

  return (
    <div className="flex-shrink-0">
      <button
        onClick={onToggle}
        className={`
          flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-medium
          transition-all duration-150 whitespace-nowrap
          ${isExpanded
            ? 'bg-amber-50 border-amber-300 shadow-sm'
            : 'bg-white border-slate-200 hover:border-slate-300 card-shadow'
          }
        `}
      >
        <TeamLogo teamId={away?.team?.id} abbr={away?.team?.abbreviation} size="sm" />
        <span className="text-slate-500">{away?.team?.abbreviation}</span>
        <span className="text-slate-300">@</span>
        <TeamLogo teamId={home?.team?.id} abbr={home?.team?.abbreviation} size="sm" />
        <span className="text-slate-500">{home?.team?.abbreviation}</span>
        <span
          className={`font-bold text-sm ml-0.5 ${gradeColor(grade)}`}
          style={{ fontFamily: "'Bebas Neue', sans-serif" }}
        >
          {grade}
        </span>
      </button>
    </div>
  )
}

// ── Desktop full card ─────────────────────────────────────────────────────────

function MatchupCardDesktop({ game, selectedGamePk, onSelectGame }) {
  const [showDetail, setShowDetail] = useState(false)
  const home = game.teams?.home
  const away = game.teams?.away
  const homePitcher      = home?.probablePitcher
  const awayPitcher      = away?.probablePitcher
  const homePitcherStats = extractPitcherStats(game.homePitcherStats)
  const awayPitcherStats = extractPitcherStats(game.awayPitcherStats)
  const avgERA   = ((awayPitcherStats.era ?? 4.5) + (homePitcherStats.era ?? 4.5)) / 2
  const grade    = computeMatchupGrade(avgERA, avgERA)
  const isSelected = selectedGamePk === game.gamePk
  const gameTime = formatCSTTime(game.gameDate)

  return (
    <div>
      <button
        onClick={() => onSelectGame(isSelected ? null : game.gamePk)}
        onMouseEnter={() => setShowDetail(true)}
        onMouseLeave={() => setShowDetail(false)}
        className={`
          w-full text-left rounded-xl border p-3.5 transition-all duration-150 card-shadow
          ${isSelected ? 'border-amber-300 bg-amber-50' : `${gradeBgColor(grade)} hover:shadow-md`}
        `}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TeamLogo teamId={away?.team?.id} abbr={away?.team?.abbreviation} size="md" />
            <TeamBadge abbr={away?.team?.abbreviation} size="xs" />
            <span className="text-xs text-slate-400">@</span>
            <TeamLogo teamId={home?.team?.id} abbr={home?.team?.abbreviation} size="md" />
            <TeamBadge abbr={home?.team?.abbreviation} size="xs" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">{gameTime}</span>
            <span
              className={`text-2xl font-bold leading-none ${gradeColor(grade)}`}
              style={{ fontFamily: "'Bebas Neue', sans-serif" }}
            >
              {grade}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white/70 rounded-lg p-2">
            <div className="text-[9px] text-slate-400 uppercase tracking-wide mb-1">
              {away?.team?.abbreviation} Starter
            </div>
            {awayPitcher ? (
              <>
                <div className="text-xs font-medium text-slate-700 truncate mb-1.5">{awayPitcher.fullName}</div>
                <div className="flex gap-3">
                  <StatPill label="ERA"  value={fmtERA(awayPitcherStats.era)} />
                  <StatPill label="K/9"  value={awayPitcherStats.kPer9?.toFixed(1) || '--'} />
                  <StatPill label="WHIP" value={awayPitcherStats.whip?.toFixed(2) || '--'} />
                </div>
              </>
            ) : <div className="text-xs text-slate-400 italic">TBD</div>}
          </div>

          <div className="bg-white/70 rounded-lg p-2">
            <div className="text-[9px] text-slate-400 uppercase tracking-wide mb-1">
              {home?.team?.abbreviation} Starter
            </div>
            {homePitcher ? (
              <>
                <div className="text-xs font-medium text-slate-700 truncate mb-1.5">{homePitcher.fullName}</div>
                <div className="flex gap-3">
                  <StatPill label="ERA"  value={fmtERA(homePitcherStats.era)} />
                  <StatPill label="K/9"  value={homePitcherStats.kPer9?.toFixed(1) || '--'} />
                  <StatPill label="WHIP" value={homePitcherStats.whip?.toFixed(2) || '--'} />
                </div>
              </>
            ) : <div className="text-xs text-slate-400 italic">TBD</div>}
          </div>
        </div>
      </button>

      {/* Expanded detail on hover — show composite breakdown */}
      {(showDetail || isSelected) && (
        <MatchupDetailPanel
          game={game}
          batterId={null}
          batterLast7={0}
          playerName={null}
        />
      )}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function MatchupGrades({ games, loading, selectedGamePk, onSelectGame }) {
  const [expandedPk, setExpandedPk] = useState(null)
  const displayGames = selectedGamePk ? games.filter((g) => g.gamePk === selectedGamePk) : games

  return (
    <section aria-label="Matchup Grades" className="mt-5">
      <div className="flex items-center justify-between mb-3">
        <h2
          className="text-lg text-slate-900 tracking-wider"
          style={{ fontFamily: "'Bebas Neue', sans-serif" }}
        >
          ⚡ Matchup Grades
        </h2>
        <div className="flex items-center gap-1 text-xs font-bold">
          <span className={gradeColor('A')}>A</span>
          <span className={gradeColor('B')}>B</span>
          <span className={gradeColor('C')}>C</span>
          <span className={gradeColor('D')}>D</span>
          <span className={`text-xs font-bold ${gradeColor('F')}`}>F</span>
        </div>
      </div>

      {/* Mobile: horizontal chip strip with expandable drawer */}
      <div className="lg:hidden">
        {loading ? (
          <div className="flex gap-2 overflow-x-auto score-scroll pb-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-28 h-9 rounded-xl skeleton" />
            ))}
          </div>
        ) : (
          <>
            <div className="flex gap-2 overflow-x-auto score-scroll pb-1">
              {displayGames.map((game) => (
                <MatchupChipMobile
                  key={game.gamePk}
                  game={game}
                  isExpanded={expandedPk === game.gamePk}
                  onToggle={() => setExpandedPk(expandedPk === game.gamePk ? null : game.gamePk)}
                />
              ))}
            </div>
            {expandedPk && (() => {
              const g = displayGames.find((g) => g.gamePk === expandedPk)
              return g ? (
                <MatchupDetailPanel
                  game={g}
                  batterId={null}
                  batterLast7={0}
                  playerName={null}
                />
              ) : null
            })()}
          </>
        )}
      </div>

      {/* Desktop: vertical stack of full cards */}
      <div className="hidden lg:block space-y-3">
        {loading && Array.from({ length: 3 }).map((_, i) => <SkeletonMatchupCard key={i} />)}
        {!loading && displayGames.map((game) => (
          <MatchupCardDesktop
            key={game.gamePk}
            game={game}
            selectedGamePk={selectedGamePk}
            onSelectGame={onSelectGame}
          />
        ))}
      </div>
    </section>
  )
}
