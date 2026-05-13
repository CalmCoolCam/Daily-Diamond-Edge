'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import Sparkline from '../ui/Sparkline'
import HeatDot from '../ui/HeatDot'
import TeamBadge from '../ui/TeamBadge'
import TeamLogo from '../ui/TeamLogo'
import StarButton from '../StarButton'
import PlayerHeadshot from '../ui/PlayerHeadshot'
import { SkeletonTableRow } from '../ui/Skeleton'
import ErrorState from '../ui/ErrorState'
import {
  gradeColor, gradeColorHex, computeBatterMatchupScore, scoreToGrade, currentSeason,
} from '@/lib/mlbApi'
import { usePicks } from '@/hooks/usePicks'
import { debounce } from '@/lib/utils'
import { getCached, setCached } from '@/lib/storage'

// ── Cache helpers (module-level, day-scoped) ──────────────────────────────────

const matchupMemCache = {}
const eraPlusMemCache = {}
const splitsMemCache  = {}

function todayKey() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
}

function matchupCacheKey(batterId, pitcherId) {
  return `matchup_${batterId}_${pitcherId}_${todayKey()}`
}

async function fetchMatchupDetail(batterId, pitcherId, season) {
  const key = matchupCacheKey(batterId, pitcherId)
  if (matchupMemCache[key]) return matchupMemCache[key]
  const lsCached = getCached(key)
  if (lsCached) { matchupMemCache[key] = lsCached; return lsCached }
  const res = await fetch(`/api/mlb/matchup?batterId=${batterId}&pitcherId=${pitcherId}&season=${season}`)
  if (!res.ok) throw new Error(`Matchup fetch failed: ${res.status}`)
  const data = await res.json()
  setCached(key, data, 20 * 60 * 60 * 1000)
  matchupMemCache[key] = data
  return data
}

// ERA+ per pitcher — cached full day in localStorage
async function fetchERAPlus(pitcherId, era) {
  const key = `dde_eraplus_${pitcherId}_${todayKey()}`
  if (eraPlusMemCache[key] !== undefined) return eraPlusMemCache[key]
  const lsCached = getCached(key)
  if (lsCached !== null && lsCached !== undefined) {
    eraPlusMemCache[key] = lsCached
    return lsCached
  }
  // Compute from the ERA already passed (from game data), or fetch from API
  let eraVal = era
  if (eraVal == null) {
    try {
      const res = await fetch(`/api/mlb/player/${pitcherId}/stats?group=pitching`)
      if (res.ok) {
        const data = await res.json()
        const stat = data?.stats?.[0]?.splits?.[0]?.stat || {}
        eraVal = stat.era != null ? parseFloat(stat.era) : null
      }
    } catch { /* fall through */ }
  }
  const LEAGUE_AVG_ERA = 4.00
  const eraPlusVal = eraVal && eraVal > 0 ? Math.round(100 * LEAGUE_AVG_ERA / eraVal) : null
  setCached(key, eraPlusVal, 24 * 60 * 60 * 1000)
  eraPlusMemCache[key] = eraPlusVal
  return eraPlusVal
}

// Batter handedness splits — cached full day in localStorage
async function fetchHandednessSplits(batterId, pitcherThrows, season) {
  const sitCode = pitcherThrows === 'L' ? 'vl' : 'vr'
  const key = `dde_splits_${batterId}_${todayKey()}`
  if (splitsMemCache[key] !== undefined) return splitsMemCache[key]
  const lsCached = getCached(key)
  if (lsCached !== null && lsCached !== undefined) {
    splitsMemCache[key] = lsCached
    return lsCached
  }
  try {
    const res = await fetch(`/api/mlb/player/${batterId}/stats?group=hitting&sitCodes=${sitCode}&season=${season}`)
    if (!res.ok) throw new Error('splits fetch failed')
    const data = await res.json()
    const stat = data?.stats?.[0]?.splits?.[0]?.stat || {}
    const ops  = stat.ops != null ? parseFloat(stat.ops) : null
    setCached(key, ops, 24 * 60 * 60 * 1000)
    splitsMemCache[key] = ops
    return ops
  } catch {
    splitsMemCache[key] = null
    return null
  }
}

