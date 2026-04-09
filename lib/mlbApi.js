/**
 * mlbApi.js — MLB Stats API service layer
 *
 * All MLB API calls must go through Next.js API routes (server-side).
 * This file is used both by API routes (direct fetch to statsapi.mlb.com)
 * and by client components (fetch to /api/mlb/* proxy routes).
 *
 * Server-side: import { mlbFetch } from '@/lib/mlbApi'
 * Client-side: import { api } from '@/lib/mlbApi'
 *
 * ─── STAT FIELD REFERENCE ─────────────────────────────────────────────────────
 * H+R+RBI are always: stat.hits + stat.runs + stat.rbi
 *   • stat.runs  = runs scored         ← CORRECT (NOT stat.homeRuns)
 *   • stat.rbi   = runs batted in      ← CORRECT (NOT stat.rbis)
 *   • stat.hits  = base hits           ← CORRECT
 *
 * Live game batting stats path:
 *   liveData.boxscore.teams.{home|away}.players.{IDxxxxxx}.stats.batting
 *   NOT .seasonStats.batting — both exist, seasonStats is the season total
 *
 * Season stats path (via batch endpoint):
 *   stats[].type.displayName === 'season' → splits[0].stat.{hits, runs, rbi}
 *   Endpoint: GET /api/v1/people/{id}/stats?stats=season&group=hitting&season={year}
 *
 * Game log (7-day trend) path:
 *   stats[].type.displayName === 'gameLog' → splits[] (one entry per game, most recent first)
 *   Each split: split.stat.{hits, runs, rbi} — individual game line, NOT cumulative
 *   Endpoint: GET /api/v1/people/{id}/stats?stats=gameLog&group=hitting&season={year}
 * ──────────────────────────────────────────────────────────────────────────────
 */

const MLB_BASE = 'https://statsapi.mlb.com'

// In-memory server-side cache (separate from localStorage client cache)
const serverCache = new Map()
const SERVER_CACHE_TTL = 60_000 // 60 seconds

// ─── Server-side direct MLB API fetcher ──────────────────────────────────────

export async function mlbFetch(path, options = {}) {
  const url = `${MLB_BASE}${path}`
  const cacheKey = url

  const cached = serverCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < SERVER_CACHE_TTL) {
    return cached.data
  }

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 60 },
      ...options,
    })
    if (!res.ok) throw new Error(`MLB API ${res.status}: ${path}`)
    const data = await res.json()
    serverCache.set(cacheKey, { data, ts: Date.now() })
    return data
  } catch (err) {
    throw new Error(`MLB API fetch failed: ${err.message}`)
  }
}

// ─── Client-side proxy API caller ────────────────────────────────────────────

async function apiFetch(route, params = {}) {
  const qs = new URLSearchParams(params).toString()
  const url = `/api/mlb${route}${qs ? `?${qs}` : ''}`
  const res = await fetch(url)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error || `API ${res.status}`)
  }
  return res.json()
}

