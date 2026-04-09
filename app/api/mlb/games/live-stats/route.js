/**
 * /api/mlb/games/live-stats
 *
 * Returns compact batting stats for every player in today's Live and Final games.
 * This is separate from /api/mlb/games/today to keep that endpoint fast (rosters only).
 *
 * STAT FIELDS (per MLB Stats API liveData.boxscore):
 *   Path: liveData.boxscore.teams.{home|away}.players.{IDxxxxxx}.stats.batting
 *   We extract: hits (H), runs (R), rbi (RBI)
 *   NOT using: homeRuns, seasonStats, or any cumulative fields
 *
 * Response format:
 * {
 *   games: {
 *     "717465": {
 *       status: "Live" | "Final",
 *       home: { "123456": { h: 2, r: 1, rbi: 1, ab: 4 } },
 *       away: { "789012": { h: 0, r: 0, rbi: 0, ab: 3 } }
 *     }
 *   }
 * }
 */
import { mlbFetch, todayStr } from '@/lib/mlbApi'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function extractBattingStats(playersObj) {
  const result = {}
  for (const [key, player] of Object.entries(playersObj)) {
    const pid = key.replace('ID', '')
    // Source: liveData.boxscore.teams.{side}.players.{IDxxx}.stats.batting
    // Using stats.batting (game stats), NOT seasonStats.batting (season totals)
    const batting = player?.stats?.batting || {}
    result[pid] = {
      h:  batting.hits   || 0,  // H  — stat.hits   (NOT homeRuns)
      r:  batting.runs   || 0,  // R  — stat.runs   (NOT homeRuns)
      rbi: batting.rbi   || 0,  // RBI — stat.rbi
      ab: batting.atBats || 0,
    }
  }
  return result
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') || todayStr()

    // 1. Get today's schedule to find gamePks
    const schedule = await mlbFetch(
      `/api/v1/schedule?sportId=1&date=${date}&hydrate=linescore,team`
    )
    const games = schedule?.dates?.[0]?.games || []

    // 2. For Live + Final games, fetch game feeds in parallel
    const activeGames = games.filter(
      (g) => g.status?.abstractGameState === 'Live' || g.status?.abstractGameState === 'Final'
    )

    if (!activeGames.length) {
      return NextResponse.json({ games: {}, date })
    }

    const feedResults = await Promise.allSettled(
      activeGames.map((g) =>
        mlbFetch(`/api/v1.1/game/${g.gamePk}/feed/live`).then((feed) => ({
          gamePk: g.gamePk,
          status: g.status?.abstractGameState,
          feed,
        }))
      )
    )

    const gamesStats = {}
    for (const result of feedResults) {
      if (result.status !== 'fulfilled') continue
      const { gamePk, status, feed } = result.value

      const homePlayersRaw = feed?.liveData?.boxscore?.teams?.home?.players || {}
      const awayPlayersRaw = feed?.liveData?.boxscore?.teams?.away?.players || {}

      gamesStats[gamePk] = {
        status,
        home: extractBattingStats(homePlayersRaw),
        away: extractBattingStats(awayPlayersRaw),
      }
    }

    return NextResponse.json({ games: gamesStats, date })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
