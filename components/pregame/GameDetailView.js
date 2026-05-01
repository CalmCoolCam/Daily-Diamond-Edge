'use client'
import { useState, useEffect } from 'react'
import PlayerHeadshot from '../ui/PlayerHeadshot'
import TeamLogo from '../ui/TeamLogo'
import TeamBadge from '../ui/TeamBadge'
import Sparkline from '../ui/Sparkline'
import StarButton from '../StarButton'
import { gradeColorHex, fmtERA } from '@/lib/mlbApi'
import { formatCSTTime } from '@/lib/utils'
import { getCached, setCached } from '@/lib/storage'
import { usePicks } from '@/hooks/usePicks'

const BOXSCORE_CACHE_TTL = 15 * 60 * 1000
const LEAGUE_AVG_ERA     = 4.00

// ── Shared helpers ────────────────────────────────────────────────────────────

function extractPitcherStats(statsData) {
  const stat = statsData?.stats?.[0]?.splits?.[0]?.stat || {}
  return {
    era:   stat.era               != null ? parseFloat(stat.era)               : null,
    kPer9: stat.strikeoutsPer9Inn != null ? parseFloat(stat.strikeoutsPer9Inn) : null,
    whip:  stat.whip              != null ? parseFloat(stat.whip)              : null,
  }
}

function computeEraPlus(era) {
  if (!era || era <= 0) return null
  return Math.round(100 * LEAGUE_AVG_ERA / era)
}

function statTint(val, type) {
  if (val == null) return ''
  switch (type) {
    case 'era':     return val >= 4.50 ? 'favorable' : val <= 3.00 ? 'unfavorable' : ''
    case 'eraPlus': return val <= 90   ? 'favorable' : val >= 120  ? 'unfavorable' : ''
    case 'whip':    return val >= 1.40 ? 'favorable' : val <= 1.00 ? 'unfavorable' : ''
    case 'k9':      return val <= 7.0  ? 'favorable' : val >= 10.0 ? 'unfavorable' : ''
    default:        return ''
  }
}

function StatCell({ label, value, tint }) {
  const bgStyle = tint === 'favorable'
    ? { backgroundColor: 'rgba(22, 163, 74, 0.25)' }
    : tint === 'unfavorable'
    ? { backgroundColor: 'rgba(220, 38, 38, 0.25)' }
    : { backgroundColor: 'var(--bg-subtle)' }

  return (
    <div className="text-center px-2 py-1.5 rounded-lg" style={bgStyle}>
      <div className="text-[9px] uppercase tracking-wider font-semibold mb-0.5" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="text-sm font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>{value ?? '--'}</div>
    </div>
  )
}

// ── Section 1: Pitcher column ─────────────────────────────────────────────────

function PitcherColumn({ pitcher, pitcherStats, teamId, teamAbbr, label }) {
  const era     = pitcherStats?.era
  const kPer9   = pitcherStats?.kPer9
  const whip    = pitcherStats?.whip
  const eraPlus = computeEraPlus(era)

  return (
    <div className="flex-1 flex flex-col items-center gap-3 text-center min-w-0">
      <div className="text-[9px] uppercase tracking-widest text-slate-400 font-semibold">{label}</div>

      {pitcher ? (
        <>
          <PlayerHeadshot personId={pitcher.id} name={pitcher.fullName} teamAbbr={teamAbbr} height={72} />
          <div>
            <div className="font-bold text-sm text-slate-900 leading-tight px-1">{pitcher.fullName}</div>
            <div className="flex items-center justify-center gap-1 mt-1">
              <TeamLogo teamId={teamId} abbr={teamAbbr} size="sm" />
              <TeamBadge abbr={teamAbbr} size="xs" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5 w-full">
            <StatCell label="ERA"  value={fmtERA(era)}       tint={statTint(era,     'era')}     />
            <StatCell label="ERA+" value={eraPlus ?? '--'}   tint={statTint(eraPlus, 'eraPlus')} />
            <StatCell label="WHIP" value={whip?.toFixed(2)}  tint={statTint(whip,    'whip')}    />
            <StatCell label="K/9"  value={kPer9?.toFixed(1)} tint={statTint(kPer9,   'k9')}      />
          </div>
        </>
      ) : (
        <>
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-300 text-2xl select-none">?</div>
          <div>
            <div className="text-sm text-slate-400 italic">TBD</div>
            <div className="flex items-center justify-center gap-1 mt-1">
              <TeamLogo teamId={teamId} abbr={teamAbbr} size="sm" />
              <TeamBadge abbr={teamAbbr} size="xs" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5 w-full">
            {['ERA', 'ERA+', 'WHIP', 'K/9'].map((l) => <StatCell key={l} label={l} value="--" />)}
          </div>
        </>
      )}
    </div>
  )
}

