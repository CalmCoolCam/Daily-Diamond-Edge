'use client'
import { useEffect, useState } from 'react'
import TeamBadge from './ui/TeamBadge'
import { getPicksLeaderboard } from '@/lib/storage'

/**
 * MyPicks modal — season pick leaderboard
 */
export default function MyPicks({ isOpen, onClose, allPlayers }) {
  const [leaderboard, setLeaderboard] = useState([])

  useEffect(() => {
    if (isOpen) {
      setLeaderboard(getPicksLeaderboard())
    }
  }, [isOpen])

  if (!isOpen) return null

  // Enrich leaderboard entries with live player data
  const enriched = leaderboard.map((entry) => {
    const player = allPlayers?.find(
      (p) => p.name === entry.name && p.teamAbbr === entry.teamAbbr,
    ) || null
    return { ...entry, player }
  })

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 bg-navy-900 rounded-t-2xl border-t border-navy-700 max-h-[80vh] flex flex-col md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[520px] md:max-h-[80vh] md:rounded-2xl md:border"
        role="dialog"
        aria-label="My Season Picks"
      >
        {/* Handle */}
        <div className="md:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-navy-600 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-navy-800">
          <div>
            <h2
              className="text-xl text-white tracking-wider"
              style={{ fontFamily: "'Bebas Neue', sans-serif" }}
            >
              📊 My Season Picks
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {leaderboard.length} player{leaderboard.length !== 1 ? 's' : ''} picked this season
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-navy-800 transition-colors"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 pb-6">
          {leaderboard.length === 0 ? (
            <div className="py-12 text-center">
              <div className="text-4xl mb-3">☆</div>
              <p className="text-slate-400 text-sm">No picks yet this season</p>
              <p className="text-slate-600 text-xs mt-1">Star players to start tracking</p>
            </div>
          ) : (
            <div className="space-y-2 pt-3">
              {enriched.map((entry, i) => {
                const p = entry.player
                const todayTotal = p ? (p.todayH || 0) + (p.todayR || 0) + (p.todayRBI || 0) : null

                return (
                  <div
                    key={entry.key}
                    className="flex items-center gap-3 bg-navy-800/60 rounded-xl border border-navy-700 px-3 py-2.5 hover:border-navy-600 transition-colors"
                  >
                    {/* Rank */}
                    <div className="text-sm font-bold text-slate-600 tabular-nums w-5 text-center">
                      {i + 1}
                    </div>

                    {/* Player info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white truncate">
                          {entry.name}
                        </span>
                        <TeamBadge abbr={entry.teamAbbr} size="xs" />
                      </div>
                      {p && (
                        <div className="text-xs text-slate-500 mt-0.5">
                          Season: {p.seasonH || 0}H / {p.seasonR || 0}R / {p.seasonRBI || 0}RBI
                        </div>
                      )}
                    </div>

                    {/* Today's performance (if available) */}
                    {todayTotal != null && (
                      <div className="text-right">
                        <div className={`text-sm font-bold tabular-nums ${
                          todayTotal >= 3 ? 'text-green-400' :
                          todayTotal >= 1 ? 'text-gold-400' : 'text-slate-500'
                        }`}>
                          {todayTotal}
                        </div>
                        <div className="text-[10px] text-slate-600">today</div>
                      </div>
                    )}

                    {/* Pick count badge */}
                    <div className="flex-shrink-0 bg-gold-500/10 border border-gold-500/30 rounded-lg px-2 py-1 text-center">
                      <div className="text-sm font-bold text-gold-400 tabular-nums leading-none">
                        {entry.count}
                      </div>
                      <div className="text-[9px] text-gold-600">picks</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
