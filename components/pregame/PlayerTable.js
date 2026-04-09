'use client'
import { useState, useMemo, useCallback } from 'react'
import Sparkline from '../ui/Sparkline'
import HeatDot from '../ui/HeatDot'
import TeamBadge from '../ui/TeamBadge'
import StarButton from '../StarButton'
import { SkeletonTableRow } from '../ui/Skeleton'
import ErrorState from '../ui/ErrorState'
import { gradeColor, playerDisplayName } from '@/lib/mlbApi'
import { usePicks } from '@/hooks/usePicks'
import { debounce } from '@/lib/utils'

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

function PlayerRow({ player, rank, starred, onToggleStar, updatedIds }) {
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

        {/* Player name — sticky */}
        <td className="sticky-col px-3 py-2.5 relative" onMouseEnter={() => setShowDebug(true)} onMouseLeave={() => setShowDebug(false)}>
          <div className="font-medium text-slate-900 text-xs truncate max-w-[140px]" title={player.name}>
            {playerDisplayName(player.name, player.heatTier)}
          </div>
          <div className="text-[10px] text-slate-400">{player.position}</div>
          {showDebug && <DevStatDebug player={player} />}
        </td>

        {/* Team — hidden on mobile */}
        <td className="px-2 py-2.5 text-center hidden lg:table-cell">
          <TeamBadge abbr={player.teamAbbr} size="xs" />
        </td>

        {/* Opponent — hidden on mobile */}
        <td className="px-2 py-2.5 text-center hidden lg:table-cell">
          <span className="text-xs text-slate-400 font-mono">{player.opponentAbbr || '--'}</span>
        </td>

        {/* Matchup Grade */}
        <td className="px-2 py-2.5 text-center">
          <span className={`text-sm font-bold ${gradeColor(player.matchupGrade)}`}>
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

      {/* Mobile expanded row — full stat detail */}
      {expanded && (
        <tr className="lg:hidden border-b border-slate-100 bg-slate-50">
          <td colSpan={5} className="px-4 py-3">
            <div className="flex flex-wrap gap-4 text-xs">
              <div>
                <span className="text-slate-400 uppercase tracking-wide text-[10px]">Team</span>
                <div className="mt-0.5"><TeamBadge abbr={player.teamAbbr} size="xs" /></div>
              </div>
              <div>
                <span className="text-slate-400 uppercase tracking-wide text-[10px]">Opp</span>
                <div className="font-mono text-slate-600 mt-0.5">{player.opponentAbbr || '--'}</div>
              </div>
              <div>
                <span className="text-slate-400 uppercase tracking-wide text-[10px]">Yesterday</span>
                <div className="font-mono text-slate-600 mt-0.5">
                  {player.yesterdayH ?? 0}H / {player.yesterdayR ?? 0}R / {player.yesterdayRBI ?? 0}RBI
                </div>
              </div>
              <div>
                <span className="text-slate-400 uppercase tracking-wide text-[10px]">Season</span>
                <div className="font-mono text-slate-600 mt-0.5">
                  {player.seasonH ?? 0}H / {player.seasonR ?? 0}R / {player.seasonRBI ?? 0}RBI
                </div>
              </div>
              <div>
                <span className="text-slate-400 uppercase tracking-wide text-[10px]">Heat</span>
                <div className="mt-1"><HeatDot heatTier={player.heatTier} showLabel /></div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export default function PlayerTable({ players, loading, error, onRetry, stars, onToggleStar, selectedGamePk, updatedIds, games }) {
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
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
