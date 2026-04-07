'use client'
import { useState, useEffect, useCallback } from 'react'
import { getPicks, getPickCount, getPicksLeaderboard } from '@/lib/storage'

/**
 * usePicks — reads the season pick counter from storage
 */
export function usePicks() {
  const [picks, setPicks] = useState({})

  useEffect(() => {
    setPicks(getPicks())
  }, [])

  const getCount = useCallback(
    (name, teamAbbr) => {
      const key = `${name}_${teamAbbr}`
      return picks[key] || 0
    },
    [picks],
  )

  const refresh = useCallback(() => {
    setPicks(getPicks())
  }, [])

  return {
    picks,
    getCount,
    leaderboard: getPicksLeaderboard(),
    refresh,
  }
}