/** Client-side API calls — all go through Next.js proxy routes */
export const api = {
  /** Today's schedule with linescore and team info */
  getSchedule(date) {
    return apiFetch('/schedule', date ? { date } : {})
  },

  /** Live game feed with boxscore — use /api/mlb/game/{pk}/feed */
  getGameFeed(gamePk) {
    return apiFetch(`/game/${gamePk}/feed`)
  },

  /**
   * Compact live batting stats for all of today's games.
   * Returns { games: { [gamePk]: { status, home: {[pid]: {h,r,rbi,ab}}, away: {...} } } }
   * Source: liveData.boxscore.teams.{home|away}.players.{IDxxxxxx}.stats.batting
   *         Fields used: hits (H), runs (R), rbi (RBI) — NOT homeRuns, NOT seasonStats
   */
  getLiveStats(date) {
    return apiFetch('/games/live-stats', date ? { date } : {})
  },

  /** Season hitting stats for a player */
  getPlayerSeasonStats(personId, season) {
    return apiFetch(`/player/${personId}/stats`, { season, group: 'hitting' })
  },

  /**
   * Game-by-game hitting log — used for 7-day sparkline and yesterday's line.
   * Splits are most-recent-first. Each split.stat is a single game's line.
   * Fields: split.stat.hits (H) + split.stat.runs (R) + split.stat.rbi (RBI)
   * NOT cumulative totals — individual game entries only.
   * Endpoint: /api/v1/people/{id}/stats?stats=gameLog&group=hitting&season={year}
   */
  getPlayerGameLog(personId, season) {
    return apiFetch(`/player/${personId}/gamelog`, { season, group: 'hitting' })
  },

  /** Season pitching stats for a player */
  getPitcherSeasonStats(personId, season) {
    return apiFetch(`/player/${personId}/stats`, { season, group: 'pitching' })
  },

  /** Active roster for a team */
  getTeamRoster(teamId) {
    return apiFetch(`/team/${teamId}/roster`)
  },

  /** Today's probable pitchers */
  getProbablePitchers(date) {
    return apiFetch('/pitchers', date ? { date } : {})
  },

  /**
   * Batch season + gameLog stats for multiple players.
   * Returns { players: [{ personId, data: { stats: [season, gameLog] } }] }
   * Season stats: data.stats[].type.displayName === 'season' → splits[0].stat
   *   Fields: stat.hits (season H), stat.runs (season R), stat.rbi (season RBI)
   * Game log: data.stats[].type.displayName === 'gameLog' → splits[] per game
   *   Fields per game: split.stat.hits + split.stat.runs + split.stat.rbi
   */
  getBatchPlayerStats(personIds, season) {
    return apiFetch('/players/batch', {
      ids: personIds.join(','),
      season,
    })
  },
}

// ─── Date / season helpers ────────────────────────────────────────────────────

/** Returns today's date in YYYY-MM-DD format (CST timezone) */
export function todayStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
}

/** Returns the current MLB season year */
export function currentSeason() {
  return new Date().getFullYear()
}

// ─── Matchup grade helpers ────────────────────────────────────────────────────

/** Computes a matchup letter grade from starter ERA and bullpen ERA */
export function computeMatchupGrade(starterERA, bullpenERA) {
  // 60% starter weight, 40% bullpen weight. League avg ERA ~4.00.
  const combined = starterERA * 0.6 + bullpenERA * 0.4
  if (combined <= 2.5) return 'A'
  if (combined <= 3.2) return 'B'
  if (combined <= 4.0) return 'C'
  if (combined <= 5.0) return 'D'
  return 'F'
}

/** Grade text color for light theme */
export function gradeColor(grade) {
  switch (grade) {
    case 'A': return 'text-green-600'
    case 'B': return 'text-blue-700'
    case 'C': return 'text-amber-600'
    case 'D': return 'text-orange-500'
    case 'F': return 'text-red-600'
    default:  return 'text-slate-400'
  }
}

/** Grade background + border for light theme */
export function gradeBgColor(grade) {
  switch (grade) {
    case 'A': return 'bg-green-50 border-green-200'
    case 'B': return 'bg-blue-50 border-blue-200'
    case 'C': return 'bg-amber-50 border-amber-200'
    case 'D': return 'bg-orange-50 border-orange-200'
    case 'F': return 'bg-red-50 border-red-200'
    default:  return 'bg-white border-slate-200'
  }
}

// ─── Heat tier system (4 tiers, relative ranking) ────────────────────────────
//
// Tiers are computed from the FULL active player list, not fixed thresholds.
// Call computePlayerTiers(players) at the data layer and attach .heatTier to each player.
// Components should use player.heatTier directly — do not re-compute per component.
//
// Tier 1 — ON FIRE: top 5 players by 7-day total (🔥 flame displayed)
// Tier 2 — HOT:     above the daily median 7-day total
// Tier 3 — WARM:    within 20% below median
// Tier 4 — COLD:    below that threshold

