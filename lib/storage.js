/**
 * storage.js — Abstracted localStorage utility for Daily Diamond Edge
 *
 * All localStorage interactions go through this file so swapping to
 * Supabase / Firebase later only requires changing this one file.
 *
 * Key schema:
 *   dde_stars_{YYYY-MM-DD}   → string[]  (player IDs starred today in CST)
 *   dde_picks                → { "playerName_teamAbbr": number }  (season pick counts)
 *   dde_cache_{key}          → { data, ts }  (API response cache)
 */

const CACHE_TTL_MS = 60_000 // 60 seconds

// ─── CST Date helpers ─────────────────────────────────────────────────────────

/** Returns today's date string in YYYY-MM-DD using CST (America/Chicago) */
export function getCSTDateString(date = new Date()) {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
}

/**
 * Returns the CST hour (0–23) right now.
 * Stars reset at 3am CST.
 */
export function getCSTHour(date = new Date()) {
  return parseInt(
    date.toLocaleString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', hour12: false }),
    10,
  )
}

/** Returns the CST date string that should be active (considering 3am reset) */
export function getActiveCSTDate() {
  const now = new Date()
  const cstHour = getCSTHour(now)
  // Before 3am CST, "today" is still yesterday's game date
  if (cstHour < 3) {
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    return getCSTDateString(yesterday)
  }
  return getCSTDateString(now)
}

// ─── Safe localStorage wrappers ───────────────────────────────────────────────

function getItem(key) {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function setItem(key, value) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, value)
  } catch {
    // Storage quota exceeded or private mode — silently ignore
  }
}

function removeItem(key) {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(key)
  } catch {}
}

// ─── Stars (daily, resets at 3am CST) ────────────────────────────────────────

const STARS_PREFIX = 'dde_stars_'
const MAX_STARS = 10

function starsKey(dateStr) {
  return `${STARS_PREFIX}${dateStr}`
}

/** Cleans up stale star entries from previous days */
export function pruneOldStars() {
  if (typeof window === 'undefined') return
  const activeDate = getActiveCSTDate()
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(STARS_PREFIX) && k !== starsKey(activeDate))
      .forEach((k) => localStorage.removeItem(k))
  } catch {}
}

/** Returns the array of starred player IDs for today */
export function getStars() {
  const raw = getItem(starsKey(getActiveCSTDate()))
  if (!raw) return []
  try {
    return JSON.parse(raw)
  } catch {
    return []
  }
}

/** Returns true if the player is currently starred */
export function isStarred(playerId) {
  return getStars().includes(String(playerId))
}

/**
 * Toggles star for a player. Returns { starred: bool, count: number }.
 * On star (not un-star), also increments the season pick counter.
 */
export function toggleStar(playerId, playerMeta = {}) {
  const id = String(playerId)
  const stars = getStars()
  const idx = stars.indexOf(id)

  if (idx !== -1) {
    // Un-star
    stars.splice(idx, 1)
    setItem(starsKey(getActiveCSTDate()), JSON.stringify(stars))
    return { starred: false, count: stars.length }
  }

  if (stars.length >= MAX_STARS) {
    return { starred: false, count: stars.length, limitReached: true }
  }

  // Star — also increment season pick counter
  stars.push(id)
  setItem(starsKey(getActiveCSTDate()), JSON.stringify(stars))
  if (playerMeta.name && playerMeta.teamAbbr) {
    incrementPick(playerMeta.name, playerMeta.teamAbbr)
  }
  return { starred: true, count: stars.length }
}

export function getStarCount() {
  return getStars().length
}

// ─── Season pick counter ──────────────────────────────────────────────────────

const PICKS_KEY = 'dde_picks'

/** Returns the full picks object { "playerName_teamAbbr": count } */
export function getPicks() {
  const raw = getItem(PICKS_KEY)
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

/** Returns pick count for a specific player */
export function getPickCount(name, teamAbbr) {
  const key = `${name}_${teamAbbr}`
  return getPicks()[key] || 0
}

/** Increments the season pick counter for a player */
export function incrementPick(name, teamAbbr) {
  const key = `${name}_${teamAbbr}`
  const picks = getPicks()
  picks[key] = (picks[key] || 0) + 1
  setItem(PICKS_KEY, JSON.stringify(picks))
  return picks[key]
}

/**
 * Returns sorted leaderboard of most-picked players.
 * [{ key, name, teamAbbr, count }, ...]
 */
export function getPicksLeaderboard() {
  const picks = getPicks()
  return Object.entries(picks)
    .map(([key, count]) => {
      const lastUnderscore = key.lastIndexOf('_')
      return {
        key,
        name: key.slice(0, lastUnderscore),
        teamAbbr: key.slice(lastUnderscore + 1),
        count,
      }
    })
    .sort((a, b) => b.count - a.count)
}

// ─── API response cache ───────────────────────────────────────────────────────

const CACHE_PREFIX = 'dde_cache_'

export function getCached(key) {
  const raw = getItem(`${CACHE_PREFIX}${key}`)
  if (!raw) return null
  try {
    const { data, ts, ttl } = JSON.parse(raw)
    if (Date.now() - ts < (ttl ?? CACHE_TTL_MS)) return data
    removeItem(`${CACHE_PREFIX}${key}`)
    return null
  } catch {
    return null
  }
}

export function setCached(key, data, ttlMs = CACHE_TTL_MS) {
  setItem(`${CACHE_PREFIX}${key}`, JSON.stringify({ data, ts: Date.now(), ttl: ttlMs }))
}

// ─── Future: group mode placeholder ──────────────────────────────────────────
// TODO: Replace storage functions with Supabase/Firebase calls for multi-user
// group mode. The /api/group route will handle shared picks and leaderboards.
// export async function syncGroupPicks(groupId) { /* future implementation */ }
