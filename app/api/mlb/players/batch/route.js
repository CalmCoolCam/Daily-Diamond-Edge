/**
 * /api/mlb/players/batch
 *
 * Fetches season stats + 7-day calendar game log for up to 30 players.
 *
 * STAT FIELDS (verified MLB Stats API field names):
 *   Season:  stats[type=season].splits[0].stat → hits (H), runs (R), rbi (RBI)
 *   GameLog: stats[type=gameLog].splits[]       → hits, runs, rbi per game entry
 *            Each split is ONE game — NOT cumulative.
 *            Splits come most-recent-first. Sum ALL entries for the 7-day total.
 *
 * 7-day window: startDate (today - 7 days CST) → endDate (yesterday CST)
 * Endpoint: /api/v1/people/{id}/stats?stats=season,gameLog&group=hitting
 *           &season={year}&startDate={startDate}&endDate={endDate}
 *
 * NOTE: stat.runs is used for runs — NOT stat.homeRuns.
 */
import { mlbFetch, currentSeason, get7DayDateRange } from '@/lib/mlbApi'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const idsParam = searchParams.get('ids')
    const season = searchParams.get('season') || currentSeason()
    const group = searchParams.get('group') || 'hitting'

    if (!idsParam) {
      return NextResponse.json({ error: 'ids parameter required' }, { status: 400 })
    }

    const ids = idsParam.split(',').map(Number).filter(Boolean).slice(0, 30)

    // 7-day calendar window: today-7 → yesterday (CST)
    // Applied to gameLog stats so only games in that window are returned.
    // Season stats are unaffected by date range (they remain season totals).
    const { startDate, endDate } = get7DayDateRange()

    // Fetch all in parallel
    const results = await Promise.allSettled(
      ids.map((id) =>
        mlbFetch(
          `/api/v1/people/${id}/stats?stats=season,gameLog&group=${group}&season=${season}&startDate=${startDate}&endDate=${endDate}`
        ).then((data) => ({ personId: id, data }))
      )
    )

    const players = results
      .filter((r) => r.status === 'fulfilled')
      .map((r) => r.value)

    return NextResponse.json({ players, dateRange: { startDate, endDate } })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