function PitcherMatchup({ game }) {
  const home = game.teams?.home
  const away = game.teams?.away
  const homePitcherStats = extractPitcherStats(game.homePitcherStats)
  const awayPitcherStats = extractPitcherStats(game.awayPitcherStats)
  const gameTime = formatCSTTime(game.gameDate)

  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] card-shadow p-4 mb-4">
      <div className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-widest text-center mb-4">
        {away?.team?.abbreviation} vs {home?.team?.abbreviation} — Starting Pitchers
      </div>
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
        <PitcherColumn
          pitcher={away?.probablePitcher}
          pitcherStats={awayPitcherStats}
          teamId={away?.team?.id}
          teamAbbr={away?.team?.abbreviation}
          label="Away Starter"
        />
        <div className="flex sm:flex-col items-center justify-center gap-1.5 px-3 sm:pt-10 flex-shrink-0">
          <span className="text-3xl font-black text-slate-200 leading-none" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>vs</span>
          {gameTime && <span className="text-[10px] text-slate-400 whitespace-nowrap font-medium">{gameTime} CST</span>}
        </div>
        <PitcherColumn
          pitcher={home?.probablePitcher}
          pitcherStats={homePitcherStats}
          teamId={home?.team?.id}
          teamAbbr={home?.team?.abbreviation}
          label="Home Starter"
        />
      </div>
    </div>
  )
}

// ── Section 2: Lineup player row ──────────────────────────────────────────────

