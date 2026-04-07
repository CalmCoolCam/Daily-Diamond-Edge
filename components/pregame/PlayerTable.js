'use client'
import { useState, useMemo, useCallback } from 'react'
import Sparkline from '../ui/Sparkline'
import HeatDot from '../ui/HeatDot'
import TeamBadge from '../ui/TeamBadge'
import StarButton from '../StarButton'
import { SkeletonTableRow } from '../ui/Skeleton'
import ErrorState from '../ui/ErrorState'
import { gradeColor, computeHeat } from '@/lib/mlbApi'
import { usePicks } from '@/hooks/usePicks'
import { debounce } from '@/lib/utils'

const SORT_DEFAULTS = { key: 'last7Total', dir: 'desc' }

const COLS = [
  { key: 'rank',        label: '#',           sortable: false, w: 'w-8', align: 'text-center' },
  { key: 'name',        label: 'Player',      sortable: true,  w: 'min-w-[130px]', align: 'text-left' },
  { key: 'teamAbbr',    label: 'Team',        sortable: true,  w: 'w-16', align: 'text-center' },
  { key: 'opponentAbbr',label: 'Opp',         sortable: true,  w: 'w-14', align: 'text-center' },
  { key: 'matchupGrade',label: 'Grade',       sortable: true,  w: 'w-14', align: 'text-center' },
  { key: 'yesterdayHRR',label: 'Yday',        sortable: false, w: 'w-20', align: 'text-center' },
  { key: 'last7Total',  label: '7D H+R+RBI',  sortable: true,  w: 'w-24', align: 'text-center' },
  { key: 'seasonH',     label: 'H',           sortable: true,  w: 'w-12', align: 'text-center' },
  { key: 'seasonR',     label: 'R',           sortable: true,  w: 'w-12', align: 'text-center' },
  { key: 'seasonRBI',   label: 'RBI',         sortable: true,  w: 'w-12', align: 'text-center' },
  { key: 'seasonTotal', label: 'S.Total',     sortable: true,  w: 'w-16', align: 'text-center' },
  { key: 'trend',       label: 'Trend',       sortable: false, w: 'w-20', align: 'text-center' },
  { key: 'heat',        label: '🌡',           sortable: true,  w: 'w-10', align: 'text-center' },
  { key: 'star',        label: '★',           sortable: false, w: 'w-14', align: 'text-center' },
]

function SortHeader({ col, sortKey, sortDir, onSort }) {
  const active = sortKey === col.key
  return (
    <th
      className={`
        ${col.w} ${col.align} px-2 py-2.5 text-[10px] font-semibold uppercase tracking-wider
        whitespace-nowrap select-none
        ${col.sortable ? 'cursor-pointer hover:text-white' : ''}
        ${active ? 'text-gold-500' : 'text-slate-500'}
      `}
      onClick={col.sortable ? () => onSort(col.key) : undefined}
      aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
    >
      {col.label}
      {active && col.sortable && (
        <span className="ml-0.5">{sortDir === 'asc' ? '↑' : '↓'}</span>
      )}
    </th>
  )
}

