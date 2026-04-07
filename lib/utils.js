/**
 * utils.js — Shared utility functions for Daily Diamond Edge
 */

/** Formats a Date to 12-hour time in CST */
export function formatCSTTime(dateStr) {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      timeZone: 'America/Chicago',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return ''
  }
}

/** Formats a Date to short date in CST (Mon, Apr 7) */
export function formatCSTDate(dateStr) {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      timeZone: 'America/Chicago',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return ''
  }
}

/** Returns "Today" or a short date label */
export function getTodayLabel() {
  return new Date().toLocaleDateString('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

/** Clamps a value between min and max */
export function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max)
}

/** Returns relative time label (e.g. "2m ago") */
export function timeAgo(date) {
  if (!date) return ''
  const seconds = Math.floor((Date.now() - new Date(date)) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  return `${Math.floor(seconds / 3600)}h ago`
}

/** Debounce helper */
export function debounce(fn, ms) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}

/** Returns team abbreviation color class (rough mapping) */
export function teamColorClass(abbr) {
  const map = {
    NYY: 'text-gray-300',   BOS: 'text-red-500',    TOR: 'text-blue-500',
    BAL: 'text-orange-500', TBR: 'text-blue-300',   CLE: 'text-red-400',
    CWS: 'text-white',      DET: 'text-orange-400', KCR: 'text-blue-400',
    MIN: 'text-red-400',    HOU: 'text-orange-400', LAA: 'text-red-500',
    OAK: 'text-green-500',  SEA: 'text-teal-400',   TEX: 'text-blue-500',
    ATL: 'text-blue-400',   MIA: 'text-teal-400',   NYM: 'text-blue-400',
    PHI: 'text-red-500',    WSN: 'text-red-400',    CHC: 'text-blue-400',
    CIN: 'text-red-500',    MIL: 'text-gold-500',   PIT: 'text-yellow-400',
    STL: 'text-red-500',    ARI: 'text-red-500',    COL: 'text-purple-400',
    LAD: 'text-blue-500',   SDP: 'text-yellow-400', SFG: 'text-orange-500',
  }
  return map[abbr] || 'text-white'
}

/** Pluralize helper */
export function plural(n, word) {
  return n === 1 ? `${n} ${word}` : `${n} ${word}s`
}

/** Safe JSON parse */
export function safeJson(str, fallback = null) {
  try { return JSON.parse(str) }
  catch { return fallback }
}

/** Returns inning ordinal (1st, 2nd, 3rd, 4th, ...) */
export function inningOrdinal(n) {
  if (!n) return ''
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`
}

/** Extracts initials from a full name */
export function initials(name = '') {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}
