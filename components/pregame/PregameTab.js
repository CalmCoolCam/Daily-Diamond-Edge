'use client'
import { useMemo } from 'react'
import MatchupGrades from './MatchupGrades'
import PlayerTable from './PlayerTable'
import GameDetailView from './GameDetailView'
import { currentSeason } from '@/lib/mlbApi'

export default function PregameTab({
  gamesData,
  loading,
  error,
  onRetry,
  players,
  stars,
  onToggleStar,
  selectedGamePk,
  onSelectGame,
  updatedIds,
}) {
  const season = currentSeason()

  // Find the selected game object from the games list
  const selectedGame = selectedGamePk
    ? (gamesData?.games || []).find((g) => g.gamePk === selectedGamePk) || null
    : null

  // ── Game selected: show full game detail view ─────────────────────────────
  if (selectedGame) {
    return (
      <div className="p-4 max-w-screen-2xl mx-auto w-full">
        <GameDetailView
          game={selectedGame}
          players={players}
          stars={stars}
          onToggleStar={onToggleStar}
          onDeselect={() => onSelectGame(null)}
        />
      </div>
    )
  }

  // ── Default: matchup grades (left) + player table (right) ─────────────────
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[40%_60%] gap-4 p-4">
      {/* Left: Matchup grades */}
      <div className="space-y-2 lg:overflow-y-auto lg:max-h-[calc(100vh-200px)] lg:pr-1">
        <MatchupGrades
          games={gamesData?.games || []}
          loading={loading}
          selectedGamePk={selectedGamePk}
          onSelectGame={onSelectGame}
        />
      </div>

      {/* Right: Player table with subtle game-selection prompt above */}
      <div className="min-h-0">
        <div className="mb-3 px-3 py-2 rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-subtle)] text-xs text-[var(--text-muted)] text-center">
          Select a game above to see starting lineups and pitcher matchup
        </div>
        <PlayerTable
          players={players}
          loading={loading}
          error={error}
          onRetry={onRetry}
          stars={stars}
          onToggleStar={onToggleStar}
          selectedGamePk={selectedGamePk}
          updatedIds={updatedIds}
          games={gamesData?.games || []}
        />
      </div>
    </div>
  )
}
