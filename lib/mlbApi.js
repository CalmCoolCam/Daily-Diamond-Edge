/**
 * mlbApi.js — MLB Stats API service layer
 *
 * All MLB API calls must go through Next.js API routes (server-side).
 * This file is used both by API routes (direct fetch to statsapi.mlb.com)
 * and by client components (fetch to /api/mlb/* proxy routes).
 *
 * Server-side: import { mlbFetch } from '@/lib/mlbApi'
 * Client-side: import { api } from '@/lib/mlbApi'
 */

const MLB_BASE = 'https://statsapi.mlb.com'

// In-memory server-side cache (separate from localStorage client cache)
const serverCache = new Map()
const SERVER_CACHE_TTL = 60_000 // 60 seconds

// ─── Server-side direct MLB API fetcher ──────────────────────────────────────

export async function mlbFetch(path, options = {}) {
  const url = `${MLB_BASE}${path}`
  const cacheKey = url

  // Check server cache
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

  /** Live game feed with boxscore */
  getGameFeed(gamePk) {
    return apiFetch(`/game/${gamePk}/feed`)
  },

  /** Season hitting stats for a player */
  getPlayerSeasonStats(personId, season) {
    return apiFetch(`/player/${personId}/stats`, { season, group: 'hitting' })
  },

  /** Game-by-game hitting log for sparkline (last 7 games) */
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

  /** Batch player stats (returns array) */
  getBatchPlayerStats(personIds, season) {
    return apiFetch('/players/batch', {
      ids: personIds.join(','),
      season,
    })
  },
}

// ─── Shared data transformation helpers ──────────────────────────────────────

/** Extracts today's date in YYYY-MM-DD format */
export function todayStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
}

export function currentSeason() {
  const cstDate = new Date().toLocaleDateString('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  // If before April 3am CST, still consider previous year's season in edge cases
  return new Date().getFullYear()
}

/** Computes a matchup letter grade from starter ERA and bullpen ERA */
export function computeMatchupGrade(starterERA, bullpenERA) {
  // League average ERA ~4.00; grade relative to that
  const combined = starterERA * 0.6 + bullpenERA * 0.4
  if (combined <= 2.5) return 'A'
  if (combined <= 3.2) return 'B'
  if (combined <= 4.0) return 'C'
  if (combined <= 5.0) return 'D'
  return 'F'
}

export function gradeColor(grade) {
  switch (grade) {
    case 'A': return 'text-green-400'
    case 'B': return 'text-blue-400'
    case 'C': return 'text-gold-500'
    case 'D': return 'text-orange-400'
    case 'F': return 'text-red-500'
    default:  return 'text-gray-400'
  }
}

export function gradeBgColor(grade) {
  switch (grade) {
    case 'A': return 'bg-green-900/40 border-green-700'
    case 'B': return 'bg-blue-900/40 border-blue-700'
    case 'C': return 'bg-yellow-900/40 border-yellow-700'
    case 'D': return 'bg-orange-900/40 border-orange-700'
    case 'F': return 'bg-red-900/40 border-red-700'
    default:  return 'bg-navy-800 border-navy-600'
  }
}

/** Computes heat indicator from H+R+RBI over last 7 games */
export function computeHeat(total7Day) {
  if (total7Day >= 12) return 'hot'   // ≥12 combined
  if (total7Day >= 6)  return 'warm'  // ≥6
  return 'cold'
}

/** Formats a player's 7-day sparkline data from game log entries */
export function extractSparklineData(gameLogStats, limit = 7) {
  if (!gameLogStats || !Array.isArray(gameLogStats)) return []
  return gameLogStats
    .slice(0, limit)
    .reverse()
    .map((g) => {
      const s = g.stat || {}
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
