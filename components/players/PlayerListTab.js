'use client'
import { useState, useMemo } from 'react'
import PlayerTable from '../pregame/PlayerTable'

const POSITIONS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH']

export default function PlayerListTab({ players, games, loading, error, onRetry, stars, onToggleStar, selectedGamePk, updatedIds }) {
  const [filterPosition, setFilterPosition] = useState('')

  const filteredPlayers = useMemo(() => {
    if (!filterPosition) return players
    return players.filter((p) => p.position === filterPosition)
  }, [players, filterPosition])

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2
          className="text-2xl text-[var(--text-primary)] tracking-wider"
          style={{ fontFamily: "'Bebas Neue', sans-serif" }}
        >
          ⚾ Player List
        </h2>
        <span className="text-xs text-[var(--text-muted)]">{players.length} players</span>
      </div>

      {/* Position filter */}
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
        players={filteredPlayers}
        games={games}
        loading={loading}
        error={error}
        onRetry={onRetry}
        stars={stars}
        onToggleStar={onToggleStar}
        selectedGamePk={selectedGamePk}
        updatedIds={updatedIds}
      />
    </div>
  )
}
