import { mlbFetch, currentSeason } from '@/lib/mlbApi'
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

    // Fetch all in parallel
    const results = await Promise.allSettled(
      ids.map((id) =>
        mlbFetch(`/api/v1/people/${id}/stats?stats=season,gameLog&group=${group}&season=${season}`)
          .then((data) => ({ personId: id, data }))
      )
    )

    const players = results
      .filter((r) => r.status === 'fulfilled')
      .map((r) => r.value)

    return NextResponse.json({ players })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
