'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import TeamLogo from '../ui/TeamLogo'
import TeamBadge from '../ui/TeamBadge'
import StarButton from '../StarButton'
import PlayerHeadshot from '../ui/PlayerHeadshot'
import { SkeletonTableRow } from '../ui/Skeleton'
import ErrorState from '../ui/ErrorState'
import {
  gradeColorHex,
  scoreToGrade,
  currentSeason,
  computePitcherMatchupScore,
} from '@/lib/mlbApi'
import { getFanGraphsPitchers, getTeamWrcAverages } from '@/lib/fangraphsData'
import { usePicks } from '@/hooks/usePicks'
import { debounce } from '@/lib/utils'
import { getCached, setCached } from '@/lib/storage'

// ── ERA-trend sparkline for pitchers (based on last 3 starts ERA) ─────────────

function PitcherSparkline({ last3, width = 56, height = 18 }) {
  const eras = last3
    .map((s) => (s.era != null ? parseFloat(s.era) : null))
    .reverse()  // oldest first

  const valid = eras.filter((v) => v != null)
  if (valid.length < 2) {
    return (
      <svg width={width} height={height} aria-hidden="true" className="opacity-30">
        <line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke="#94a3b8" strokeWidth={1} strokeDasharray="3,2" />
      </svg>
    )
  }

  // Improving (ERA falling left → right) = green; worsening = red
  const trend = eras[eras.length - 1] < eras[0] ? '#16a34a' : '#dc2626'
  const pad = 2
  const max = Math.max(...valid, 0.1)
  const min = Math.min(...valid)
  const range = max - min || 1

  const pts = eras.map((v, i) => {
    const x = pad + (i / (eras.length - 1)) * (width - pad * 2)
    // Invert: lower ERA (better) = higher on chart
    const y = pad + ((v - min) / range) * (height - pad * 2)
    return [x, y]
  })
  const linePath = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const lastPt = pts[pts.length - 1]

  return (
    <svg width={width} height={height} aria-hidden="true">
      <path d={linePath} fill="none" stroke={trend} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastPt[0].toFixed(1)} cy={lastPt[1].toFixed(1)} r={2} fill={trend} />
    </svg>
  )
}

// ── Component bar for grade breakdown ─────────────────────────────────────────

