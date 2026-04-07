'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { api, computeMatchupGrade, computeHeat, extractSparklineData } from '@/lib/mlbApi'
import { getCached, setCached } from '@/lib/storage'

const REFRESH_INTERVAL = 60_000 // 60 seconds for live data

// ─── Helper: normalize a game feed player into a unified row ─────────────────

function normalizePlayer(player, boxscore, game, probablePitchers) {
  const teamAbbr = player.parentTeamId === game.teams?.home?.team?.id
    ? game.teams?.home?.team?.abbreviation
    : game.teams?.away?.team?.abbreviation

  const opponentAbbr = player.parentTeamId === game.teams?.home?.team?.id
    ? game.teams?.away?.team?.abbreviation
    : game.teams?.home?.team?.abbreviation

  const stats = player.stats?.batting || {}
  const seasonStats = player.seasonStats?.batting || {}

  return {
    id: player.person?.id,
    name: player.person?.fullName || '',
    teamId: player.parentTeamId,
    teamAbbr: teamAbbr || '',
    opponentAbbr: opponentAbbr || '',
    position: player.position?.abbreviation || '',
    gamePk: game.gamePk,
    gameStatus: game.status?.abstractGameState,
    isHome: player.parentTeamId === game.teams?.home?.team?.id,
    // Today's game stats
    todayH: stats.hits || 0,
    todayR: stats.runs || 0,
    todayRBI: stats.rbi || 0,
    todayAB: stats.atBats || 0,
    todayTotal: (stats.hits || 0) + (stats.runs || 0) + (stats.rbi || 0),
    // Season stats
    seasonH: seasonStats.hits || 0,
    seasonR: seasonStats.runs || 0,
    seasonRBI: seasonStats.rbi || 0,
    seasonTotal: (seasonStats.hits || 0) + (seasonStats.runs || 0) + (seasonStats.rbi || 0),
    // Will be filled in later with game log data
    sparkline: [],
    last7Total: 0,
    yesterdayH: 0,
    yesterdayR: 0,
    yesterdayRBI: 0,
    heat: 'cold',
    matchupGrade: '--',
  }
}

// ─── useSchedule: fetches today's schedule/scorecard data ───────────────────

export function useSchedule(date) {
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastRefresh, setLastRefresh] = useState(null)

  const fetch = useCallback(async () => {
    const cacheKey = `schedule_${date || 'today'}`
    const cached = getCached(cacheKey)
    if (cached) {
      setGames(cached)
      setLoading(false)
      return
    }

    try {
      setError(null)
      const data = await api.getSchedule(date)
      const gameList = data?.dates?.[0]?.games || []
      setGames(gameList)
      setCached(cacheKey, gameList)
      setLastRefresh(new Date())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { games, loading, error, refresh: fetch, lastRefresh }
}

// ─── useGameFeed: fetches live game feed for a single gamePk ─────────────────

export function useGameFeed(gamePk, enabled = true) {
  const [feed, setFeed] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetch = useCallback(async () => {
    if (!gamePk || !enabled) return
    try {
      setError(null)
      const data = await api.getGameFeed(gamePk)
      setFeed(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [gamePk, enabled])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { feed, loading, error, refresh: fetch }
}

// ─── useTodayData: aggregated hook for all today's games + player data ───────

export function useTodayData(date) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastRefresh, setLastRefresh] = useState(null)
  const intervalRef = useRef(null)
  const isLiveRef = useRef(false)

  const fetchData = useCallback(async (showLoading = true) => {
    const cacheKey = `today_games_${date || 'today'}`
    const cached = getCached(cacheKey)
    if (cached && showLoading) {
      setData(cached)
      setLoading(false)
      return
    }

    if (showLoading) setLoading(true)
    try {
      setError(null)
      const params = date ? `?date=${date}` : ''
      const res = await fetch(`/api/mlb/games/today${params}`)
      if (!res.ok) throw new Error('Failed to load game data')
      const json = await res.json()

      // Check if any games are live
      isLiveRef.current = json.games?.some(
        (g) => g.status?.abstractGameState === 'Live'
      ) || false

      setData(json)
      setCached(cacheKey, json)
      setLastRefresh(new Date())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [date])

  // Auto-refresh every 60s when live games are active
  useEffect(() => {
    fetchData(true)

    intervalRef.current = setInterval(() => {
      if (isLiveRef.current) {
        fetchData(false)
      }
    }, REFRESH_INTERVAL)

    return () => clearInterval(intervalRef.current)
  }, [fetchData])

  return { data, loading, error, refresh: () => fetchData(false), lastRefresh }
}

// ─── usePlayerGameLog: fetches last N games for sparkline ────────────────────

export function usePlayerGameLog(personId, season) {
  const [sparkline, setSparkline] = useState([])
  const [last7Total, setLast7Total] = useState(0)
  const [yesterday, setYesterday] = useState({ h: 0, r: 0, rbi: 0 })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!personId) return
    let cancelled = false

    const cacheKey = `gamelog_${personId}_${season}`
    const cached = getCached(cacheKey)
    if (cached) {
      setSparkline(cached.sparkline)
      setLast7Total(cached.last7Total)
      setYesterday(cached.yesterday)
      return
    }

    setLoading(true)
    api.getPlayerGameLog(personId, season)
      .then((data) => {
        if (cancelled) return
        const stats = data?.stats?.[0]?.splits || []
        const recent = stats.slice(0, 7)
        const sp = extractSparklineData(recent.map(s => ({ stat: s.stat })))
        const total = sp.reduce((a, b) => a + b, 0)
        const yday = recent[0]?.stat || {}
        const result = {
          sparkline: sp,
          last7Total: total,
          yesterday: { h: yday.hits || 0, r: yday.runs || 0, rbi: yday.rbi || 0 },
        }
        setCached(cacheKey, result)
        setSparkline(result.sparkline)
        setLast7Total(result.last7Total)
        setYesterday(result.yesterday)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [personId, season])

  return { sparkline, last7Total, yesterday, loading }
}
