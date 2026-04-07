import { mlbFetch, currentSeason } from '@/lib/mlbApi'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request, { params }) {
  try {
    const { personId } = params
    if (!personId || isNaN(parseInt(personId))) {
      return NextResponse.json({ error: 'Invalid personId' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const season = searchParams.get('season') || currentSeason()
    const group = searchParams.get('group') || 'hitting'

    const data = await mlbFetch(
      `/api/v1/people/${personId}/stats?stats=season&group=${group}&season=${season}`
    )
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
