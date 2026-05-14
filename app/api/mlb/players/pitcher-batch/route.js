/**
 * /api/mlb/players/pitcher-batch
 *
 * Fetches season pitching stats + last 3 starts game log for up to 30 pitchers.
 *
 * Season stats:  stats[type=season].splits[0].stat → era, whip, inningsPitched, wins, losses, strikeOuts, baseOnBalls
 * Last 3 starts: stats[type=gameLog].splits[] (most-recent-first) → take first 3 entries
 *   Each split: split.stat.{era, whip, inningsPitched, earnedRuns, strikeOuts}
 *               split.team.abbreviation (opponent from pitcher's perspective = opposing team)
 *               split.date
 *
 * Cached server-side for 1 hour via Next.js revalidate.
 */
import { mlbFetch, currentSeason } from '@/lib/mlbApi'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const idsParam = searchParams.get('ids')
    const season   = searchParams.get('season') || currentSeason()

    if (!idsParam) {
      return NextResponse.json({ error: 'ids parameter required' }, { status: 400 })
    }

    const ids = idsParam.split(',').map(Number).filter(Boolean).slice(0, 30)

    const results = await Promise.allSettled(
      ids.map((id) =>
        mlbFetch(
          `/api/v1/people/${id}/stats?stats=season,gameLog&group=pitching&season=${season}`,
          { next: { revalidate: 3600 } }  // 1-hour server cache
        ).then((data) => ({ personId: id, data }))
      )
    )

    const pitchers = results
      .filter((r) => r.status === 'fulfilled')
      .map((r) => {
        const { personId, data } = r.value
        const statsArr = data?.stats || []

        const seasonStat  = statsArr.find((s) => s.type?.displayName === 'season')
        const gameLogStat = statsArr.find((s) => s.type?.displayName === 'gameLog')

        const ss = seasonStat?.splits?.[0]?.stat || {}
        const allStarts = gameLogStat?.splits || []

        // Helper to map a game log split to a standard appearance object
        function mapAppearance(s) {
          const st = s.stat || {}
          return {
            date:     s.date        || '',
            opponent: s.opponent?.abbreviation || s.team?.abbreviation || '?',
            ip:       st.inningsPitched || '--',
            er:       st.earnedRuns  ?? '--',
            k:        st.strikeOuts  ?? '--',
            era:      st.era         || null,
            whip:     st.whip        || null,
          }
        }

        // Last 3 and last 5 appearances — API returns oldest-first, so take from end and reverse to newest-first
        const last3 = allStarts.slice(-3).reverse().map(mapAppearance)
        const last5 = allStarts.slice(-5).reverse().map(mapAppearance)

        // Average ERA and WHIP across last 3 starts for grade computation
        const validERA  = last3.filter((s) => s.era  != null).map((s) => parseFloat(s.era))
        const validWHIP = last3.filter((s) => s.whip != null).map((s) => parseFloat(s.whip))
        const last3Avg  = validERA.length > 0 ? {
          era:  validERA.reduce((a, b) => a + b, 0)  / validERA.length,
          whip: validWHIP.length > 0 ? validWHIP.reduce((a, b) => a + b, 0) / validWHIP.length : null,
        } : null

        return {
          personId,
          seasonERA:  ss.era              != null ? parseFloat(ss.era)              : null,
          seasonWHIP: ss.whip             != null ? parseFloat(ss.whip)             : null,
          seasonIP:   ss.inningsPitched   || '--',
          seasonW:    ss.wins             ?? 0,
          seasonL:    ss.losses           ?? 0,
          seasonK:    ss.strikeOuts       ?? 0,
          seasonBB:   ss.baseOnBalls      ?? 0,
          seasonGS:   ss.gamesStarted     ?? 0,
          seasonSV:   ss.saves            ?? 0,
          seasonHLD:  ss.holds            ?? 0,
          last3,
          last5,
          last3Avg,
        }
      })

    return NextResponse.json({ pitchers })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