function PlayerRow({ player, rank, starred, onToggleStar, updatedIds }) {
  const { getCount } = usePicks()
  const pickCount = getCount(player.name, player.teamAbbr)
  const heat = computeHeat(player.last7Total || 0)
  const wasUpdated = updatedIds?.has(String(player.id))

  return (
    <tr
      className={`
        border-b border-navy-800/60 transition-colors duration-150 text-sm
        hover:bg-navy-800/40
        ${starred ? 'starred-row' : ''}
        ${wasUpdated ? 'stat-updated' : ''}
      `}
    >
      {/* Rank */}
      <td className="px-2 py-2 text-center text-xs text-slate-600 tabular-nums">{rank}</td>

      {/* Player name — sticky */}
      <td className="sticky-col px-3 py-2">
        <div className="font-medium text-white text-xs truncate max-w-[140px]" title={player.name}>
          {player.name}
        </div>
        <div className="text-[10px] text-slate-500">{player.position}</div>
      </td>

      {/* Team */}
      <td className="px-2 py-2 text-center">
        <TeamBadge abbr={player.teamAbbr} size="xs" />
      </td>

      {/* Opponent */}
      <td className="px-2 py-2 text-center">
        <span className="text-xs text-slate-400 font-mono">{player.opponentAbbr || '--'}</span>
      </td>

      {/* Matchup Grade */}
      <td className="px-2 py-2 text-center">
        <span className={`text-sm font-bold ${gradeColor(player.matchupGrade)}`}>
          {player.matchupGrade || '--'}
        </span>
      </td>

      {/* Yesterday */}
      <td className="px-2 py-2 text-center">
        <span className="text-xs text-slate-400 font-mono whitespace-nowrap">
          {player.yesterdayH ?? 0}/{player.yesterdayR ?? 0}/{player.yesterdayRBI ?? 0}
        </span>
      </td>

      {/* 7-day total */}
      <td className="px-2 py-2 text-center">
        <span className="text-sm font-bold text-gold-400 tabular-nums">
          {player.last7Total ?? 0}
        </span>
      </td>

      {/* Season H */}
      <td className="px-2 py-2 text-center">
        <span className="text-xs text-slate-300 tabular-nums">{player.seasonH ?? 0}</span>
      </td>

      {/* Season R */}
      <td className="px-2 py-2 text-center">
        <span className="text-xs text-slate-300 tabular-nums">{player.seasonR ?? 0}</span>
      </td>

      {/* Season RBI */}
      <td className="px-2 py-2 text-center">
        <span className="text-xs text-slate-300 tabular-nums">{player.seasonRBI ?? 0}</span>
      </td>

      {/* Season Total */}
      <td className="px-2 py-2 text-center">
        <span className="text-xs font-semibold text-slate-300 tabular-nums">{player.seasonTotal ?? 0}</span>
      </td>

      {/* Sparkline */}
      <td className="px-2 py-2 text-center">
        <div className="flex justify-center">
          <Sparkline data={player.sparkline || []} width={60} height={20} />
        </div>
      </td>

      {/* Heat */}
      <td className="px-2 py-2 text-center">
        <div className="flex justify-center">
          <HeatDot total7Day={player.last7Total || 0} size="sm" showEmoji />
        </div>
      </td>

      {/* Star */}
      <td className="px-2 py-2 text-center">
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
  )
}

