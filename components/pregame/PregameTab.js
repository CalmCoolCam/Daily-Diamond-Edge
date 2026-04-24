'use client'
import MatchupGrades from './MatchupGrades'
import GameDetailView from './GameDetailView'

export default function PregameTab({
  gamesData,
  loading,
  players,
  stars,
  onToggleStar,
  selectedGamePk,
  onSelectGame,
}) {
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

  // ── Default: matchup grades + game selection prompt ───────────────────────
  return (
    <div className="p-4">
      <div className="mb-3 px-3 py-2 rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-subtle)] text-xs text-[var(--text-muted)] text-center">
        Select a game above to see starting lineups and pitcher matchup
      </div>
      <MatchupGrades
        games={gamesData?.games || []}
        loading={loading}
        selectedGamePk={selectedGamePk}
        onSelectGame={onSelectGame}
      />
    </div>
  )
}
