'use client'
import { useState, useMemo, useCallback } from 'react'
import TeamBadge from '../ui/TeamBadge'
import Sparkline from '../ui/Sparkline'
import HeatDot from '../ui/HeatDot'
import StarButton from '../StarButton'
import { gradeColor, playerDisplayName, fmtERA } from '@/lib/mlbApi'
import { usePicks } from '@/hooks/usePicks'
import { debounce } from '@/lib/utils'

const PAGE_SIZE = 50

const POSITIONS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH', 'OF']

const SORT_OPTIONS = [
  { value: 'last7Total',  label: '7-Day Total' },
  { value: 'seasonH',     label: 'Season H' },
  { value: 'seasonR',     label: 'Season R' },
  { value: 'seasonHR',    label: 'Season HR' },
  { value: 'seasonRBI',   label: 'Season RBI' },
  { value: 'seasonAVG',   label: 'Season AVG' },
  { value: 'seasonOPS',   label: 'Season OPS' },
  { value: 'matchupGrade',label: 'Grade' },
]

// ── Player row expanded dropdown ───────────────────────────────────────────────

function PlayerDropdown({ player }) {
  return (
    <div className="px-4 py-3 bg-[var(--bg-subtle)] border-t border-[var(--border)] animate-fade-in">
      <div className="flex items-start gap-4">
        {/* Headshot */}
        <PlayerHeadshot id={player.id} name={player.name} />

        {/* Stats */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-sm font-semibold text-[var(--text-primary)]">{player.name}</span>
            <TeamBadge abbr={player.teamAbbr} size="xs" />
            <span className="text-xs text-[var(--text-muted)]">{player.position}</span>
            {player.matchupGrade && (
              <span className={`text-sm font-bold ${gradeColor(player.matchupGrade)}`}>
                Grade {player.matchupGrade}
              </span>
            )}
          </div>

          {/* Today */}
          {(player.todayH > 0 || player.todayR > 0 || player.todayRBI > 0) && (
            <div className="mb-2">
              <span className="stat-box-label">Today: </span>
              <span className="text-xs font-medium text-[var(--text-primary)]">
                {player.todayH}H / {player.todayR}R / {player.todayRBI}RBI
              </span>
            </div>
          )}

          {/* 7-day */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2">
            <div>
              <span className="stat-box-label">7-Day: </span>
              <span className="text-xs font-semibold text-amber-500">{player.last7Total}</span>
            </div>
            <div>
              <span className="stat-box-label">Yesterday: </span>
              <span className="text-xs text-[var(--text-secondary)]">
                {player.yesterdayH}H / {player.yesterdayR}R / {player.yesterdayRBI}RBI
              </span>
            </div>
          </div>

          {/* Season stats */}
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {[
              { l: 'H',   v: player.seasonH },
              { l: 'R',   v: player.seasonR },
              { l: 'HR',  v: player.seasonHR },
              { l: 'RBI', v: player.seasonRBI },
              { l: 'AVG', v: player.seasonAVG != null ? player.seasonAVG.toFixed(3) : '--' },
              { l: 'OPS', v: player.seasonOPS != null ? player.seasonOPS.toFixed(3) : '--' },
            ].map(({ l, v }) => (
              <div key={l}>
                <span className="stat-box-label">{l}: </span>
                <span className="text-xs font-medium text-[var(--text-primary)]">{v}</span>
              </div>
            ))}
          </div>

          {/* Sparkline */}
          {player.sparkline?.length > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <span className="stat-box-label">7-Day Trend:</span>
              <Sparkline data={player.sparkline} heatTier={player.heatTier} width={80} height={20} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PlayerHeadshot({ id, name, size = 48 }) {
  const [errored, setErrored] = useState(false)
  if (!id || errored) {
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

// ── Sortable column header ─────────────────────────────────────────────────────

function SortTh({ label, sortKey, currentKey, dir, onSort, className = '' }) {
  const active = currentKey === sortKey
  return (
    <th
      onClick={() => onSort(sortKey)}
      className={`px-2 py-2.5 text-[10px] font-semibold uppercase tracking-wider cursor-pointer select-none whitespace-nowrap
        ${active ? 'text-amber-500' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}
        ${className}`}
    >
      {label}{active && <span className="ml-0.5">{dir === 'asc' ? '↑' : '↓'}</span>}
    </th>
  )
}

// ── Player row ─────────────────────────────────────────────────────────────────

function PlayerRow({ player, rank, starred, onToggleStar }) {
  const [expanded, setExpanded] = useState(false)
  const { getCount } = usePicks()
  const pickCount = getCount(player.name, player.teamAbbr)

  return (
    <>
      <tr
        className={`border-b border-[var(--border)] cursor-pointer hover:bg-[var(--bg-hover)] transition-colors ${starred ? 'starred-row' : ''}`}
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Rank */}
        <td className="px-2 py-2.5 text-center text-xs text-[var(--text-muted)] tabular-nums w-8 hidden lg:table-cell">
          {rank}
        </td>

        {/* Player — sticky on mobile */}
        <td className="sticky-col px-3 py-2.5 min-w-[140px]">
          <div className="flex items-center gap-2">
            <PlayerHeadshot id={player.id} name={player.name} size={28} />
            <div className="min-w-0">
              <div className="text-xs font-semibold text-[var(--text-primary)] truncate max-w-[110px]">
                {playerDisplayName(player.name, player.heatTier)}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-[var(--text-muted)]">{player.position}</span>
                <span className="text-[10px] text-[var(--text-muted)] hidden sm:inline">· {player.teamAbbr}</span>
              </div>
            </div>
          </div>
        </td>

        {/* Sparkline — desktop only; on mobile shown via expand */}
        <td className="px-2 py-2.5 hidden lg:table-cell">
          <div className="flex justify-center">
            <Sparkline data={player.sparkline || []} heatTier={player.heatTier} width={56} height={18} />
          </div>
        </td>

        {/* 7-day total */}
        <td className="px-2 py-2.5 text-center">
          <span className="text-sm font-bold text-amber-500 tabular-nums">{player.last7Total ?? 0}</span>
        </td>

        {/* Season H */}
        <td className="px-2 py-2.5 text-center hidden lg:table-cell">
          <span className="text-xs text-[var(--text-secondary)] tabular-nums">{player.seasonH ?? 0}</span>
        </td>
        {/* Season R */}
        <td className="px-2 py-2.5 text-center hidden lg:table-cell">
          <span className="text-xs text-[var(--text-secondary)] tabular-nums">{player.seasonR ?? 0}</span>
        </td>
        {/* Season HR */}
        <td className="px-2 py-2.5 text-center hidden lg:table-cell">
          <span className="text-xs text-[var(--text-secondary)] tabular-nums">{player.seasonHR ?? 0}</span>
        </td>
        {/* Season RBI */}
        <td className="px-2 py-2.5 text-center hidden lg:table-cell">
          <span className="text-xs text-[var(--text-secondary)] tabular-nums">{player.seasonRBI ?? 0}</span>
        </td>
        {/* Season AVG */}
        <td className="px-2 py-2.5 text-center hidden lg:table-cell">
          <span className="text-xs text-[var(--text-secondary)] tabular-nums">
            {player.seasonAVG != null ? player.seasonAVG.toFixed(3) : '--'}
          </span>
        </td>
        {/* Season OPS */}
        <td className="px-2 py-2.5 text-center hidden lg:table-cell">
          <span className="text-xs text-[var(--text-secondary)] tabular-nums">
            {player.seasonOPS != null ? player.seasonOPS.toFixed(3) : '--'}
          </span>
        </td>

        {/* Matchup Grade */}
        <td className="px-2 py-2.5 text-center">
          {player.matchupGrade ? (
            <span className={`text-sm font-bold ${gradeColor(player.matchupGrade)}`}>
              {player.matchupGrade}
            </span>
          ) : (
            <span className="text-xs text-[var(--text-muted)]">—</span>
          )}
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

      {/* Expanded dropdown */}
      {expanded && (
        <tr className="border-b border-[var(--border)]">
          <td colSpan={12}>
            <PlayerDropdown player={player} />
          </td>
        </tr>
      )}
    </>
  )
}

// ── Main Export ────────────────────────────────────────────────────────────────

export default function PlayerListTab({ players, loading, stars, onToggleStar }) {
  const [search, setSearch] = useState('')
  const [filterTeam, setFilterTeam] = useState('')
  const [filterPosition, setFilterPosition] = useState('')
  const [sortKey, setSortKey] = useState('last7Total')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(1)

  const debouncedSearch = useCallback(debounce((v) => { setSearch(v); setPage(1) }, 180), [])

  const teams = useMemo(
    () => Array.from(new Set(players.map((p) => p.teamAbbr).filter(Boolean))).sort(),
    [players]
  )

  const sorted = useMemo(() => {
    let list = [...players]
    if (search) list = list.filter((p) => p.name?.toLowerCase().includes(search.toLowerCase()))
    if (filterTeam) list = list.filter((p) => p.teamAbbr === filterTeam)
    if (filterPosition) list = list.filter((p) => p.position === filterPosition)

    list.sort((a, b) => {
      let av = a[sortKey] ?? -Infinity
      let bv = b[sortKey] ?? -Infinity
      if (sortKey === 'matchupGrade') {
        const order = { A: 5, B: 4, C: 3, D: 2, F: 1 }
        av = order[av] ?? 0
        bv = order[bv] ?? 0
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return list
  }, [players, search, filterTeam, filterPosition, sortKey, sortDir])

  function handleSort(key) {
    if (key === sortKey) {
      setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
    setPage(1)
  }

  const visible = sorted.slice(0, page * PAGE_SIZE)
  const hasMore = visible.length < sorted.length

  return (
    <div className="p-3 lg:p-4">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="search"
          placeholder="Search player…"
          className="form-input flex-1 min-w-[160px]"
          onChange={(e) => debouncedSearch(e.target.value)}
          aria-label="Search players"
        />
        <select
          className="form-input"
          value={filterTeam}
          onChange={(e) => { setFilterTeam(e.target.value); setPage(1) }}
        >
          <option value="">All Teams</option>
          {teams.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          className="form-input"
          value={filterPosition}
          onChange={(e) => { setFilterPosition(e.target.value); setPage(1) }}
        >
          <option value="">All Positions</option>
          {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select
          className="form-input"
          value={sortKey}
          onChange={(e) => { setSortKey(e.target.value); setSortDir('desc'); setPage(1) }}
        >
          {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div className="flex items-center justify-between mb-2 px-0.5">
        <span className="text-xs text-[var(--text-muted)]">
          {sorted.length} players {visible.length < sorted.length ? `· showing ${visible.length}` : ''}
        </span>
        {(sortKey !== 'last7Total' || sortDir !== 'desc') && (
          <button
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] underline"
            onClick={() => { setSortKey('last7Total'); setSortDir('desc'); setPage(1) }}
          >
            Reset sort
          </button>
        )}
      </div>

      {/* Table */}
      <div className="table-scroll-wrapper bg-[var(--bg-card)] rounded-xl border border-[var(--border)] card-shadow overflow-hidden">
        <table className="w-full border-collapse">
          <thead className="border-b border-[var(--border)] bg-[var(--bg-subtle)]">
            <tr>
              <th className="px-2 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] text-center w-8 hidden lg:table-cell">#</th>
              <th className="sticky-col px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] text-left min-w-[140px] bg-[var(--bg-subtle)]">Player</th>
              <th className="px-2 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] text-center hidden lg:table-cell">Trend</th>
              <SortTh label="7D" sortKey="last7Total" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="text-center" />
              <SortTh label="H"   sortKey="seasonH"   currentKey={sortKey} dir={sortDir} onSort={handleSort} className="text-center hidden lg:table-cell" />
              <SortTh label="R"   sortKey="seasonR"   currentKey={sortKey} dir={sortDir} onSort={handleSort} className="text-center hidden lg:table-cell" />
              <SortTh label="HR"  sortKey="seasonHR"  currentKey={sortKey} dir={sortDir} onSort={handleSort} className="text-center hidden lg:table-cell" />
              <SortTh label="RBI" sortKey="seasonRBI" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="text-center hidden lg:table-cell" />
              <SortTh label="AVG" sortKey="seasonAVG" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="text-center hidden lg:table-cell" />
              <SortTh label="OPS" sortKey="seasonOPS" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="text-center hidden lg:table-cell" />
              <SortTh label="Grd" sortKey="matchupGrade" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="text-center" />
              <th className="px-2 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] text-center w-14">★</th>
            </tr>
          </thead>
          <tbody>
            {loading && !players.length && Array.from({ length: 12 }).map((_, i) => (
              <tr key={i} className="border-b border-[var(--border)]">
                {Array.from({ length: 12 }).map((_, j) => (
                  <td key={j} className="px-2 py-2.5">
                    <div className="skeleton h-3.5 rounded" />
                  </td>
                ))}
              </tr>
            ))}
            {!loading && visible.length === 0 && (
              <tr>
                <td colSpan={12} className="text-center py-12 text-[var(--text-muted)] text-sm">
                  {players.length === 0 ? 'Loading player data…' : 'No players match filters'}
                </td>
              </tr>
            )}
            {visible.map((player, i) => (
              <PlayerRow
                key={player.id}
                player={player}
                rank={i + 1}
                starred={stars.includes(String(player.id))}
                onToggleStar={onToggleStar}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="mt-4 text-center">
          <button
            onClick={() => setPage((p) => p + 1)}
            className="px-6 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors card-shadow"
          >
            Load more ({sorted.length - visible.length} remaining)
          </button>
        </div>
      )}
    </div>
  )
}
