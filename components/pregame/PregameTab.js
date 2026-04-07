'use client'
import { useMemo, useState, useEffect, useRef } from 'react'
import HotPlayers from './HotPlayers'
import MatchupGrades from './MatchupGrades'
import PlayerTable from './PlayerTable'
import { computeMatchupGrade, computeHeat, extractSparklineData, currentSeason } from '@/lib/mlbApi'
import { api } from '@/lib/mlbApi'
import { getCached, setCached } from '@/lib/storage'

/**
 * Builds the normalized player list from enriched game data
 */
function buildPlayerList(games) {
  const players = []
  const season = currentSeason()

  for (const game of games) {
    const homeTeam = game.teams?.home?.team
    const awayTeam = game.teams?.away?.team

    // Compute matchup grades
    const homePitcherStats = game.homePitcherStats?.stats?.[0]?.splits?.[0]?.stat || {}
    const awayPitcherStats = game.awayPitcherStats?.stats?.[0]?.splits?.[0]?.stat || {}

    const homePitcherERA = parseFloat(homePitcherStats.era) || 4.5
    const awayPitcherERA = parseFloat(awayPitcherStats.era) || 4.5

    // Away batters face home pitcher
    const awayBattersGrade = computeMatchupGrade(homePitcherERA, homePitcherERA)
    // Home batters face away pitcher
    const homeBattersGrade = computeMatchupGrade(awayPitcherERA, awayPitcherERA)

    // Process rosters
    for (const side of ['home', 'away']) {
      const team = side === 'home' ? homeTeam : awayTeam
      const opponent = side === 'home' ? awayTeam : homeTeam
      const roster = side === 'home' ? game.homeRoster : game.awayRoster
      const grade = side === 'home' ? homeBattersGrade : awayBattersGrade

      if (!roster?.roster) continue

      for (const member of roster.roster) {
        // Only batters (exclude P)
        if (member.position?.abbreviation === 'P') continue

        players.push({
          id: member.person?.id,
          name: member.person?.fullName || '',
          teamId: team?.id,
          teamAbbr: team?.abbreviation || '',
          opponentAbbr: opponent?.abbreviation || '',
          position: member.position?.abbreviation || '',
          gamePk: game.gamePk,
          gameStatus: game.status?.abstractGameState,
          isHome: side === 'home',
          matchupGrade: grade,
          // These will be populated lazily via usePlayerGameLog
          sparkline: [],
          last7Total: 0,
          yesterdayH: 0,
          yesterdayR: 0,
          yesterdayRBI: 0,
          // Season stats (from live feed if available, otherwise 0)
          seasonH: 0,
          seasonR: 0,
          seasonRBI: 0,
          seasonTotal: 0,
          todayH: 0,
          todayR: 0,
          todayRBI: 0,
        })
      }
    }
  }

  return players
}

/**
 * Enriches players with season stats and game logs in batches
 */
async function enrichPlayers(players, season, onProgress) {
  const BATCH = 8
  const enriched = [...players]

  for (let i = 0; i < enriched.length; i += BATCH) {
    const batch = enriched.slice(i, i + BATCH)
    const ids = batch.map((p) => p.id).filter(Boolean)
    if (!ids.length) continue

    const cacheKey = `batch_${ids.join('_')}_${season}`
    let result = getCached(cacheKey)

    if (!result) {
      try {
        result = await api.getBatchPlayerStats(ids, season)
        setCached(cacheKey, result)
      } catch {
        continue
      }
    }

    for (const item of result?.players || []) {
      const idx = enriched.findIndex((p) => p.id === item.personId)
      if (idx === -1) continue

      const statsArr = item.data?.stats || []
      const seasonStat = statsArr.find((s) => s.type?.displayName === 'season')
      const gameLog = statsArr.find((s) => s.type?.displayName === 'gameLog')

      const seasonSplit = seasonStat?.splits?.[0]?.stat || {}
      const logSplits = gameLog?.splits || []

      const sparkline = extractSparklineData(
        logSplits.slice(0, 7).map((s) => ({ stat: s.stat })),
      )
      const last7Total = sparkline.reduce((a, b) => a + b, 0)
      const yday = logSplits[0]?.stat || {}

      enriched[idx] = {
        ...enriched[idx],
        seasonH: seasonSplit.hits || 0,
        seasonR: seasonSplit.runs || 0,
        seasonRBI: seasonSplit.rbi || 0,
        seasonTotal: (seasonSplit.hits || 0) + (seasonSplit.runs || 0) + (seasonSplit.rbi || 0),
        sparkline,
        last7Total,
        yesterdayH: yday.hits || 0,
        yesterdayR: yday.runs || 0,
        yesterdayRBI: yday.rbi || 0,
        heat: computeHeat(last7Total),
      }
    }

    onProgress([...enriched])
    // Yield to UI between batches
    await new Promise((r) => setTimeout(r, 20))
  }

  return enriched
}

export default function PregameTab({ gamesData, loading, error, onRetry, stars, onToggleStar, selectedGamePk, onSelectGame }) {
  const [players, setPlayers] = useState([])
  const [enriching, setEnriching] = useState(false)
  const season = currentSeason()

  // Build initial player list from game data (fast, no API)
  const basePlayers = useMemo(() => {
    if (!gamesData?.games) return []
    return buildPlayerList(gamesData.games)
  }, [gamesData])

  // Sort base players by last7Total for hot players (will update as enriched)
  const hotPlayers = useMemo(() => {
    return [...players]
      .sort((a, b) => (b.last7Total || 0) - (a.last7Total || 0))
      .slice(0, 10)
  }, [players])

  // Enrich players progressively
  useEffect(() => {
    if (!basePlayers.length) return
    setPlayers(basePlayers)
    setEnriching(true)

    let cancelled = false
    enrichPlayers(basePlayers, season, (partial) => {
      if (!cancelled) setPlayers(partial)
    }).finally(() => {
      if (!cancelled) setEnriching(false)
    })

    return () => { cancelled = true }
  }, [basePlayers, season])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[40%_60%] gap-4 p-4">
      {/* Left column: Hot players + Matchup grades */}
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

      {/* Right column: Full player table */}
      <div className="min-h-0">
        <PlayerTable
          players={players}
          loading={loading || (enriching && !players.length)}
          error={error}
          onRetry={onRetry}
          stars={stars}
          onToggleStar={onToggleStar}
          selectedGamePk={selectedGamePk}
          games={gamesData?.games || []}
        />
      </div>
    </div>
  )
}