function extractPitcherStatsFromGame(statsData) {
  const stat = statsData?.stats?.[0]?.splits?.[0]?.stat || {}
  return {
    era:   stat.era               != null ? parseFloat(stat.era)               : null,
    kPer9: stat.strikeoutsPer9Inn != null ? parseFloat(stat.strikeoutsPer9Inn) : null,
    whip:  stat.whip              != null ? parseFloat(stat.whip)              : null,
  }
}

function ComponentBar({ label, weight, score, missing = false, comingSoon = false }) {
  const pct   = (missing || comingSoon) ? 50 : Math.round(score ?? 0)
  const color = comingSoon ? '#94a3b8' : pct >= 75 ? '#16a34a' : pct >= 40 ? '#f59e0b' : '#dc2626'
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-slate-500 truncate pr-1">{label}</span>
        <span className="text-slate-400 font-mono flex-shrink-0">
          {weight}% · {comingSoon ? 'Coming Soon' : missing ? 'N/A' : `${pct}/100`}
        </span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: comingSoon ? '50%' : `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

function buildBatterSummary(grade, components, vsPlayer, last7Total, fgBatterData, fgPitcherData) {
  const desc = { A: 'Strong matchup', B: 'Favorable matchup', C: 'Average matchup', D: 'Tough matchup', F: 'Very tough matchup' }
  // Find top 2 scoring components and bottom 1
  const scored = Object.entries(components)
    .filter(([k, v]) => v?.score != null && k !== 'pitchMix')
    .map(([k, v]) => ({ key: k, score: v.score }))
    .sort((a, b) => b.score - a.score)
  const top2   = scored.slice(0, 2)
  const bottom = scored[scored.length - 1]

  const parts = [desc[grade] || 'Matchup data']

  for (const { key, score } of top2) {
    if (key === 'starterSIERA' && fgPitcherData?.siera != null)
      parts.push(`hittable starter (${parseFloat(fgPitcherData.siera).toFixed(2)} SIERA)`)
    else if (key === 'starterXFIP' && fgPitcherData?.xfip != null)
      parts.push(`favorable vs starter (${parseFloat(fgPitcherData.xfip).toFixed(2)} xFIP)`)
    else if (key === 'batterForm' && last7Total > 0)
      parts.push(`${last7Total} H+R+RBI over last 7 days`)
    else if (key === 'batterWRC' && fgBatterData?.wrc_plus != null)
      parts.push(`elite bat (${Math.round(parseFloat(fgBatterData.wrc_plus))} wRC+)`)
    else if (key === 'h2h' && vsPlayer?.sufficient && vsPlayer.ab >= 5)
      parts.push(`${vsPlayer.h} for ${vsPlayer.ab} career vs starter`)
  }

  if (bottom && bottom.score < 30) {
    if (bottom.key === 'starterSIERA' && fgPitcherData?.siera != null)
      parts.push(`tough starter (${parseFloat(fgPitcherData.siera).toFixed(2)} SIERA)`)
    else if (bottom.key === 'starterXFIP' && fgPitcherData?.xfip != null)
      parts.push(`elite starter (${parseFloat(fgPitcherData.xfip).toFixed(2)} xFIP)`)
  }

  return parts.length > 1 ? `${parts[0]} — ${parts.slice(1).join(', ')}.` : `${parts[0]}.`
}

// ── Player expanded dropdown ──────────────────────────────────────────────────

function PlayerDropdown({ player, games, fgBatters, fgPitchers }) {
  const [detail, setDetail]           = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [eraPlusVal, setEraPlusVal]   = useState(null)
  const [splitOPS, setSplitOPS]       = useState(null)
  const season = currentSeason()

  const game = games?.find((g) => g.gamePk === player.gamePk)
  const pitcher = player.isHome
    ? game?.teams?.away?.probablePitcher
    : game?.teams?.home?.probablePitcher
  const pitcherStats = player.isHome
    ? extractPitcherStatsFromGame(game?.awayPitcherStats)
    : extractPitcherStatsFromGame(game?.homePitcherStats)
  const pitcherId   = pitcher?.id
  const pitcherEra  = pitcherStats?.era  // already fetched inline from game data

  const fgBatterData  = fgBatters?.[player.name]  || null
  const fgPitcherData = pitcher?.fullName ? (fgPitchers?.[pitcher.fullName] || null) : null

  const bullpenERA = player.isHome
    ? parseFloat(game?.teams?.away?.team?.bullpenERA) || 4.5
    : parseFloat(game?.teams?.home?.team?.bullpenERA) || 4.5

  // Lazy: fetch H2H, ERA+, and handedness splits when dropdown opens
  useEffect(() => {
    if (!pitcherId || !player.id) return
    let cancelled = false

    // H2H detail
    if (!detail) {
      setDetailLoading(true)
      fetchMatchupDetail(player.id, pitcherId, season)
        .then((d) => { if (!cancelled) setDetail(d) })
        .catch(() => {})
        .finally(() => { if (!cancelled) setDetailLoading(false) })
    }

    // ERA+ (use pitcher ERA from game data to avoid extra API call)
    fetchERAPlus(pitcherId, pitcherEra)
      .then((v) => { if (!cancelled) setEraPlusVal(v) })
      .catch(() => {})

    // Handedness splits
    const pitcherThrows = pitcher?.pitchHand?.code || 'R'
    fetchHandednessSplits(player.id, pitcherThrows, season)
      .then((v) => { if (!cancelled) setSplitOPS(v) })
      .catch(() => {})

    return () => { cancelled = true }
  }, [pitcherId, player.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const vsPlayer = detail?.vsPlayer || null

  // 10-component batter grade
  const { score, components } = computeBatterMatchupScore({
    starterSIERA:   fgPitcherData?.siera != null ? parseFloat(fgPitcherData.siera) : null,
    starterXFIP:    fgPitcherData?.xfip  != null ? parseFloat(fgPitcherData.xfip)  : null,
    starterERAplus: eraPlusVal,
    vsPlayer,
    batterSplitOPS: splitOPS,
    batterForm:     player.last7Total || 0,
    batterWRC:      fgBatterData?.wrc_plus != null ? parseFloat(fgBatterData.wrc_plus) : null,
    batterBABIP:    fgBatterData?.babip    != null ? parseFloat(fgBatterData.babip)    : null,
    bullpenERA,
  })

  const grade   = scoreToGrade(score, [])
  const summary = buildBatterSummary(grade, components, vsPlayer, player.last7Total || 0, fgBatterData, fgPitcherData)
  const h2hSufficient = vsPlayer?.sufficient === true && (vsPlayer?.ab || 0) >= 5

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-1">
      {/* Left: headshot + identity */}
      <div className="flex items-start gap-3">
        <PlayerHeadshot personId={player.id} name={player.name} teamAbbr={player.teamAbbr} height={80} className="flex-shrink-0" />
        <div className="min-w-0">
          <div className="font-bold text-sm text-slate-900 leading-tight">{player.name}</div>
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            <TeamLogo teamId={player.teamId} abbr={player.teamAbbr} size="sm" />
            <span className="text-xs text-slate-500 font-mono">{player.teamAbbr}</span>
            <span className="text-xs text-slate-400">· {player.position}</span>
          </div>
          {pitcher && (
            <div className="text-[10px] text-slate-400 mt-1">vs <span className="font-medium">{pitcher.fullName}</span></div>
          )}
          <div className="flex flex-wrap gap-3 mt-2 text-xs">
            <span className="text-slate-400">7-Day: <span className="font-bold text-amber-500">{player.last7Total ?? 0}</span></span>
            <span className="text-slate-400">Season: <span className="font-medium text-slate-600">{player.seasonH}H / {player.seasonR}R / {player.seasonRBI}RBI</span></span>
            {fgBatterData?.wrc_plus != null && (
              <span className="text-slate-400">wRC+: <span className="font-bold text-slate-700">{Math.round(parseFloat(fgBatterData.wrc_plus))}</span></span>
            )}
          </div>
        </div>
      </div>

      {/* Right: grade letter + 10-component breakdown */}
      <div>
        <div className="flex items-center gap-3 mb-2.5">
          <span className="text-4xl font-black leading-none flex-shrink-0"
            style={{ fontFamily: "'Bebas Neue', sans-serif", color: gradeColorHex(grade) }}>
            {grade}
          </span>
          <p className="text-[11px] text-slate-500 italic leading-snug">{summary}</p>
        </div>

        <div className="space-y-1.5">
          <ComponentBar
            label={`Starter SIERA${fgPitcherData?.siera != null ? ` (${parseFloat(fgPitcherData.siera).toFixed(2)})` : ''}`}
            weight={components.starterSIERA?.weight ?? 20}
            score={components.starterSIERA?.score}
            missing={components.starterSIERA?.score == null}
          />
          <ComponentBar
            label={`Starter xFIP${fgPitcherData?.xfip != null ? ` (${parseFloat(fgPitcherData.xfip).toFixed(2)})` : ''}`}
            weight={components.starterXFIP?.weight ?? 20}
            score={components.starterXFIP?.score}
            missing={components.starterXFIP?.score == null}
          />
          <ComponentBar
            label={`Starter ERA+${eraPlusVal != null ? ` (${eraPlusVal})` : ''}`}
            weight={components.starterERAplus?.weight ?? 10}
            score={components.starterERAplus?.score}
            missing={components.starterERAplus?.score == null}
          />
          <ComponentBar
            label={`vs ${pitcher?.fullName?.split(' ').pop() || 'Starter'} (career AVG)`}
            weight={components.h2h?.weight ?? 10}
            score={components.h2h?.score}
            missing={!h2hSufficient && components.h2h?.score == null}
          />
          <ComponentBar
            label={`vs ${pitcher?.pitchHand?.code === 'L' ? 'LHP' : 'RHP'} splits${splitOPS != null ? ` (${splitOPS.toFixed(3)} OPS)` : ''}`}
            weight={components.batterSplitOPS?.weight ?? 10}
            score={components.batterSplitOPS?.score}
            missing={components.batterSplitOPS?.score == null}
          />
          <ComponentBar
            label={`7-day form (${player.last7Total ?? 0} H+R+RBI)`}
            weight={components.batterForm?.weight ?? 10}
            score={components.batterForm?.score}
          />
          <ComponentBar
            label={`Batter wRC+${fgBatterData?.wrc_plus != null ? ` (${Math.round(parseFloat(fgBatterData.wrc_plus))})` : ''}`}
            weight={components.batterWRC?.weight ?? 5}
            score={components.batterWRC?.score}
            missing={components.batterWRC?.score == null}
          />
          <ComponentBar
            label={`Batter BABIP${fgBatterData?.babip != null ? ` (${parseFloat(fgBatterData.babip).toFixed(3)})` : ''}`}
            weight={components.batterBABIP?.weight ?? 5}
            score={components.batterBABIP?.score}
            missing={components.batterBABIP?.score == null}
          />
          <ComponentBar
            label="Bullpen ERA"
            weight={components.bullpenERA?.weight ?? 5}
            score={components.bullpenERA?.score}
          />
          <ComponentBar
            label="Pitch Mix Analysis"
            weight={components.pitchMix?.weight ?? 5}
            score={components.pitchMix?.score}
            comingSoon
          />
        </div>

        {/* H2H career detail */}
        {vsPlayer && (
          <div className="mt-2 text-[10px] text-slate-500 bg-slate-50 rounded-lg px-2 py-1.5">
            <span className="font-semibold">Career vs starter: </span>
            {vsPlayer.sufficient
              ? `${vsPlayer.h} for ${vsPlayer.ab}${vsPlayer.hr > 0 ? `, ${vsPlayer.hr} HR` : ''}${vsPlayer.rbi > 0 ? `, ${vsPlayer.rbi} RBI` : ''} (.${(vsPlayer.h / vsPlayer.ab).toFixed(3).slice(2)})`
              : vsPlayer.ab > 0 ? `${vsPlayer.ab} AB — insufficient sample (<5 AB)`
              : 'No career matchup data'}
          </div>
        )}

        {detailLoading && (
          <div className="mt-2 text-[10px] text-slate-400 animate-pulse">Loading matchup detail…</div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

const SORT_DEFAULTS = { key: 'last7Total', dir: 'desc' }

// Desktop columns (all)
const COLS = [
  { key: 'rank',         label: '#',          sortable: false, w: 'w-8',          align: 'center' },
  { key: 'name',         label: 'Player',     sortable: true,  w: 'min-w-[130px]', align: 'left'  },
  { key: 'teamAbbr',     label: 'Team',       sortable: true,  w: 'w-16',         align: 'center' },
  { key: 'opponentAbbr', label: 'Opp',        sortable: true,  w: 'w-14',         align: 'center' },
  { key: 'matchupGrade', label: 'Grade',      sortable: true,  w: 'w-14',         align: 'center' },
  { key: 'yesterdayHRR', label: 'Yday',       sortable: false, w: 'w-20',         align: 'center' },
  { key: 'last7Total',   label: '7D H+R+RBI', sortable: true,  w: 'w-24',         align: 'center' },
  { key: 'seasonH',      label: 'H',          sortable: true,  w: 'w-12',         align: 'center' },
  { key: 'seasonR',      label: 'R',          sortable: true,  w: 'w-12',         align: 'center' },
  { key: 'seasonRBI',    label: 'RBI',        sortable: true,  w: 'w-12',         align: 'center' },
  { key: 'seasonHR',     label: 'HR',         sortable: true,  w: 'w-12',         align: 'center' },
  { key: 'seasonAVG',    label: 'AVG',        sortable: true,  w: 'w-16',         align: 'center' },
  { key: 'seasonOPS',    label: 'OPS',        sortable: true,  w: 'w-16',         align: 'center' },
  { key: 'seasonTotal',  label: 'S.Total',    sortable: true,  w: 'w-16',         align: 'center' },
  { key: 'trend',        label: 'Trend',      sortable: false, w: 'w-20',         align: 'center' },
  { key: 'heat',         label: '🌡',          sortable: false, w: 'w-10',         align: 'center' },
  { key: 'star',         label: '★',          sortable: false, w: 'w-14',         align: 'center' },
]

// Mobile: only these 5 columns visible
const MOBILE_COLS = new Set(['name', 'matchupGrade', 'last7Total', 'trend', 'star'])

function SortHeader({ col, sortKey, sortDir, onSort, mobile = false }) {
  if (mobile && !MOBILE_COLS.has(col.key)) return null
  const active = sortKey === col.key
  return (
    <th
      className={`
        ${col.w} text-${col.align} px-2 py-2.5 text-[10px] font-semibold uppercase tracking-wider
        whitespace-nowrap select-none bg-slate-50
        ${col.sortable ? 'cursor-pointer hover:text-slate-700' : ''}
        ${active ? 'text-amber-500' : 'text-slate-400'}
        ${!mobile && !MOBILE_COLS.has(col.key) ? 'hidden lg:table-cell' : ''}
      `}
      onClick={col.sortable ? () => onSort(col.key) : undefined}
    >
      {col.label}
      {active && col.sortable && <span className="ml-0.5">{sortDir === 'asc' ? '↑' : '↓'}</span>}
    </th>
  )
}

// Dev-mode debug overlay showing exact field paths used for a player's stats
function DevStatDebug({ player }) {
  if (process.env.NODE_ENV !== 'development') return null
  return (
    <div className="absolute right-0 top-full z-50 bg-yellow-50 border border-yellow-300 rounded-lg p-2 text-[10px] font-mono text-yellow-900 shadow-lg min-w-[280px] pointer-events-none">
      <div className="font-bold mb-1">🔍 Stat field debug</div>
      <div>todayH: liveData.boxscore.teams.{'{side}'}.players.ID{player.id}.stats.batting.hits = <b>{player.todayH}</b></div>
      <div>todayR: ...batting.runs (NOT homeRuns) = <b>{player.todayR}</b></div>
      <div>todayRBI: ...batting.rbi = <b>{player.todayRBI}</b></div>
      <div className="mt-1">last7Total: gameLog splits[0..6].stat.(hits+runs+rbi) summed = <b>{player.last7Total}</b></div>
      <div>seasonH: season.splits[0].stat.hits = <b>{player.seasonH}</b></div>
      <div>seasonR: season.splits[0].stat.runs = <b>{player.seasonR}</b></div>
      <div>seasonRBI: season.splits[0].stat.rbi = <b>{player.seasonRBI}</b></div>
    </div>
  )
}

function PlayerRow({ player, rank, starred, onToggleStar, updatedIds, games, fgBatters, fgPitchers }) {
  const [expanded, setExpanded] = useState(false)
  const [showDebug, setShowDebug] = useState(false)
  const { getCount } = usePicks()
  const pickCount = getCount(player.name, player.teamAbbr)
  const wasUpdated = updatedIds?.has(String(player.id))

  return (
    <>
      <tr
        className={`
          border-b border-slate-100 text-sm transition-colors duration-150 cursor-pointer
          hover:bg-slate-50
          ${starred ? 'starred-row' : ''}
          ${wasUpdated ? 'stat-updated' : ''}
        `}
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Rank — hidden on mobile */}
        <td className="px-2 py-2.5 text-center text-xs text-slate-300 tabular-nums hidden lg:table-cell">
          {rank}
        </td>

        {/* Player name — sticky, includes logo + abbr */}
        <td className="sticky-col px-2 py-2.5 relative" onMouseEnter={() => setShowDebug(true)} onMouseLeave={() => setShowDebug(false)}>
          <div className="flex items-center gap-1.5 min-w-0">
            <TeamLogo teamId={player.teamId} abbr={player.teamAbbr} size="sm" className="flex-shrink-0" />
            <span className="font-bold text-[9px] font-mono flex-shrink-0 text-[var(--accent-blue)]">
              {player.teamAbbr}
            </span>
            <div className="min-w-0">
              <div className="font-medium text-slate-900 text-xs truncate max-w-[110px]" title={player.name}>
                {player.heatTier === 1 ? `${player.name} 🔥` : player.name}
              </div>
              <div className="text-[10px] text-slate-400">{player.position}</div>
            </div>
          </div>
          {showDebug && <DevStatDebug player={player} />}
        </td>

        {/* Team — hidden on mobile (logo already in name cell) */}
        <td className="px-2 py-2.5 text-center hidden lg:table-cell">
          <TeamBadge abbr={player.teamAbbr} size="xs" />
        </td>

        {/* Opponent — hidden on mobile */}
        <td className="px-2 py-2.5 text-center hidden lg:table-cell">
          <span className="text-xs text-slate-400 font-mono">{player.opponentAbbr || '--'}</span>
        </td>

        {/* Matchup Grade */}
        <td className="px-2 py-2.5 text-center">
          <span
            className="text-sm font-bold tabular-nums"
            style={{ color: gradeColorHex(player.matchupGrade) }}
          >
            {player.matchupGrade || '--'}
          </span>
        </td>

        {/* Yesterday — hidden on mobile */}
        <td className="px-2 py-2.5 text-center hidden lg:table-cell">
          <span className="text-xs text-slate-400 font-mono whitespace-nowrap">
            {player.yesterdayH ?? 0}/{player.yesterdayR ?? 0}/{player.yesterdayRBI ?? 0}
          </span>
        </td>

        {/* 7-day total */}
        <td className="px-2 py-2.5 text-center">
          <span className="text-sm font-bold text-amber-500 tabular-nums">{player.last7Total ?? 0}</span>
        </td>

        {/* Season H — hidden on mobile */}
        <td className="px-2 py-2.5 text-center hidden lg:table-cell">
          <span className="text-xs text-slate-600 tabular-nums">{player.seasonH ?? 0}</span>
        </td>
        <td className="px-2 py-2.5 text-center hidden lg:table-cell">
          <span className="text-xs text-slate-600 tabular-nums">{player.seasonR ?? 0}</span>
        </td>
        <td className="px-2 py-2.5 text-center hidden lg:table-cell">
          <span className="text-xs text-slate-600 tabular-nums">{player.seasonRBI ?? 0}</span>
        </td>
        <td className="px-2 py-2.5 text-center hidden lg:table-cell">
          <span className="text-xs text-slate-600 tabular-nums">{player.seasonHR ?? 0}</span>
        </td>
        <td className="px-2 py-2.5 text-center hidden lg:table-cell">
          <span className="text-xs text-slate-500 tabular-nums font-mono">{player.seasonAVG ?? '--'}</span>
        </td>
        <td className="px-2 py-2.5 text-center hidden lg:table-cell">
          <span className="text-xs text-slate-500 tabular-nums font-mono">{player.seasonOPS ?? '--'}</span>
        </td>
        <td className="px-2 py-2.5 text-center hidden lg:table-cell">
          <span className="text-xs font-semibold text-slate-700 tabular-nums">{player.seasonTotal ?? 0}</span>
        </td>

        {/* Sparkline */}
        <td className="px-2 py-2.5 text-center">
          <div className="flex justify-center">
            <Sparkline data={player.sparkline || []} heatTier={player.heatTier} width={56} height={18} />
          </div>
        </td>

        {/* Heat — hidden on mobile */}
        <td className="px-2 py-2.5 text-center hidden lg:table-cell">
          <div className="flex justify-center">
            <HeatDot heatTier={player.heatTier} />
          </div>
        </td>

        {/* Star */}
        <td className="px-2 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
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

      {/* Expanded dropdown — headshot + grade breakdown, shown on all screen sizes */}
      {expanded && (
        <tr className="border-b border-slate-100 bg-slate-50/80 filter-drawer">
          <td colSpan={COLS.length} className="px-4 py-4">
            <PlayerDropdown player={player} games={games} fgBatters={fgBatters} fgPitchers={fgPitchers} />
          </td>
        </tr>
      )}
    </>
  )
}

export default function PlayerTable({ players, loading, error, onRetry, stars, onToggleStar, selectedGamePk, updatedIds, games, fgBatters, fgPitchers }) {
  const [sort, setSort] = useState(SORT_DEFAULTS)
  const [search, setSearch] = useState('')
  const [filterTeam, setFilterTeam] = useState('')
  const [filterOpp, setFilterOpp] = useState('')
  const [filterStarred, setFilterStarred] = useState(false)
  const [filterSide, setFilterSide] = useState('')
  const [filterDayNight, setFilterDayNight] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)

  const debouncedSearch = useCallback(debounce((v) => setSearch(v), 180), [])

  const teams = useMemo(() => Array.from(new Set(players.map((p) => p.teamAbbr).filter(Boolean))).sort(), [players])
  const opponents = useMemo(() => Array.from(new Set(players.map((p) => p.opponentAbbr).filter(Boolean))).sort(), [players])

  const sorted = useMemo(() => {
    let list = [...players]
    if (selectedGamePk) list = list.filter((p) => p.gamePk === selectedGamePk)
    if (search) list = list.filter((p) => p.name?.toLowerCase().includes(search.toLowerCase()))
    if (filterTeam) list = list.filter((p) => p.teamAbbr === filterTeam)
    if (filterOpp) list = list.filter((p) => p.opponentAbbr === filterOpp)
    if (filterStarred) list = list.filter((p) => stars.includes(String(p.id)))
    if (filterSide === 'home') list = list.filter((p) => p.isHome)
    if (filterSide === 'away') list = list.filter((p) => !p.isHome)

    if (filterDayNight && games?.length) {
      const gameTimeMap = {}
      games.forEach((g) => {
        const h = parseInt(new Date(g.gameDate || '').toLocaleString('en-US', {
          timeZone: 'America/Chicago', hour: 'numeric', hour12: false,
        }), 10)
        gameTimeMap[g.gamePk] = h
      })
      list = list.filter((p) => {
        const h = gameTimeMap[p.gamePk]
        if (h == null) return true
        return filterDayNight === 'day' ? h < 17 : h >= 17
      })
    }

    list.sort((a, b) => {
      let av = a[sort.key] ?? 0
      let bv = b[sort.key] ?? 0
      if (typeof av === 'string') av = av.toLowerCase()
      if (typeof bv === 'string') bv = bv.toLowerCase()
      if (av < bv) return sort.dir === 'asc' ? -1 : 1
      if (av > bv) return sort.dir === 'asc' ? 1 : -1
      return 0
    })
    return list
  }, [players, sort, search, filterTeam, filterOpp, filterStarred, filterSide, filterDayNight, selectedGamePk, stars, games])

  function handleSort(key) {
    setSort((prev) => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' })
  }

  const hasActiveFilters = filterTeam || filterOpp || filterStarred || filterSide || filterDayNight

  return (
    <section aria-label="Player Table" className="flex flex-col">
      {/* Filter bar */}
      <div className="mb-3 space-y-2">
        {/* Search + filter toggle */}
        <div className="flex gap-2">
          <input
            type="search"
            placeholder="Search player…"
            className="form-input-light flex-1"
            onChange={(e) => debouncedSearch(e.target.value)}
            aria-label="Search players"
          />
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors min-h-[36px]
              ${hasActiveFilters || filtersOpen
                ? 'bg-amber-50 border-amber-300 text-amber-600'
                : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
              }
            `}
            aria-expanded={filtersOpen}
          >
            ⚙ <span className="hidden sm:inline">Filter</span>
            {hasActiveFilters && <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />}
          </button>
        </div>

        {/* Filter drawer */}
        {filtersOpen && (
          <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2 card-shadow filter-drawer">
            <div className="flex flex-wrap gap-2">
              <select className="form-input-light flex-1 min-w-[90px]" value={filterTeam} onChange={(e) => setFilterTeam(e.target.value)}>
                <option value="">All Teams</option>
                {teams.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select className="form-input-light flex-1 min-w-[90px]" value={filterOpp} onChange={(e) => setFilterOpp(e.target.value)}>
                <option value="">All Opps</option>
                {opponents.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="flex flex-wrap gap-2">
              {/* Home/Away */}
              <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                {['', 'home', 'away'].map((v) => (
                  <button key={v} onClick={() => setFilterSide(v)}
                    className={`px-3 py-1.5 text-xs min-h-[36px] transition-colors ${filterSide === v ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
                    {v === '' ? 'All' : v === 'home' ? 'Home' : 'Away'}
                  </button>
                ))}
              </div>

              {/* Day/Night */}
              <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                {['', 'day', 'night'].map((v) => (
                  <button key={v} onClick={() => setFilterDayNight(v)}
                    className={`px-3 py-1.5 text-xs min-h-[36px] transition-colors ${filterDayNight === v ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
                    {v === '' ? 'All' : v === 'day' ? '☀' : '🌙'}
                  </button>
                ))}
              </div>

              {/* Starred */}
              <button onClick={() => setFilterStarred((v) => !v)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs min-h-[36px] transition-colors ${
                  filterStarred ? 'bg-amber-50 border-amber-300 text-amber-600' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}>
                ★ Starred ({stars.length})
              </button>

              {hasActiveFilters && (
                <button onClick={() => { setFilterTeam(''); setFilterOpp(''); setFilterStarred(false); setFilterSide(''); setFilterDayNight('') }}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-600 underline min-h-[36px]">
                  Clear all
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mb-1.5 px-0.5">
        <span className="text-xs text-slate-400">{sorted.length} players</span>
        {sort.key !== SORT_DEFAULTS.key && (
          <button className="text-xs text-slate-400 hover:text-slate-600 underline" onClick={() => setSort(SORT_DEFAULTS)}>
            Reset sort
          </button>
        )}
      </div>

      {error && <ErrorState message={error} onRetry={onRetry} compact />}

      <div className="table-scroll-wrapper bg-white rounded-xl border border-slate-200 card-shadow overflow-hidden">
        <table className="w-full border-collapse">
          <thead className="border-b border-slate-200">
            <tr>
              {COLS.map((col) => (
                <SortHeader key={col.key} col={col} sortKey={sort.key} sortDir={sort.dir} onSort={handleSort} />
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && !players.length && (
              Array.from({ length: 12 }).map((_, i) => <SkeletonTableRow key={i} cols={COLS.length} />)
            )}
            {!loading && sorted.length === 0 && (
              <tr>
                <td colSpan={COLS.length} className="text-center py-12 text-slate-400 text-sm">
                  {players.length === 0 ? 'Waiting for player data…' : 'No players match filters'}
                </td>
              </tr>
            )}
            {sorted.map((player, i) => (
              <PlayerRow
                key={player.id}
                player={player}
                rank={i + 1}
                starred={stars.includes(String(player.id))}
                onToggleStar={onToggleStar}
                updatedIds={updatedIds}
                games={games}
                fgBatters={fgBatters}
                fgPitchers={fgPitchers}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
