import { mlbFetch } from '@/lib/mlbApi'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request, { params }) {
  try {
    const { teamId } = params
    if (!teamId || isNaN(parseInt(teamId))) {
      return NextResponse.json({ error: 'Invalid teamId' }, { status: 400 })
    }

    const data = await mlbFetch(
      `/api/v1/teams/${teamId}/roster?rosterType=active`
    )
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
