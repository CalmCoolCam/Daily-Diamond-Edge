'use client'
import { useEffect, useState } from 'react'
import TeamBadge from './ui/TeamBadge'
import { getPicksLeaderboard } from '@/lib/storage'

export default function MyPicks({ isOpen, onClose, allPlayers }) {
  const [leaderboard, setLeaderboard] = useState([])

  useEffect(() => {
    if (isOpen) setLeaderboard(getPicksLeaderboard())
  }, [isOpen])

  if (!isOpen) return null

  const enriched = leaderboard.map((entry) => {
    const player = allPlayers?.find(
      (p) => p.name === entry.name && p.teamAbbr === entry.teamAbbr,
    ) || null
    return { ...entry, player }
  })

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <div
        className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl border-t border-slate-200 card-shadow-md max-h-[80vh] flex flex-col md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[520px] md:rounded-2xl md:border"
        role="dialog"
        aria-label="My Season Picks"
      >
        {/* Drag handle */}
        <div className="md:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-slate-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2
              className="text-xl text-slate-900 tracking-wider"
              style={{ fontFamily: "'Bebas Neue', sans-serif" }}
            >
              📊 My Season Picks
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {leaderboard.length} player{leaderboard.length !== 1 ? 's' : ''} picked this season
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
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
              <p className="text-slate-500 text-sm">No picks yet this season</p>
              <p className="text-slate-400 text-xs mt-1">Star players to start tracking</p>
            </div>
          ) : (
            <div className="space-y-2 pt-3">
              {enriched.map((entry, i) => {
                const p = entry.player
                const todayTotal = p ? (p.todayH || 0) + (p.todayR || 0) + (p.todayRBI || 0) : null

                return (
                  <div
                    key={entry.key}
                    className="flex items-center gap-3 bg-slate-50 rounded-xl border border-slate-200 px-3 py-2.5 hover:border-slate-300 transition-colors"
                  >
                    <div className="text-sm font-bold text-slate-300 tabular-nums w-5 text-center">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800 truncate">
                          {entry.name}
                        </span>
                        <TeamBadge abbr={entry.teamAbbr} size="xs" />
                      </div>
                      {p && (
                        <div className="text-xs text-slate-400 mt-0.5">
                          Season: {p.seasonH || 0}H / {p.seasonR || 0}R / {p.seasonRBI || 0}RBI
                        </div>
                      )}
                    </div>

                    {todayTotal != null && (
                      <div className="text-right">
                        <div className={`text-sm font-bold tabular-nums ${
                          todayTotal >= 3 ? 'text-green-600' :
                          todayTotal >= 1 ? 'text-amber-500' : 'text-slate-300'
                        }`}>
                          {todayTotal}
                        </div>
                        <div className="text-[10px] text-slate-400">today</div>
                      </div>
                    )}

                    <div className="flex-shrink-0 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 text-center">
                      <div className="text-sm font-bold text-amber-500 tabular-nums leading-none">
                        {entry.count}
                      </div>
                      <div className="text-[9px] text-amber-400">picks</div>
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
