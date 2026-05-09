/**
 * fangraphsData.js — FanGraphs data access layer (Supabase)
 *
 * All four exported functions cache their results in module-level variables.
 * Supabase is queried once per browser session — subsequent calls return cached data.
 * If Supabase returns empty data or errors, functions return {} / null
 * so the grade formulas fall back to proportional weight redistribution.
 *
 * Tables expected:
 *   fangraphs_batters  — columns: player_name, wrc_plus, updated_at
 *   fangraphs_pitchers — columns: player_name, xfip, siera, k_pct, bb_pct
 *   team_wrc_averages  — columns: team_abbr, wrc_plus, hard_pct, updated_at
 *
 * k_pct / bb_pct are stored as percentages (e.g. 25.3 for 25.3%), not decimals.
 */

import { getSupabaseClient } from './supabase'

// Session-level module cache — populated on first successful fetch
let _batters = null
let _pitchers = null
let _teamWrc = null
let _lastUpdated = null

async function query(table, select = '*') {
  const supabase = getSupabaseClient()
  if (!supabase) return null
  try {
    const { data, error } = await supabase.from(table).select(select)
    if (error || !data?.length) return null
    return data
  } catch {
    return null
  }
}

/**
 * Fetch all batter FanGraphs stats keyed by player_name.
 * Returns {} on error / empty result.
 */
export async function getFanGraphsBatters() {
  if (_batters !== null) return _batters
  const data = await query('fangraphs_batters')
  _batters = data ? Object.fromEntries(data.map((r) => [r.player_name, r])) : {}
  return _batters
}

/**
 * Fetch all pitcher FanGraphs stats keyed by player_name.
 * Returns {} on error / empty result.
 */
export async function getFanGraphsPitchers() {
  if (_pitchers !== null) return _pitchers
  const data = await query('fangraphs_pitchers')
  _pitchers = data ? Object.fromEntries(data.map((r) => [r.player_name, r])) : {}
  return _pitchers
}

/**
 * Fetch team wRC+ and Hard% averages keyed by team_abbr.
 * Returns {} on error / empty result.
 */
export async function getTeamWrcAverages() {
  if (_teamWrc !== null) return _teamWrc
  const data = await query('team_wrc_averages')
  _teamWrc = data ? Object.fromEntries(data.map((r) => [r.team_abbr, r])) : {}
  return _teamWrc
}

/**
 * Get last updated timestamp from fangraphs_batters table.
 * Returns null on error.
 */
export async function getFanGraphsLastUpdated() {
  if (_lastUpdated !== null) return _lastUpdated
  const supabase = getSupabaseClient()
  if (!supabase) return null
  try {
    const { data, error } = await supabase
      .from('fangraphs_batters')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
    if (error || !data?.length) return null
    _lastUpdated = data[0].updated_at
    return _lastUpdated
  } catch {
    return null
  }
}
