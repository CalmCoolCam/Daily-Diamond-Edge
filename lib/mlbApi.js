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

function clamp(val, min, max) { return Math.min(Math.max(val, min), max) }

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

/**
 * Returns the 7-calendar-day date range for game log queries.
 *
 * Uses CST timezone throughout.
 * startDate = today minus 7 calendar days in CST
 * endDate   = yesterday in CST
 *
 * Endpoint: GET /api/v1/people/{id}/stats?stats=gameLog&group=hitting
 *           &season={year}&startDate={startDate}&endDate={endDate}
 *
 * The returned splits contain every game played in that window.
 * If a player had a doubleheader, both entries are included.
 * Sum hits + runs + rbi across ALL returned splits for the 7-day total.
 * NOTE: stat.runs is used, NOT stat.homeRuns.
 */
export function get7DayDateRange() {
  const nowCST = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }))

  const yesterday = new Date(nowCST)
  yesterday.setDate(yesterday.getDate() - 1)

  const sevenDaysAgo = new Date(nowCST)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const fmt = (d) => d.toLocaleDateString('en-CA') // YYYY-MM-DD
  return { startDate: fmt(sevenDaysAgo), endDate: fmt(yesterday) }
}

// ─── Matchup grade helpers ────────────────────────────────────────────────────

/**
 * Legacy simple grade — kept for MatchupGrades card header when full data not available.
 * Uses starter + bullpen ERA only.
 */
export function computeMatchupGrade(starterERA, bullpenERA) {
  const combined = starterERA * 0.6 + bullpenERA * 0.4
  if (combined <= 2.5) return 'A'
  if (combined <= 3.2) return 'B'
  if (combined <= 4.0) return 'C'
  if (combined <= 5.0) return 'D'
  return 'F'
}

/**
 * Computes a 0–100 composite matchup score using up to 5 weighted components.
 * Missing components (e.g. no h2h data) have their weight redistributed
 * proportionally across remaining components.
 *
 * Inputs:
 *   starterSeason  — { era, kPer9, whip }          (component 2, 25%)
 *   batterForm     — last7Total number             (component 3, 25%)
 *   bullpenERA     — number                        (component 4, 15%)
 *   lastStartsAvg  — { era, whip, kPer9 } averaged (component 5, 5%)
 *   vsPlayer       — { ab, h, hr, rbi, sufficient } (component 1, 30%)
 *
 * Returns { score, components }
 */
