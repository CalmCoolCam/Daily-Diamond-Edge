'use client'
import { useState, useEffect } from 'react'
import PlayerHeadshot from '../ui/PlayerHeadshot'
import TeamLogo from '../ui/TeamLogo'
import TeamBadge from '../ui/TeamBadge'
import Sparkline from '../ui/Sparkline'
import StarButton from '../StarButton'
import { gradeColorHex, fmtERA, currentSeason } from '@/lib/mlbApi'
import { formatCSTTime } from '@/lib/utils'
import { getCached, setCached } from '@/lib/storage'
import { usePicks } from '@/hooks/usePicks'

const BOXSCORE_CACHE_TTL = 15 * 60 * 1000  // 15 minutes
const LEAGUE_AVG_ERA     = 4.00             // used for ERA+ approximation

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractPitcherStats(statsData) {
  const stat = statsData?.stats?.[0]?.splits?.[0]?.stat || {}
  return {
    era:   stat.era                != null ? parseFloat(stat.era)                : null,
    kPer9: stat.strikeoutsPer9Inn  != null ? parseFloat(stat.strikeoutsPer9Inn)  : null,
    whip:  stat.whip               != null ? parseFloat(stat.whip)               : null,
  }
}

function computeEraPlus(era) {
  if (!era || era <= 0) return null
  return Math.round(100 * LEAGUE_AVG_ERA / era)
}

// Green tint = favorable for batter, red tint = unfavorable
function statTint(val, type) {
  if (val == null) return ''
  switch (type) {
    case 'era':     return val >= 4.50 ? 'bg-green-50 text-green-700' : val <= 3.00 ? 'bg-red-50 text-red-700' : ''
    case 'eraPlus': return val <= 90   ? 'bg-green-50 text-green-700' : val >= 120  ? 'bg-red-50 text-red-700' : ''
    case 'whip':    return val >= 1.40 ? 'bg-green-50 text-green-700' : val <= 1.00 ? 'bg-red-50 text-red-700' : ''
    case 'k9':      return val <= 7.0  ? 'bg-green-50 text-green-700' : val >= 10.0 ? 'bg-red-50 text-red-700' : ''
    default:        return ''
  }
}

function StatCell({ label, value, tint }) {
  return (
    <div className={`text-center px-2 py-1.5 rounded-lg ${tint || 'bg-slate-50'}`}>
      <div className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5">{label}</div>
      <div className="text-sm font-bold tabular-nums text-slate-800">{value ?? '--'}</div>
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
          <PlayerHeadshot
            personId={pitcher.id}
            name={pitcher.fullName}
            teamAbbr={teamAbbr}
            height={72}
          />

          <div>
            <div className="font-bold text-sm text-slate-900 leading-tight px-1">
              {pitcher.fullName}
            </div>
            <div className="flex items-center justify-center gap-1 mt-1">
              <TeamLogo teamId={teamId} abbr={teamAbbr} size="sm" />
              <TeamBadge abbr={teamAbbr} size="xs" />
            </div>
          </div>

          {/* 2×2 stat grid */}
          <div className="grid grid-cols-2 gap-1.5 w-full">
            <StatCell label="ERA"  value={fmtERA(era)}       tint={statTint(era,     'era')}     />
            <StatCell label="ERA+" value={eraPlus ?? '--'}   tint={statTint(eraPlus, 'eraPlus')} />
            <StatCell label="WHIP" value={whip?.toFixed(2)}  tint={statTint(whip,    'whip')}    />
            <StatCell label="K/9"  value={kPer9?.toFixed(1)} tint={statTint(kPer9,   'k9')}      />
          </div>
        </>
      ) : (
        <>
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-300 text-2xl select-none">
            ?
          </div>
          <div>
            <div className="text-sm text-slate-400 italic">TBD</div>
            <div className="flex items-center justify-center gap-1 mt-1">
              <TeamLogo teamId={teamId} abbr={teamAbbr} size="sm" />
              <TeamBadge abbr={teamAbbr} size="xs" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5 w-full">
            {['ERA', 'ERA+', 'WHIP', 'K/9'].map((l) => (
              <StatCell key={l} label={l} value="--" />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Section 1: Pitcher Matchup card ──────────────────────────────────────────

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

      {/* Desktop: side by side  |  Mobile: stacked (away on top) */}
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
        <PitcherColumn
          pitcher={away?.probablePitcher}
          pitcherStats={awayPitcherStats}
          teamId={away?.team?.id}
          teamAbbr={away?.team?.abbreviation}
          label="Away Starter"
        />

        {/* "vs" divider + game time */}
        <div className="flex sm:flex-col items-center justify-center gap-1.5 px-3 sm:pt-10 flex-shrink-0">
          <span
            className="text-3xl font-black text-slate-200 leading-none"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >
            vs
          </span>
          {gameTime && (
            <span className="text-[10px] text-slate-400 whitespace-nowrap font-medium">{gameTime} CST</span>
          )}
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

// ── Section 2 + 3 placeholders (filled in Part 2) ────────────────────────────

function StartingLineups({ game, boxscore, players, stars, onToggleStar, loading }) {
  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] card-shadow p-4 mb-4">
      <div className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-3">
        Starting Lineups
      </div>
      {loading ? (
        <div className="flex gap-3 flex-wrap">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="skeleton h-8 w-full rounded" />
          ))}
        </div>
      ) : !boxscore ? (
        <div className="text-sm text-slate-400 text-center py-4 italic">
          Lineup data unavailable
        </div>
      ) : (
        <div className="text-sm text-slate-400 italic text-center py-2">Lineups loading…</div>
      )}
    </div>
  )
}

function AdditionalPlayers({ boxscore, players, stars, onToggleStar }) {
  return null
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
      const key = `boxscore_${game.gamePk}`
      let data = getCached(key)

      if (!data) {
        try {
          const res = await fetch(`/api/mlb/game/${game.gamePk}/boxscore`)
          if (res.ok) {
            data = await res.json()
            setCached(key, data, BOXSCORE_CACHE_TTL)
          }
        } catch { /* boxscore unavailable — handled gracefully below */ }
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

      {/* Section 2: Starting Lineups (stub — Part 2) */}
      <StartingLineups
        game={game}
        boxscore={boxscore}
        players={players}
        stars={stars}
        onToggleStar={onToggleStar}
        loading={bsLoading}
      />

      {/* Section 3: Additional Players (stub — Part 2) */}
      <AdditionalPlayers
        boxscore={boxscore}
        players={players}
        stars={stars}
        onToggleStar={onToggleStar}
      />
    </div>
  )
}