function LineupPlayerRow({ orderNum, bsPlayer, enriched, starred, onToggleStar }) {
  const [expanded, setExpanded] = useState(false)
  const { getCount } = usePicks()

  const pid      = bsPlayer?.person?.id
  const name     = bsPlayer?.person?.fullName || '—'
  const pos      = bsPlayer?.position?.abbreviation || '—'
  const teamAbbr = enriched?.teamAbbr || ''
  const pickCount = getCount(name, teamAbbr)

  return (
    <>
      <tr
        className="border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors duration-100"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Batting order */}
        {orderNum != null && (
          <td className="px-1.5 py-2 text-center w-6">
            <span className="text-[10px] font-bold text-slate-300 tabular-nums">{orderNum}</span>
          </td>
        )}
        {/* Name + position */}
        <td className="px-2 py-2">
          <div className="text-xs font-medium text-slate-900 truncate max-w-[95px]" title={name}>{name}</div>
          <div className="text-[10px] text-slate-400">{pos}</div>
        </td>
        {/* Matchup grade */}
        <td className="px-1 py-2 text-center">
          <span className="text-xs font-bold tabular-nums" style={{ color: gradeColorHex(enriched?.matchupGrade) }}>
            {enriched?.matchupGrade || '—'}
          </span>
        </td>
        {/* 7-day H+R+RBI */}
        <td className="px-1 py-2 text-center">
          <span className="text-xs font-bold text-amber-500 tabular-nums">
            {enriched?.last7Total ?? '—'}
          </span>
        </td>
        {/* Sparkline */}
        <td className="px-1 py-2 text-center hidden sm:table-cell">
          <div className="flex justify-center">
            <Sparkline data={enriched?.sparkline || []} heatTier={enriched?.heatTier || 4} width={42} height={16} />
          </div>
        </td>
        {/* Star */}
        <td className="px-1 py-2 text-center" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-center">
            <StarButton
              starred={starred}
              onToggle={() => onToggleStar(pid, { name, teamAbbr })}
              pickCount={pickCount}
              size="sm"
            />
          </div>
        </td>
      </tr>

      {/* Inline expanded row — headshot + quick stats */}
      {expanded && (
        <tr className="border-b border-slate-100 bg-slate-50">
          <td colSpan={orderNum != null ? 6 : 5} className="px-3 py-3">
            <div className="flex items-center gap-3">
              <PlayerHeadshot personId={pid} name={name} teamAbbr={teamAbbr} height={52} />
              <div className="min-w-0">
                <div className="font-semibold text-sm text-slate-900 truncate">{name}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{pos}{teamAbbr ? ` · ${teamAbbr}` : ''}</div>
                {enriched && (
                  <div className="flex flex-wrap gap-3 mt-1.5 text-xs">
                    <span>
                      Grade:{' '}
                      <span className="font-bold" style={{ color: gradeColorHex(enriched.matchupGrade) }}>
                        {enriched.matchupGrade || '—'}
                      </span>
                    </span>
                    <span>
                      7-Day:{' '}
                      <span className="font-bold text-amber-500">{enriched.last7Total}</span>
                    </span>
                    <span className="text-slate-400">
                      Season: {enriched.seasonH}H / {enriched.seasonR}R / {enriched.seasonRBI}RBI
                    </span>
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Section 2: One team's lineup ──────────────────────────────────────────────

function LineupColumn({ teamAbbr, battingOrder, bsPlayers, enrichedPlayers, stars, onToggleStar }) {
  const hasLineup = battingOrder && battingOrder.length > 0

  return (
    <div className="flex-1 min-w-0">
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 px-1">
        {teamAbbr} Lineup
      </div>

      {!hasLineup ? (
        <div className="text-center py-8 px-3">
          <div className="text-sm text-slate-400 italic">Lineup not yet announced</div>
          <div className="text-[10px] text-slate-300 mt-1">Typically posted 1–2 hrs before first pitch</div>
        </div>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-1.5 py-1.5 text-[9px] text-slate-300 font-semibold text-center w-6">#</th>
              <th className="px-2 py-1.5 text-[9px] text-slate-400 font-semibold text-left">Player</th>
              <th className="px-1 py-1.5 text-[9px] text-slate-400 font-semibold text-center">Grd</th>
              <th className="px-1 py-1.5 text-[9px] text-slate-400 font-semibold text-center">7D</th>
              <th className="px-1 py-1.5 text-[9px] text-slate-400 font-semibold text-center hidden sm:table-cell">Trend</th>
              <th className="px-1 py-1.5 text-[9px] text-slate-300 font-semibold text-center">★</th>
            </tr>
          </thead>
          <tbody>
            {battingOrder.map((pid, i) => {
              const bsPlayer = bsPlayers?.['ID' + pid]
              const enriched = enrichedPlayers.find((p) => p.id === pid) || null
              return (
                <LineupPlayerRow
                  key={pid}
                  orderNum={i + 1}
                  bsPlayer={bsPlayer}
                  enriched={enriched}
                  starred={stars.includes(String(pid))}
                  onToggleStar={onToggleStar}
                />
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ── Section 2: Starting Lineups container ────────────────────────────────────

function StartingLineups({ game, boxscore, players, stars, onToggleStar, loading }) {
  const home = game.teams?.home
  const away = game.teams?.away
  const bsHome = boxscore?.teams?.home
  const bsAway = boxscore?.teams?.away

  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] card-shadow p-4 mb-4">
      <div className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-4">
        Starting Lineups
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-8 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        /* Desktop: side by side with divider  |  Mobile: stacked (away first) */
        <div className="flex flex-col sm:flex-row gap-4">
          <LineupColumn
            teamAbbr={away?.team?.abbreviation || ''}
            battingOrder={bsAway?.battingOrder || []}
            bsPlayers={bsAway?.players || {}}
            enrichedPlayers={players}
            stars={stars}
            onToggleStar={onToggleStar}
          />

          {/* vertical divider on desktop */}
          <div className="hidden sm:block w-px bg-slate-100 self-stretch flex-shrink-0" />
          {/* horizontal divider on mobile */}
          <div className="sm:hidden h-px bg-slate-100 w-full" />

          <LineupColumn
            teamAbbr={home?.team?.abbreviation || ''}
            battingOrder={bsHome?.battingOrder || []}
            bsPlayers={bsHome?.players || {}}
            enrichedPlayers={players}
            stars={stars}
            onToggleStar={onToggleStar}
          />
        </div>
      )}
    </div>
  )
}

// ── Section 3: Additional Players ────────────────────────────────────────────

const PITCHER_POSITION_CODES = new Set(['P', 'SP', 'RP', 'CL'])

function isPitcher(bsPlayer) {
  // Primary check: position.type.code from MLB API
  if (bsPlayer?.position?.type?.code === 'P') return true
  // Fallback: common pitcher abbreviations
  return PITCHER_POSITION_CODES.has(bsPlayer?.position?.abbreviation)
}

function AdditionalPlayerRow({ bsPlayer, enriched, teamAbbr, starred, onToggleStar }) {
  const { getCount } = usePicks()
  const pid       = bsPlayer?.person?.id
  const name      = bsPlayer?.person?.fullName || '—'
  const pos       = bsPlayer?.position?.abbreviation || '—'
  const pickCount = getCount(name, teamAbbr)

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors duration-100 text-xs">
      <td className="px-2 py-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <TeamBadge abbr={teamAbbr} size="xs" />
          <div className="min-w-0">
            <div className="font-medium text-slate-800 truncate max-w-[100px]" title={name}>{name}</div>
            <div className="text-[10px] text-slate-400">{pos}</div>
          </div>
        </div>
      </td>
      <td className="px-1 py-2 text-center">
        <span className="font-bold" style={{ color: gradeColorHex(enriched?.matchupGrade) }}>
          {enriched?.matchupGrade || '—'}
        </span>
      </td>
      <td className="px-1 py-2 text-center">
        <span className="font-bold text-amber-500 tabular-nums">{enriched?.last7Total ?? '—'}</span>
      </td>
      <td className="px-1 py-2 text-center hidden sm:table-cell">
        <div className="flex justify-center">
          <Sparkline data={enriched?.sparkline || []} heatTier={enriched?.heatTier || 4} width={40} height={14} />
        </div>
      </td>
      <td className="px-1 py-2 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center">
          <StarButton
            starred={starred}
            onToggle={() => onToggleStar(pid, { name, teamAbbr })}
            pickCount={pickCount}
            size="sm"
          />
        </div>
      </td>
    </tr>
  )
}

function AdditionalPlayers({ game, boxscore, players, stars, onToggleStar }) {
  const [expanded, setExpanded] = useState(false)

  if (!boxscore) return null

  const bsHome = boxscore.teams?.home
  const bsAway = boxscore.teams?.away
  const homeAbbr = game.teams?.home?.team?.abbreviation || ''
  const awayAbbr = game.teams?.away?.team?.abbreviation || ''

  const homeLineupSet = new Set((bsHome?.battingOrder || []).map(String))
  const awayLineupSet = new Set((bsAway?.battingOrder || []).map(String))

  // Build bench/roster rows for each team — skip pitchers and lineup starters
  function buildBenchRows(bsTeam, lineupSet, teamAbbr) {
    if (!bsTeam?.players) return []
    return Object.values(bsTeam.players)
      .filter((p) => {
        const pid = String(p.person?.id)
        return !lineupSet.has(pid) && !isPitcher(p)
      })
      .sort((a, b) => (a.person?.fullName || '').localeCompare(b.person?.fullName || ''))
  }

  const homeBench = buildBenchRows(bsHome, homeLineupSet, homeAbbr)
  const awayBench = buildBenchRows(bsAway, awayLineupSet, awayAbbr)
  const allBench  = [...awayBench.map((p) => ({ p, abbr: awayAbbr })), ...homeBench.map((p) => ({ p, abbr: homeAbbr }))]

  if (allBench.length === 0) return null

  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] card-shadow overflow-hidden">
      {/* Collapse toggle header */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
          Additional Players
          <span className="ml-1.5 text-[9px] text-slate-300 normal-case font-normal tracking-normal">
            ({allBench.length})
          </span>
        </span>
        <span className="text-slate-400 text-xs">{expanded ? '▲' : '▼'} {expanded ? 'Hide' : 'Show full roster'}</span>
      </button>

      {expanded && (
        <div className="border-t border-[var(--border)]">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-2 py-1.5 text-[9px] text-slate-400 font-semibold text-left">Player</th>
                <th className="px-1 py-1.5 text-[9px] text-slate-400 font-semibold text-center">Grd</th>
                <th className="px-1 py-1.5 text-[9px] text-slate-400 font-semibold text-center">7D</th>
                <th className="px-1 py-1.5 text-[9px] text-slate-400 font-semibold text-center hidden sm:table-cell">Trend</th>
                <th className="px-1 py-1.5 text-[9px] text-slate-300 font-semibold text-center">★</th>
              </tr>
            </thead>
            <tbody>
              {allBench.map(({ p, abbr }) => {
                const pid     = p.person?.id
                const enriched = players.find((pl) => pl.id === pid) || null
                return (
                  <AdditionalPlayerRow
                    key={pid}
                    bsPlayer={p}
                    enriched={enriched}
                    teamAbbr={abbr}
                    starred={stars.includes(String(pid))}
                    onToggleStar={onToggleStar}
                  />
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function GameDetailView({ game, players, stars, onToggleStar, onDeselect }) {
  const [boxscore, setBoxscore]   = useState(null)
  const [bsLoading, setBsLoading] = useState(true)

  useEffect(() => {
    if (!game?.gamePk) return
    let cancelled = false

    async function load() {
      setBsLoading(true)
      const key  = `boxscore_${game.gamePk}`
      let data   = getCached(key)

      if (!data) {
        try {
          const res = await fetch(`/api/mlb/game/${game.gamePk}/boxscore`)
          if (res.ok) {
            data = await res.json()
            setCached(key, data, BOXSCORE_CACHE_TTL)
          }
        } catch { /* gracefully show "unavailable" state */ }
      }

      if (!cancelled) {
        setBoxscore(data || null)
        setBsLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [game?.gamePk])

  if (!game) return null

  return (
    <div>
      {/* Clear / deselect button */}
      <div className="flex justify-end mb-3">
        <button
          onClick={onDeselect}
          className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] border border-[var(--border)] rounded-lg px-3 py-1.5 transition-colors bg-[var(--bg-card)]"
        >
          ✕ Clear selection
        </button>
      </div>

      {/* Section 1: Pitcher Matchup */}
      <PitcherMatchup game={game} />

      {/* Section 2: Starting Lineups */}
      <StartingLineups
        game={game}
        boxscore={boxscore}
        players={players}
        stars={stars}
        onToggleStar={onToggleStar}
        loading={bsLoading}
      />

      {/* Section 3: Additional Players (collapsible) */}
      <AdditionalPlayers
        game={game}
        boxscore={boxscore}
        players={players}
        stars={stars}
        onToggleStar={onToggleStar}
      />
    </div>
  )
}