export function computeCompositeMatchupScore({
  starterSeason = null,
  batterForm    = 0,
  bullpenERA    = 4.5,
  lastStartsAvg = null,
  vsPlayer      = null,
}) {
  // League season averages used for normalization
  const AVG_ERA  = 4.00
  const AVG_K9   = 8.50
  const AVG_WHIP = 1.30

  function normERA(era)  { return clamp((era - 1.5) / (7.0 - 1.5), 0, 1)  }  // higher ERA → higher score (better for batter)
  function normK9(k9)    { return clamp((k9  - 4.0) / (14.0 - 4.0), 0, 1) }  // higher K/9 → higher raw → worse for batter
  function normWHIP(w)   { return clamp((w   - 0.7) / (2.2  - 0.7), 0, 1)  } // higher WHIP → higher score (better for batter)

  function starterScore(s) {
    if (!s) return 50
    const eraScore  = normERA(s.era   ?? AVG_ERA)   * 100
    const k9Score   = (1 - normK9(s.kPer9 ?? AVG_K9))  * 100  // invert: high K/9 is bad for batter
    const whipScore = normWHIP(s.whip  ?? AVG_WHIP)  * 100
    return (eraScore + k9Score + whipScore) / 3
  }

  // Component 2: starter season stats (25%)
  const c2Score = starterScore(starterSeason)
  const c2Weight = 25

  // Component 3: batter 7-day form (25%) — normalize to 0-100, max useful ~20
  const c3Score  = clamp((batterForm / 18) * 100, 0, 100)
  const c3Weight = 25

  // Component 4: bullpen ERA (15%) — higher bullpen ERA = better for batter
  const c4Score  = normERA(bullpenERA) * 100
  const c4Weight = 15

  // Component 5: pitcher last 3 starts avg (5%)
  const c5Score  = lastStartsAvg ? starterScore(lastStartsAvg) : null
  const c5Weight = 5

  // Component 1: batter vs pitcher h2h (30%)
  let c1Score  = null
  const c1Weight = 30
  const h2hSufficient = vsPlayer?.sufficient === true
  if (h2hSufficient && vsPlayer) {
    const avgVal = vsPlayer.ab > 0 ? (vsPlayer.h / vsPlayer.ab) : 0
    const avgScore = clamp(avgVal / 0.400, 0, 1) * 70
    const hrBonus  = clamp(vsPlayer.hr * 7, 0, 20)
    const rbiBonus = clamp((vsPlayer.rbi / Math.max(vsPlayer.ab, 1)) * 30, 0, 10)
    c1Score = Math.min(avgScore + hrBonus + rbiBonus, 100)
  }

  // Collect available components and redistribute missing weight
  const available = [
    { score: c1Score,                             weight: c1Weight },
    { score: c2Score,                             weight: c2Weight },
    { score: c3Score,                             weight: c3Weight },
    { score: c4Score,                             weight: c4Weight },
    { score: c5Score != null ? c5Score : null,    weight: c5Weight },
  ]

  const totalAvailableWeight = available.reduce((s, c) => s + (c.score != null ? c.weight : 0), 0)
  const composite = totalAvailableWeight > 0
    ? available.reduce((s, c) => {
        if (c.score == null) return s
        const adjustedWeight = c.weight / totalAvailableWeight
        return s + c.score * adjustedWeight
      }, 0)
    : 50

  return {
    score: Math.round(composite),
    components: {
      h2h:        { score: c1Score,  weight: c1Weight, sufficient: h2hSufficient },
      starter:    { score: c2Score,  weight: c2Weight },
      batterForm: { score: c3Score,  weight: c3Weight },
      bullpen:    { score: c4Score,  weight: c4Weight },
      lastStarts: { score: c5Score,  weight: c5Weight },
    },
  }
}

/**
 * Converts an array of composite scores to percentile-based letter grades.
 * Returns a Map from index to grade letter.
 * A=top 15%, B=15-35%, C=35-65%, D=65-85%, F=bottom 15%
 */
export function scoreToGrade(score, allScores) {
  if (!allScores || allScores.length === 0) return scoreToGradeSimple(score)
  const sorted = [...allScores].sort((a, b) => b - a)
  const n      = sorted.length
  const rank   = sorted.findIndex((s) => s <= score) // how many players have score >= this
  const pct    = (rank / n) * 100  // percentile from top
  if (pct <= 15)  return 'A'
  if (pct <= 35)  return 'B'
  if (pct <= 65)  return 'C'
  if (pct <= 85)  return 'D'
  return 'F'
}

function scoreToGradeSimple(score) {
  if (score >= 72) return 'A'
  if (score >= 58) return 'B'
  if (score >= 42) return 'C'
  if (score >= 28) return 'D'
  return 'F'
}

/**
 * Computes a provisional matchup grade for a player using only data already
 * available in the player+game objects (components 2, 3, 4).
 * Used during initial enrichment so grade column works without lazy loading.
 */
