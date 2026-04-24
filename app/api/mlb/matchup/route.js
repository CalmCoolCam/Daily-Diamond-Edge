/**
 * /api/mlb/matchup?batterId={id}&pitcherId={id}&season={year}
 *
 * Lazy-loaded matchup detail endpoint. Called only when a player row is expanded/hovered.
 * Returns:
 *   vsPlayer   — batter career stats vs this specific pitcher (AB, H, HR, RBI, AVG)
 *   lastStarts — pitcher's last 3 game-log entries (date, opp, IP, ER, H, K, ERA, WHIP)
 *
 * Both results are cached server-side (60s TTL via mlbFetch in-memory cache).
 * Client caches the response for the full day via localStorage.
 */
import { mlbFetch, currentSeason } from '@/lib/mlbApi'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function fmtIP(outs) {
  if (outs == null) return '--'
  const inn = Math.floor(outs / 3)
  const rem = outs % 3
  return rem === 0 ? `${inn}.0` : `${inn}.${rem}`
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const batterId  = searchParams.get('batterId')
    const pitcherId = searchParams.get('pitcherId')
    const season    = searchParams.get('season') || currentSeason()

    if (!batterId || !pitcherId) {
      return NextResponse.json({ error: 'batterId and pitcherId required' }, { status: 400 })
    }

    const [vsResult, logResult] = await Promise.allSettled([
      // Batter career stats vs this specific pitcher
      mlbFetch(
        `/api/v1/people/${batterId}/stats?stats=vsPlayer&group=hitting&opposingPlayerId=${pitcherId}&season=${season}`
      ),
      // Pitcher game log for the full season — we take the 3 most recent entries
      mlbFetch(
        `/api/v1/people/${pitcherId}/stats?stats=gameLog&group=pitching&season=${season}`
      ),
    ])

    // ── Batter vs pitcher ──────────────────────────────────────────────────────
    let vsPlayer = null
    if (vsResult.status === 'fulfilled') {
      const splits = vsResult.value?.stats?.[0]?.splits || []
      const stat   = splits[0]?.stat || {}
      const ab     = stat.atBats || 0
      const h      = stat.hits   || 0
      vsPlayer = {
        ab,
        h,
        hr:  stat.homeRuns || 0,
        rbi: stat.rbi      || 0,
        avg: ab >= 1 ? (h / ab).toFixed(3) : null,
        sufficient: ab >= 5,
      }
    }

    // ── Pitcher last 3 starts ──────────────────────────────────────────────────
    let lastStarts = []
    if (logResult.status === 'fulfilled') {
      const splits = logResult.value?.stats?.[0]?.splits || []
      // splits come most-recent-first; take up to 3
      lastStarts = splits.slice(0, 3).map((s) => {
        const st = s.stat || {}
        const outs = st.outs ?? (st.inningsPitched != null ? Math.round(parseFloat(st.inningsPitched) * 3) : null)
        const er   = st.earnedRuns ?? 0
        const ip   = st.inningsPitched != null ? parseFloat(st.inningsPitched) : null
        // Compute per-start ERA (9 * er / ip)
        let startERA = null
        if (ip != null && ip > 0) startERA = ((er * 9) / ip).toFixed(2)
        // Compute per-start WHIP ((BB + H) / ip)
        const bb = st.baseOnBalls ?? 0
        const h  = st.hits        ?? 0
        let startWHIP = null
        if (ip != null && ip > 0) startWHIP = ((bb + h) / ip).toFixed(2)

        return {
          date:     s.date || '',
          opponent: s.opponent?.abbreviation || s.team?.abbreviation || '--',
          ip:       ip != null ? ip.toFixed(1) : '--',
          er,
          h,
          k:        st.strikeOuts  ?? 0,
          bb,
          era:      startERA,
          whip:     startWHIP,
        }
      })
    }

    return NextResponse.json({ vsPlayer, lastStarts })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
