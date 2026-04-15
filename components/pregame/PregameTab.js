'use client'
import { useMemo } from 'react'
import HotPlayers from './HotPlayers'
import MatchupGrades from './MatchupGrades'
import PlayerTable from './PlayerTable'
import { currentSeason } from '@/lib/mlbApi'

export default function PregameTab({ gamesData, loading, error, onRetry, players, stars, onToggleStar, selectedGamePk, onSelectGame, updatedIds }) {
  const season = currentSeason()

  // Hot players: already enriched via parent (page.js), sorted by 7-day calendar total
  const hotPlayers = useMemo(() => {
    return [...players]
      .sort((a, b) => (b.last7Total || 0) - (a.last7Total || 0))
      .slice(0, 10)
  }, [players])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[40%_60%] gap-4 p-4">
      {/* Left: Hot players + matchup grades */}
      <div className="space-y-2 lg:overflow-y-auto lg:max-h-[calc(100vh-200px)] lg:pr-1">
        <HotPlayers
          players={hotPlayers}
          loading={loading}
          error={error}
          onRetry={onRetry}
          starred={stars}
          onToggleStar={onToggleStar}
          season={season}
          selectedGamePk={selectedGamePk}
        />
        <MatchupGrades
          games={gamesData?.games || []}
          loading={loading}
          selectedGamePk={selectedGamePk}
          onSelectGame={onSelectGame}
        />
      </div>

      {/* Right: Full player table */}
      <div className="min-h-0">
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