export default function PlayerTable({
  players = [],
  loading,
  error,
  onRetry,
  stars = [],
  onToggleStar,
  selectedGamePk,
  updatedIds,
  games = [],
}) {
  const [sort, setSort] = useState(SORT_DEFAULTS)
  const [search, setSearch] = useState('')
  const [filterTeam, setFilterTeam] = useState('')
  const [filterOpp, setFilterOpp] = useState('')
  const [filterStarred, setFilterStarred] = useState(false)
  const [filterSide, setFilterSide] = useState('') // 'home' | 'away' | ''
  const [filterDayNight, setFilterDayNight] = useState('') // 'day' | 'night' | ''

  const debouncedSearch = useCallback(debounce((v) => setSearch(v), 180), [])

  const teams = useMemo(() => {
    const set = new Set(players.map((p) => p.teamAbbr).filter(Boolean))
    return Array.from(set).sort()
  }, [players])

  const opponents = useMemo(() => {
    const set = new Set(players.map((p) => p.opponentAbbr).filter(Boolean))
    return Array.from(set).sort()
  }, [players])

  const sorted = useMemo(() => {
    let list = [...players]

    // Filter by selected game
    if (selectedGamePk) {
      list = list.filter((p) => p.gamePk === selectedGamePk)
    }

    // Search
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((p) => p.name?.toLowerCase().includes(q))
    }

    // Team filter
    if (filterTeam) list = list.filter((p) => p.teamAbbr === filterTeam)

    // Opponent filter
    if (filterOpp) list = list.filter((p) => p.opponentAbbr === filterOpp)

    // Starred only
    if (filterStarred) list = list.filter((p) => stars.includes(String(p.id)))

    // Home/Away
    if (filterSide === 'home') list = list.filter((p) => p.isHome)
    if (filterSide === 'away') list = list.filter((p) => !p.isHome)

    // Day/Night (based on game hour CST — before 5pm = day)
    if (filterDayNight && games.length) {
      const gameTimeMap = {}
      games.forEach((g) => {
        const hour = new Date(g.gameDate || '').toLocaleString('en-US', {
          timeZone: 'America/Chicago', hour: 'numeric', hour12: false,
        })
        gameTimeMap[g.gamePk] = parseInt(hour, 10)
      })
      list = list.filter((p) => {
        const h = gameTimeMap[p.gamePk]
        if (h == null) return true
        return filterDayNight === 'day' ? h < 17 : h >= 17
      })
    }

    // Sort
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
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'desc' },
    )
  }

  const starredCount = stars.length

  return (
    <section aria-label="Player Table" className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="bg-navy-900/60 border border-navy-800 rounded-xl p-3 mb-3 space-y-2">
        {/* Search */}
        <input
          type="search"
          placeholder="Search player..."
          className="form-input-dark w-full"
          onChange={(e) => debouncedSearch(e.target.value)}
          aria-label="Search players"
        />

        {/* Dropdowns + toggles */}
        <div className="flex flex-wrap gap-2">
          <select
            className="form-input-dark flex-1 min-w-[90px]"
            value={filterTeam}
            onChange={(e) => setFilterTeam(e.target.value)}
            aria-label="Filter by team"
          >
            <option value="">All Teams</option>
            {teams.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>

          <select
            className="form-input-dark flex-1 min-w-[90px]"
            value={filterOpp}
            onChange={(e) => setFilterOpp(e.target.value)}
            aria-label="Filter by opponent"
          >
            <option value="">All Opps</option>
            {opponents.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>

          {/* Home/Away toggle */}
          <div className="flex bg-navy-800 rounded-lg border border-navy-700 overflow-hidden">
            {['', 'home', 'away'].map((v) => (
              <button
                key={v}
                onClick={() => setFilterSide(v)}
                className={`px-2.5 py-1 text-xs transition-colors ${filterSide === v ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                {v === '' ? 'All' : v === 'home' ? 'Home' : 'Away'}
              </button>
            ))}
          </div>

          {/* Day/Night toggle */}
          <div className="flex bg-navy-800 rounded-lg border border-navy-700 overflow-hidden">
            {['', 'day', 'night'].map((v) => (
              <button
                key={v}
                onClick={() => setFilterDayNight(v)}
                className={`px-2.5 py-1 text-xs transition-colors ${filterDayNight === v ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                {v === '' ? 'All' : v === 'day' ? '☀' : '🌙'}
              </button>
            ))}
          </div>

          {/* Starred only */}
          <button
            onClick={() => setFilterStarred((p) => !p)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs transition-colors ${
              filterStarred
                ? 'bg-gold-500/20 border-gold-500/40 text-gold-400'
                : 'bg-navy-800 border-navy-700 text-slate-400 hover:text-white'
            }`}
          >
            ★ Starred ({starredCount})
          </button>
        </div>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between mb-1.5 px-1">
        <span className="text-xs text-slate-500">{sorted.length} players</span>
        {sort.key !== SORT_DEFAULTS.key && (
          <button
            className="text-xs text-slate-600 hover:text-slate-400 underline"
            onClick={() => setSort(SORT_DEFAULTS)}
          >
            Reset sort
          </button>
        )}
      </div>

      {error && <ErrorState message={error} onRetry={onRetry} compact />}

      {/* Table */}
      <div className="table-scroll-wrapper bg-navy-900/40 rounded-xl border border-navy-800 overflow-hidden flex-1">
        <table className="w-full text-sm border-collapse" role="grid">
          <thead className="sticky top-0 z-10 bg-navy-900 border-b border-navy-800">
            <tr>
              {COLS.map((col) => (
                <SortHeader
                  key={col.key}
                  col={col}
                  sortKey={sort.key}
                  sortDir={sort.dir}
                  onSort={handleSort}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && !players.length && (
              Array.from({ length: 12 }).map((_, i) => (
                <SkeletonTableRow key={i} cols={COLS.length} />
              ))
            )}

            {!loading && sorted.length === 0 && (
              <tr>
                <td colSpan={COLS.length} className="text-center py-12 text-slate-500 text-sm">
                  {players.length === 0 ? 'Waiting for player data...' : 'No players match filters'}
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