export const TIER_CONFIG = {
  1: {
    label: 'On Fire',
    sparklineColor: '#16a34a',   // bright green
    sparklineWidth: 2,
    dotClass: 'bg-green-700',
    dotGlow: '0 0 6px #16a34a',
    flame: true,
  },
  2: {
    label: 'Hot',
    sparklineColor: '#22c55e',   // green
    sparklineWidth: 1.5,
    dotClass: 'bg-green-500',
    dotGlow: null,
    flame: false,
  },
  3: {
    label: 'Warm',
    sparklineColor: '#f59e0b',   // amber
    sparklineWidth: 1.5,
    dotClass: 'bg-amber-400',
    dotGlow: null,
    flame: false,
  },
  4: {
    label: 'Cold',
    sparklineColor: '#93c5fd',   // light blue (NOT red)
    sparklineWidth: 1.5,
    dotClass: 'bg-blue-300',
    dotGlow: null,
    flame: false,
  },
}

/**
 * Computes heat tier (1–4) for each player in the list based on relative ranking.
 * Returns a Map<playerId, tier>.
 * Call this once at the data layer after enrichment; attach result as player.heatTier.
 */
export function computePlayerTiers(players) {
  if (!players.length) return {}

  const withStats = players.filter((p) => (p.last7Total || 0) > 0)
  if (!withStats.length) return Object.fromEntries(players.map((p) => [p.id, 4]))

  const sorted = [...withStats].sort((a, b) => (b.last7Total || 0) - (a.last7Total || 0))
  const vals = sorted.map((p) => p.last7Total || 0)
  const median = vals[Math.floor(vals.length / 2)] || 0
  const tier3Threshold = median * 0.8

  // Top 5 players by rank (exact top-5, not threshold-based)
  const tier1Ids = new Set(sorted.slice(0, 5).map((p) => p.id))

  const result = {}
  players.forEach((p) => {
    const v = p.last7Total || 0
    if (tier1Ids.has(p.id) && v > 0) result[p.id] = 1
    else if (v >= median && median > 0) result[p.id] = 2
    else if (v >= tier3Threshold && tier3Threshold > 0) result[p.id] = 3
    else result[p.id] = 4
  })
  return result
}

/** Returns the player display name, appending 🔥 for Tier 1 */
export function playerDisplayName(name, heatTier) {
  return heatTier === 1 ? `${name} 🔥` : name
}

/** Legacy helper — use heatTier from player object instead where possible */
export function computeHeat(total7Day) {
  if (total7Day >= 12) return 'hot'
  if (total7Day >= 6) return 'warm'
  return 'cold'
}

// ─── Sparkline data extraction ────────────────────────────────────────────────

/**
 * Builds sparkline number array from game log splits.
 *
 * FIELD PATH: splits[].stat.hits + splits[].stat.runs + splits[].stat.rbi
 * Source: /api/v1/people/{id}/stats?stats=gameLog&group=hitting
 * Each entry is ONE game's line — NOT a cumulative total.
 * Splits come most-recent-first from MLB API; we reverse for left→right chronology.
 */
export function extractSparklineData(gameLogStats, limit = 7) {
  if (!gameLogStats || !Array.isArray(gameLogStats)) return []
  return gameLogStats
    .slice(0, limit)
    .reverse()
    .map((g) => {
      const s = g.stat || {}
      // H + R + RBI: using stat.hits, stat.runs (NOT stat.homeRuns), stat.rbi
      return (s.hits || 0) + (s.runs || 0) + (s.rbi || 0)
    })
}

/** Formats ERA to 2 decimal places, returns '--' if null/NaN */
export function fmtERA(era) {
  if (era == null || isNaN(era)) return '--'
  return parseFloat(era).toFixed(2)
}

/** Formats a stat, returns 0 if null */
export function fmtStat(val) {
  return val ?? 0
}
