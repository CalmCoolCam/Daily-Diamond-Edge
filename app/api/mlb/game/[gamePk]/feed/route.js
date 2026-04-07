import { mlbFetch } from '@/lib/mlbApi'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request, { params }) {
  try {
    const { gamePk } = params
    if (!gamePk || isNaN(parseInt(gamePk))) {
      return NextResponse.json({ error: 'Invalid gamePk' }, { status: 400 })
    }

    const data = await mlbFetch(`/api/v1.1/game/${gamePk}/feed/live`)
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