export function computeProvisionalGrade(player, game) {
  if (!game) return '--'

  const isHome = player.isHome
  // Batter faces the opposing team's pitcher
  const pitcherStats = isHome
    ? game.awayPitcherStats?.stats?.[0]?.splits?.[0]?.stat || {}
    : game.homePitcherStats?.stats?.[0]?.splits?.[0]?.stat || {}
  const bullpenERA = isHome
    ? (parseFloat(game.teams?.away?.team?.bullpenERA) || 4.5)
    : (parseFloat(game.teams?.home?.team?.bullpenERA) || 4.5)

  const starterSeason = {
    era:   parseFloat(pitcherStats.era)                || 4.5,
    kPer9: parseFloat(pitcherStats.strikeoutsPer9Inn)  || 8.5,
    whip:  parseFloat(pitcherStats.whip)               || 1.30,
  }

  const { score } = computeCompositeMatchupScore({
    starterSeason,
    batterForm: player.last7Total || 0,
    bullpenERA,
  })

  return scoreToGradeSimple(score)
}

/** Grade hex color (for inline style use) */
export function gradeColorHex(grade) {
  switch (grade) {
    case 'A': return '#16a34a'
    case 'B': return '#3b82f6'
    case 'C': return '#f59e0b'
    case 'D': return '#f97316'
    case 'F': return '#dc2626'
    default:  return '#94a3b8'
  }
}

/** Grade text color for light theme */
export function gradeColor(grade) {
  switch (grade) {
    case 'A': return 'text-green-600'
    case 'B': return 'text-blue-500'
    case 'C': return 'text-amber-500'
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

/**
 * Computes heat tiers (1–4) for a specific stat category across all players.
 * For STRIKEOUTS the tier meaning is reversed (high = warning).
 *
 * @param {object[]} players  — player list
 * @param {string}   category — 'hrbi'|'hits'|'runs'|'hr'|'walks'|'sb'|'strikeouts'
 * @param {string}   context  — 'today'|'7day'
 * Returns a plain object { [playerId]: tier }
 */
export function computeCategoryTiers(players, category = 'hrbi', context = 'today') {
  function statFor(p) {
    if (context === 'today') {
      switch (category) {
        case 'hits':       return p.todayH   || 0
        case 'runs':       return p.todayR   || 0
        case 'hr':         return p.todayHR  || 0
        case 'walks':      return p.todayBB  || 0
        case 'sb':         return p.todaySB  || 0
        case 'strikeouts': return p.todaySO  || 0
        default:           return (p.todayH || 0) + (p.todayR || 0) + (p.todayRBI || 0)
      }
    } else {
      switch (category) {
        case 'hits':       return p.last7Hits || 0
        case 'runs':       return p.last7Runs || 0
        case 'hr':         return p.last7HR   || 0
        case 'walks':      return p.last7BB   || 0
        case 'sb':         return p.last7SB   || 0
        case 'strikeouts': return p.last7SO   || 0
        default:           return p.last7Total || 0
      }
    }
  }

  if (!players.length) return {}

  const withStats = players.filter((p) => statFor(p) > 0)
  if (!withStats.length) return Object.fromEntries(players.map((p) => [p.id, 4]))

  const sorted = [...withStats].sort((a, b) => statFor(b) - statFor(a))
  const vals   = sorted.map((p) => statFor(p))
  const median = vals[Math.floor(vals.length / 2)] || 0
  const tier3Threshold = median * 0.8
  const tier1Ids = new Set(sorted.slice(0, 5).map((p) => p.id))

  const result = {}
  players.forEach((p) => {
    const v = statFor(p)
    if (category === 'strikeouts') {
      // Reversed: high SO = warning (tier 1 means worst for batter = highest K's)
      if (tier1Ids.has(p.id) && v > 0) result[p.id] = 1
      else if (v >= median && median > 0)  result[p.id] = 2
      else if (v >= tier3Threshold && tier3Threshold > 0) result[p.id] = 3
      else result[p.id] = 4
    } else {
      if (tier1Ids.has(p.id) && v > 0) result[p.id] = 1
      else if (v >= median && median > 0)  result[p.id] = 2
      else if (v >= tier3Threshold && tier3Threshold > 0) result[p.id] = 3
      else result[p.id] = 4
    }
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
