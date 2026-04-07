'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  getStars,
  isStarred,
  toggleStar as storageToggle,
  getStarCount,
  pruneOldStars,
} from '@/lib/storage'

/**
 * useStars — manages daily starred players state
 *
 * Returns:
 *   stars: string[]       — array of starred player IDs
 *   starCount: number     — how many players starred today
 *   isStarred(id): bool
 *   toggle(id, meta): { starred, count, limitReached? }
 */
export function useStars() {
  const [stars, setStars] = useState([])

  useEffect(() => {
    // Prune old star data on mount
    pruneOldStars()
    setStars(getStars())
  }, [])

  const toggle = useCallback((playerId, playerMeta = {}) => {
    const result = storageToggle(playerId, playerMeta)
    setStars(getStars())
    return result
  }, [])

  const checkStarred = useCallback((playerId) => {
    return stars.includes(String(playerId))
  }, [stars])

  return {
    stars,
    starCount: stars.length,
    isStarred: checkStarred,
    toggle,
    maxStars: 10,
  }
}