function ComponentBar({ label, weight, score, missing = false }) {
  const pct   = missing ? 0 : Math.round(score ?? 0)
  const color = pct >= 60 ? '#16a34a' : pct >= 40 ? '#f59e0b' : '#dc2626'
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-slate-500 truncate pr-1">{label}</span>
        <span className="text-slate-400 font-mono flex-shrink-0">{weight}% · {missing ? 'N/A' : `${pct}/100`}</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

// ── Pitcher-batch cache (module-level, 1 hour TTL) ────────────────────────────

const pitcherStatsCache = {}
const PITCHER_CACHE_TTL = 60 * 60 * 1000  // 1 hour

async function fetchPitcherBatch(ids, season) {
  const key = `pitcher_batch_${season}_${ids.slice(0, 5).join('-')}`
  if (pitcherStatsCache[key]) return pitcherStatsCache[key]

  const lsCached = getCached(key)
  if (lsCached) { pitcherStatsCache[key] = lsCached; return lsCached }

  const res = await fetch(`/api/mlb/players/pitcher-batch?ids=${ids.join(',')}&season=${season}`)
  if (!res.ok) throw new Error(`Pitcher batch fetch failed: ${res.status}`)
  const data = await res.json()

  setCached(key, data, PITCHER_CACHE_TTL)
  pitcherStatsCache[key] = data
  return data
}

// ── Plain-English pitcher summary ─────────────────────────────────────────────

function buildPitcherSummary(grade, components, fgData) {
  const xfip = fgData?.xfip != null ? parseFloat(fgData.xfip).toFixed(2) : null
  const oppWRCScore = components.opposingWRC?.score

  if (grade === 'A') {
    const parts = ['Strong start']
    if (xfip) parts.push(`elite xFIP (${xfip})`)
    if (oppWRCScore != null && oppWRCScore > 60) parts.push('facing a below-average lineup')
    return parts.length > 1 ? `${parts[0]} — ${parts.slice(1).join(', ')}.` : `${parts[0]}.`
  }
  if (grade === 'B') {
    return xfip ? `Favorable start — solid xFIP (${xfip}) with a manageable matchup.` : 'Favorable start — solid pitcher metrics.'
  }
  if (grade === 'C') {
    return 'Average matchup — neither significantly favoring pitcher nor hitter.'
  }
  if (grade === 'D') {
    const parts = ['Tough start']
    if (xfip && parseFloat(xfip) > 4.5) parts.push(`elevated xFIP (${xfip})`)
    if (oppWRCScore != null && oppWRCScore < 40) parts.push('strong opposing lineup')
    return parts.length > 1 ? `${parts[0]} — ${parts.slice(1).join(', ')}.` : `${parts[0]}.`
  }
  if (grade === 'F') {
    return 'Avoid — pitcher struggles and/or very tough lineup matchup.'
  }
  return 'Grade data unavailable.'
}

// ── Pitcher expanded dropdown ─────────────────────────────────────────────────

function PitcherDropdown({ pitcher }) {
  const { fgData, last3, last3Avg, opposingTeamAbbr } = pitcher
  const [teamWrc, setTeamWrc] = useState(null)

  useEffect(() => {
    getTeamWrcAverages().then((wrcMap) => {
      if (opposingTeamAbbr && wrcMap[opposingTeamAbbr]) setTeamWrc(wrcMap[opposingTeamAbbr])
    })
  }, [opposingTeamAbbr])

  const kPct = fgData?.k_pct != null ? parseFloat(fgData.k_pct) : null
  const bbPct = fgData?.bb_pct != null ? parseFloat(fgData.bb_pct) : null

  const { score, components } = computePitcherMatchupScore({
    pitcherXFIP:    fgData?.xfip  != null ? parseFloat(fgData.xfip)  : null,
    pitcherSIERA:   fgData?.siera != null ? parseFloat(fgData.siera) : null,
    opposingWRC:    teamWrc?.wrc_plus != null ? parseFloat(teamWrc.wrc_plus) : null,
    pitcherKPct:    kPct,
    pitcherBBPct:   bbPct,
    last3StartsAvg: last3Avg,
    opposingHardPct: teamWrc?.hard_pct != null ? parseFloat(teamWrc.hard_pct) : null,
  })

  const grade   = scoreToGrade(score, [pitcher.matchupScore != null ? pitcher.matchupScore : score])
  const summary = buildPitcherSummary(grade, components, fgData)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-1">
      {/* Left: headshot + identity */}
      <div className="flex items-start gap-3">
        <PlayerHeadshot personId={pitcher.id} name={pitcher.name} teamAbbr={pitcher.teamAbbr} height={80} className="flex-shrink-0" />
        <div className="min-w-0">
          <div className="font-bold text-sm text-slate-900 leading-tight">{pitcher.name}</div>
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            <TeamLogo teamId={pitcher.teamId} abbr={pitcher.teamAbbr} size="sm" />
            <span className="text-xs text-slate-500 font-mono">{pitcher.teamAbbr}</span>
            <span className="text-xs text-slate-400">· {pitcher.throws ?? 'R'}</span>
          </div>
          {opposingTeamAbbr && (
            <div className="text-[10px] text-slate-400 mt-1">vs <span className="font-medium">{opposingTeamAbbr}</span></div>
          )}
          <div className="flex flex-wrap gap-3 mt-2 text-xs">
            {fgData?.xfip  != null && <span className="text-slate-400">xFIP: <span className="font-bold text-slate-700">{parseFloat(fgData.xfip).toFixed(2)}</span></span>}
            {fgData?.siera != null && <span className="text-slate-400">SIERA: <span className="font-bold text-slate-700">{parseFloat(fgData.siera).toFixed(2)}</span></span>}
            {kPct != null && <span className="text-slate-400">K%: <span className="font-bold text-slate-700">{kPct.toFixed(1)}%</span></span>}
          </div>
        </div>
      </div>

      {/* Right: grade + breakdown */}
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
            label={`Pitcher xFIP${fgData?.xfip != null ? ` (${parseFloat(fgData.xfip).toFixed(2)})` : ''}`}
            weight={components.pitcherXFIP?.weight ?? 25}
            score={components.pitcherXFIP?.score}
            missing={components.pitcherXFIP?.score == null}
          />
          <ComponentBar
            label={`Pitcher SIERA${fgData?.siera != null ? ` (${parseFloat(fgData.siera).toFixed(2)})` : ''}`}
            weight={components.pitcherSIERA?.weight ?? 20}
            score={components.pitcherSIERA?.score}
            missing={components.pitcherSIERA?.score == null}
          />
          <ComponentBar
            label={`Opp lineup wRC+${teamWrc?.wrc_plus != null ? ` (${parseFloat(teamWrc.wrc_plus).toFixed(0)})` : ''}`}
            weight={components.opposingWRC?.weight ?? 20}
            score={components.opposingWRC?.score}
            missing={components.opposingWRC?.score == null}
          />
          <ComponentBar
            label={`K%−BB%${kPct != null && bbPct != null ? ` (${(kPct - bbPct).toFixed(1)}%)` : ''}`}
            weight={components.kMinusBB?.weight ?? 15}
            score={components.kMinusBB?.score}
            missing={components.kMinusBB?.score == null}
          />
          <ComponentBar
            label={`Last 3 starts${last3Avg ? ` (${last3Avg.era?.toFixed(2)} ERA)` : ''}`}
            weight={components.last3?.weight ?? 15}
            score={components.last3?.score}
            missing={components.last3?.score == null}
          />
          <ComponentBar
            label={`Opp Hard%${teamWrc?.hard_pct != null ? ` (${parseFloat(teamWrc.hard_pct).toFixed(1)}%)` : ''}`}
            weight={components.opposingHard?.weight ?? 5}
            score={components.opposingHard?.score}
            missing={components.opposingHard?.score == null}
          />
        </div>

        {/* Last 3 starts table */}
        {last3?.length > 0 && (
          <div className="mt-3 bg-slate-50 rounded-lg p-2 border border-slate-100">
            <div className="text-[9px] text-slate-400 uppercase tracking-wide mb-1.5">Last 3 Starts</div>
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
                {last3.map((s, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="py-0.5 text-slate-600 font-mono">{s.date?.slice(5) || '--'}</td>
                    <td className="py-0.5 text-center text-slate-500">{s.opponent}</td>
                    <td className="py-0.5 text-center font-mono text-slate-600">{s.ip}</td>
                    <td className="py-0.5 text-center font-mono text-slate-600">{s.er ?? '--'}</td>
                    <td className="py-0.5 text-center font-mono text-slate-600">{s.k ?? '--'}</td>
                    <td className="py-0.5 text-center font-mono text-slate-600">{s.era ? parseFloat(s.era).toFixed(2) : '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Pitcher row ───────────────────────────────────────────────────────────────

function PitcherRow({ pitcher, rank, starred, onToggleStar, allScores }) {
  const [expanded, setExpanded] = useState(false)
  const { getCount } = usePicks()
  const pickCount = getCount(pitcher.name, pitcher.teamAbbr)

  const grade = pitcher.matchupGrade

  return (
    <>
      <tr
        className={`border-b border-slate-100 text-sm transition-colors duration-150 cursor-pointer hover:bg-slate-50 ${starred ? 'starred-row' : ''}`}
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Rank */}
        <td className="px-2 py-2.5 text-center text-xs text-slate-300 tabular-nums hidden lg:table-cell">{rank}</td>

        {/* Pitcher name — sticky */}
        <td className="sticky-col px-2 py-2.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <TeamLogo teamId={pitcher.teamId} abbr={pitcher.teamAbbr} size="sm" className="flex-shrink-0" />
            <span className="font-bold text-[9px] font-mono flex-shrink-0 text-[var(--accent-blue)]">{pitcher.teamAbbr}</span>
            <div className="min-w-0">
              <div className="font-medium text-slate-900 text-xs truncate max-w-[110px]" title={pitcher.name}>{pitcher.name}</div>
              <div className="text-[10px] text-slate-400">P</div>
            </div>
          </div>
        </td>

        {/* Throws */}
        <td className="px-2 py-2.5 text-center hidden lg:table-cell">
          <span className="text-xs text-slate-500 font-mono">{pitcher.throws || '--'}</span>
        </td>

        {/* Today's Matchup Grade */}
        <td className="px-2 py-2.5 text-center">
          <span className="text-sm font-bold tabular-nums" style={{ color: gradeColorHex(grade) }}>
            {grade || '--'}
          </span>
        </td>

        {/* xFIP */}
        <td className="px-2 py-2.5 text-center hidden lg:table-cell">
          <span className="text-xs text-slate-600 tabular-nums font-mono">
            {pitcher.fgData?.xfip != null ? parseFloat(pitcher.fgData.xfip).toFixed(2) : '--'}
          </span>
        </td>

        {/* SIERA */}
        <td className="px-2 py-2.5 text-center hidden lg:table-cell">
          <span className="text-xs text-slate-600 tabular-nums font-mono">
            {pitcher.fgData?.siera != null ? parseFloat(pitcher.fgData.siera).toFixed(2) : '--'}
          </span>
        </td>

        {/* K% */}
        <td className="px-2 py-2.5 text-center hidden lg:table-cell">
          <span className="text-xs text-slate-600 tabular-nums">
            {pitcher.fgData?.k_pct != null ? `${parseFloat(pitcher.fgData.k_pct).toFixed(1)}%` : '--'}
          </span>
        </td>

        {/* BB% */}
        <td className="px-2 py-2.5 text-center hidden lg:table-cell">
          <span className="text-xs text-slate-600 tabular-nums">
            {pitcher.fgData?.bb_pct != null ? `${parseFloat(pitcher.fgData.bb_pct).toFixed(1)}%` : '--'}
          </span>
        </td>

        {/* Last 3 ERA */}
        <td className="px-2 py-2.5 text-center hidden lg:table-cell">
          <span className="text-xs text-slate-600 tabular-nums font-mono">
            {pitcher.last3Avg?.era != null ? pitcher.last3Avg.era.toFixed(2) : '--'}
          </span>
        </td>

        {/* Season IP */}
        <td className="px-2 py-2.5 text-center hidden lg:table-cell">
          <span className="text-xs text-slate-500 tabular-nums">{pitcher.seasonIP || '--'}</span>
        </td>

        {/* Trend sparkline */}
        <td className="px-2 py-2.5 text-center">
          <div className="flex justify-center">
            <PitcherSparkline last3={pitcher.last3 || []} width={56} height={18} />
          </div>
        </td>

        {/* Star */}
        <td className="px-2 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-center">
            <StarButton
              starred={starred}
              onToggle={() => onToggleStar(pitcher.id, { name: pitcher.name, teamAbbr: pitcher.teamAbbr })}
              pickCount={pickCount}
              size="sm"
            />
          </div>
        </td>
      </tr>

      {expanded && (
        <tr className="border-b border-slate-100 bg-slate-50/80 filter-drawer">
          <td colSpan={PITCHER_COLS.length} className="px-4 py-4">
            <PitcherDropdown pitcher={pitcher} />
          </td>
        </tr>
      )}
    </>
  )
}

// ── Column definitions ────────────────────────────────────────────────────────

const PITCHER_COLS = [
  { key: 'rank',         label: '#',        sortable: false, w: 'w-8',           align: 'center' },
  { key: 'name',         label: 'Pitcher',  sortable: true,  w: 'min-w-[130px]', align: 'left'   },
  { key: 'throws',       label: 'Throws',   sortable: true,  w: 'w-14',          align: 'center' },
  { key: 'matchupGrade', label: 'Grade',    sortable: true,  w: 'w-14',          align: 'center' },
  { key: 'xfip',         label: 'xFIP',     sortable: true,  w: 'w-14',          align: 'center' },
  { key: 'siera',        label: 'SIERA',    sortable: true,  w: 'w-14',          align: 'center' },
  { key: 'kPct',         label: 'K%',       sortable: true,  w: 'w-14',          align: 'center' },
  { key: 'bbPct',        label: 'BB%',      sortable: true,  w: 'w-14',          align: 'center' },
  { key: 'last3ERA',     label: 'L3 ERA',   sortable: true,  w: 'w-14',          align: 'center' },
  { key: 'seasonIP',     label: 'IP',       sortable: true,  w: 'w-14',          align: 'center' },
  { key: 'trend',        label: 'Trend',    sortable: false, w: 'w-20',          align: 'center' },
  { key: 'star',         label: '★',        sortable: false, w: 'w-14',          align: 'center' },
]

const MOBILE_PITCHER_COLS = new Set(['name', 'matchupGrade', 'trend', 'star'])

const GRADE_ORDER = { A: 0, B: 1, C: 2, D: 3, F: 4, '--': 5 }

function SortHeader({ col, sortKey, sortDir, onSort }) {
  const active = sortKey === col.key
  return (
    <th
      className={`
        ${col.w} text-${col.align} px-2 py-2.5 text-[10px] font-semibold uppercase tracking-wider
        whitespace-nowrap select-none bg-slate-50
        ${col.sortable ? 'cursor-pointer hover:text-slate-700' : ''}
        ${active ? 'text-amber-500' : 'text-slate-400'}
        ${!MOBILE_PITCHER_COLS.has(col.key) ? 'hidden lg:table-cell' : ''}
      `}
      onClick={col.sortable ? () => onSort(col.key) : undefined}
    >
      {col.label}
      {active && col.sortable && <span className="ml-0.5">{sortDir === 'asc' ? '↑' : '↓'}</span>}
    </th>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

const SORT_DEFAULTS = { key: 'matchupGrade', dir: 'asc' }  // A first

export default function PitcherTable({ pitchers, loading, error, onRetry, stars, onToggleStar }) {
  const [sort, setSort]   = useState(SORT_DEFAULTS)
  const [search, setSearch] = useState('')
  const debouncedSearch = useCallback(debounce((v) => setSearch(v), 180), [])

  const allScores = useMemo(() =>
    pitchers.map((p) => p.matchupScore ?? 50).filter(Boolean),
    [pitchers]
  )

  const sorted = useMemo(() => {
    let list = [...pitchers]
    if (search) list = list.filter((p) => p.name?.toLowerCase().includes(search.toLowerCase()))

    list.sort((a, b) => {
      if (sort.key === 'matchupGrade') {
        const ao = GRADE_ORDER[a.matchupGrade] ?? 5
        const bo = GRADE_ORDER[b.matchupGrade] ?? 5
        return sort.dir === 'asc' ? ao - bo : bo - ao
      }
      if (sort.key === 'xfip')    return numSort(a.fgData?.xfip, b.fgData?.xfip, sort.dir, true)
      if (sort.key === 'siera')   return numSort(a.fgData?.siera, b.fgData?.siera, sort.dir, true)
      if (sort.key === 'kPct')    return numSort(a.fgData?.k_pct, b.fgData?.k_pct, sort.dir, false)
      if (sort.key === 'bbPct')   return numSort(a.fgData?.bb_pct, b.fgData?.bb_pct, sort.dir, true)
      if (sort.key === 'last3ERA') return numSort(a.last3Avg?.era, b.last3Avg?.era, sort.dir, true)
      if (sort.key === 'seasonIP') {
        const toNum = (ip) => { if (!ip || ip === '--') return -1; const [i, f] = String(ip).split('.'); return parseInt(i) + (parseInt(f || 0) / 3) }
        const av = toNum(a.seasonIP), bv = toNum(b.seasonIP)
        return sort.dir === 'asc' ? av - bv : bv - av
      }
      let av = a[sort.key] ?? '', bv = b[sort.key] ?? ''
      if (typeof av === 'string') av = av.toLowerCase()
      if (typeof bv === 'string') bv = bv.toLowerCase()
      if (av < bv) return sort.dir === 'asc' ? -1 : 1
      if (av > bv) return sort.dir === 'asc' ? 1 : -1
      return 0
    })
    return list
  }, [pitchers, sort, search])

  function numSort(av, bv, dir, nullsLast = true) {
    const af = av != null ? parseFloat(av) : (nullsLast ? Infinity : -Infinity)
    const bf = bv != null ? parseFloat(bv) : (nullsLast ? Infinity : -Infinity)
    return dir === 'asc' ? af - bf : bf - af
  }

  function handleSort(key) {
    setSort((prev) => prev.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: key === 'matchupGrade' ? 'asc' : 'desc' }
    )
  }

  return (
    <section aria-label="Pitcher Table" className="flex flex-col">
      {/* Search */}
      <div className="mb-3">
        <input
          type="search"
          placeholder="Search pitcher…"
          className="form-input-light w-full"
          onChange={(e) => debouncedSearch(e.target.value)}
          aria-label="Search pitchers"
        />
      </div>

      <div className="flex items-center justify-between mb-1.5 px-0.5">
        <span className="text-xs text-slate-400">{sorted.length} pitchers</span>
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
              {PITCHER_COLS.map((col) => (
                <SortHeader key={col.key} col={col} sortKey={sort.key} sortDir={sort.dir} onSort={handleSort} />
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && !pitchers.length && Array.from({ length: 10 }).map((_, i) => <SkeletonTableRow key={i} cols={PITCHER_COLS.length} />)}
            {!loading && sorted.length === 0 && (
              <tr>
                <td colSpan={PITCHER_COLS.length} className="text-center py-12 text-slate-400 text-sm">
                  {pitchers.length === 0 ? 'Waiting for pitcher data…' : 'No pitchers match search'}
                </td>
              </tr>
            )}
            {sorted.map((pitcher, i) => (
              <PitcherRow
                key={pitcher.id}
                pitcher={pitcher}
                rank={i + 1}
                starred={stars.includes(String(pitcher.id))}
                onToggleStar={onToggleStar}
                allScores={allScores}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
