'use client'
import { useState, useMemo } from 'react'
import PlayerTable from '../pregame/PlayerTable'
import PitcherTable from './PitcherTable'

const POSITIONS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH']

export default function PlayerListTab({
  players, pitchers, games, loading, error, onRetry, stars, onToggleStar,
  selectedGamePk, updatedIds, fgBatters, fgPitchers,
}) {
  const [view, setView]           = useState('batters')   // 'batters' | 'pitchers'
  const [filterPosition, setFilterPosition] = useState('')

  const filteredBatters = useMemo(() => {
    if (!filterPosition) return players
    return players.filter((p) => p.position === filterPosition)
  }, [players, filterPosition])

  return (
    <div className="p-4">
      {/* Title row */}
      <div className="flex items-center justify-between mb-3">
        <h2
          className="text-2xl text-[var(--text-primary)] tracking-wider"
          style={{ fontFamily: "'Bebas Neue', sans-serif" }}
        >
          ⚾ Player List
        </h2>
        <span className="text-xs text-[var(--text-muted)]">
          {view === 'batters' ? players.length : (pitchers?.length ?? 0)} {view === 'batters' ? 'batters' : 'pitchers'}
        </span>
      </div>

      {/* Batters / Pitchers toggle */}
      <div className="flex gap-4 mb-4 border-b border-[var(--border)]">
        {['batters', 'pitchers'].map((tab) => (
          <button
            key={tab}
            onClick={() => setView(tab)}
            className={`pb-2 text-sm font-semibold uppercase tracking-wider transition-colors ${
              view === tab
                ? 'text-amber-500 border-b-2 border-amber-500'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Batters view — position filter + table */}
      {view === 'batters' && (
        <>
          <div className="flex flex-wrap gap-1.5 mb-3">
            <button
              onClick={() => setFilterPosition('')}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium min-h-[36px] transition-colors ${
                !filterPosition
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border)] hover:border-amber-300'
              }`}
            >
              All
            </button>
            {POSITIONS.map((pos) => (
              <button
                key={pos}
                onClick={() => setFilterPosition(filterPosition === pos ? '' : pos)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium min-h-[36px] transition-colors ${
                  filterPosition === pos
                    ? 'bg-amber-500 text-white border-amber-500'
                    : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border)] hover:border-amber-300'
                }`}
              >
                {pos}
              </button>
            ))}
          </div>

          <PlayerTable
            players={filteredBatters}
            games={games}
            loading={loading}
            error={error}
            onRetry={onRetry}
            stars={stars}
            onToggleStar={onToggleStar}
            selectedGamePk={selectedGamePk}
            updatedIds={updatedIds}
            fgBatters={fgBatters}
            fgPitchers={fgPitchers}
          />
        </>
      )}

      {/* Pitchers view */}
      {view === 'pitchers' && (
        <PitcherTable
          pitchers={pitchers || []}
          loading={loading}
          error={error}
          onRetry={onRetry}
          stars={stars}
          onToggleStar={onToggleStar}
        />
      )}
    </div>
  )
}
