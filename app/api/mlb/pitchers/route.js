import { mlbFetch, todayStr } from '@/lib/mlbApi'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') || todayStr()

    const data = await mlbFetch(
      `/api/v1/schedule?sportId=1&startDate=${date}&endDate=${date}&hydrate=probablePitcher,team`
    )
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
