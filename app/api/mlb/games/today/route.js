/**
 * Aggregated "today's games + roster + pitcher stats" endpoint.
 * Returns everything the Pregame and Live tabs need in one request.
 */
import { mlbFetch, todayStr, currentSeason } from '@/lib/mlbApi'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') || todayStr()
    const season = currentSeason()

    // 1. Fetch schedule
    const schedule = await mlbFetch(
      `/api/v1/schedule?sportId=1&date=${date}&hydrate=linescore,team,probablePitcher`
    )

    const games = schedule?.dates?.[0]?.games || []

    // 2. For each game, fetch rosters and pitcher stats in parallel
    const enriched = await Promise.allSettled(
      games.map(async (game) => {
        const homeTeamId = game.teams?.home?.team?.id
        const awayTeamId = game.teams?.away?.team?.id
        const homePitcherId = game.teams?.home?.probablePitcher?.id
        const awayPitcherId = game.teams?.away?.probablePitcher?.id

        const [homeRoster, awayRoster, homePitcherStats, awayPitcherStats] =
          await Promise.allSettled([
            homeTeamId ? mlbFetch(`/api/v1/teams/${homeTeamId}/roster?rosterType=active`) : Promise.resolve(null),
            awayTeamId ? mlbFetch(`/api/v1/teams/${awayTeamId}/roster?rosterType=active`) : Promise.resolve(null),
            homePitcherId
              ? mlbFetch(`/api/v1/people/${homePitcherId}/stats?stats=season&group=pitching&season=${season}`)
              : Promise.resolve(null),
            awayPitcherId
              ? mlbFetch(`/api/v1/people/${awayPitcherId}/stats?stats=season&group=pitching&season=${season}`)
              : Promise.resolve(null),
          ])

        return {
          ...game,
          homeRoster: homeRoster.status === 'fulfilled' ? homeRoster.value : null,
          awayRoster: awayRoster.status === 'fulfilled' ? awayRoster.value : null,
          homePitcherStats: homePitcherStats.status === 'fulfilled' ? homePitcherStats.value : null,
          awayPitcherStats: awayPitcherStats.status === 'fulfilled' ? awayPitcherStats.value : null,
        }
      })
    )

    const gamesWithData = enriched
      .filter((r) => r.status === 'fulfilled')
      .map((r) => r.value)

    return NextResponse.json({ games: gamesWithData, date, season })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
