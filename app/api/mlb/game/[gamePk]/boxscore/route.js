/**
 * /api/mlb/game/{gamePk}/boxscore
 *
 * Proxies the MLB Stats API boxscore for a specific game.
 * Returns the batting order + all player details for both teams.
 * Client caches this for 15 minutes since lineups don't change once posted.
 *
 * Key fields returned:
 *   teams.home.battingOrder  — array of person IDs in batting order
 *   teams.home.players       — object keyed by "ID{personId}" with player details
 *   teams.away.*             — same for away team
 */
import { mlbFetch } from '@/lib/mlbApi'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request, { params }) {
  try {
    const { gamePk } = params
    if (!gamePk || isNaN(parseInt(gamePk))) {
      return NextResponse.json({ error: 'Invalid gamePk' }, { status: 400 })
    }

    const data = await mlbFetch(`/api/v1/game/${gamePk}/boxscore`)
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
