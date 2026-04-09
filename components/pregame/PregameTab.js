'use client'
import { useMemo, useState, useEffect } from 'react'
import HotPlayers from './HotPlayers'
import MatchupGrades from './MatchupGrades'
import PlayerTable from './PlayerTable'
import { computeMatchupGrade, extractSparklineData, currentSeason } from '@/lib/mlbApi'
import { getCached, setCached } from '@/lib/storage'

function buildPlayerList(games) {
  const players = []
  for (const game of games) {
    const homeTeam = game.teams?.home?.team
    const awayTeam = game.teams?.away?.team

    // Pitcher ERA for matchup grades
    const homePitcherStat = game.homePitcherStats?.stats?.[0]?.splits?.[0]?.stat || {}
    const awayPitcherStat = game.awayPitcherStats?.stats?.[0]?.splits?.[0]?.stat || {}
    const homePitcherERA = parseFloat(homePitcherStat.era) || 4.5
    const awayPitcherERA = parseFloat(awayPitcherStat.era) || 4.5

    // Away batters face home pitcher; home batters face away pitcher
    const awayBattersGrade = computeMatchupGrade(homePitcherERA, homePitcherERA)
    const homeBattersGrade = computeMatchupGrade(awayPitcherERA, awayPitcherERA)

    for (const side of ['home', 'away']) {
      const team = side === 'home' ? homeTeam : awayTeam
      const opponent = side === 'home' ? awayTeam : homeTeam
      const roster = side === 'home' ? game.homeRoster : game.awayRoster
      const grade = side === 'home' ? homeBattersGrade : awayBattersGrade

      if (!roster?.roster) continue

      for (const member of roster.roster) {
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
          heatTier: 4,
          sparkline: [],
          last7Total: 0,
          yesterdayH: 0, yesterdayR: 0, yesterdayRBI: 0,
          seasonH: 0, seasonR: 0, seasonRBI: 0, seasonTotal: 0,
          todayH: 0, todayR: 0, todayRBI: 0,
        })
      }
    }
  }
  return players
}

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
        result = await fetch(`/api/mlb/players/batch?ids=${ids.join(',')}&season=${season}`).then((r) => r.json())
        setCached(cacheKey, result)
      } catch { continue }
    }

    for (const item of result?.players || []) {
      const idx = enriched.findIndex((p) => p.id === item.personId)
      if (idx === -1) continue

      const statsArr = item.data?.stats || []
      // Season stats: stats[].type.displayName === 'season' → splits[0].stat
      // Fields: stat.hits (H), stat.runs (R), stat.rbi (RBI) — verified field names
      const seasonStat = statsArr.find((s) => s.type?.displayName === 'season')
      // Game log: stats[].type.displayName === 'gameLog' → splits[] per game, most-recent-first
      // Each split.stat is ONE game's line (hits+runs+rbi), NOT cumulative
      const gameLog = statsArr.find((s) => s.type?.displayName === 'gameLog')

      const ss = seasonStat?.splits?.[0]?.stat || {}
      const logSplits = gameLog?.splits || []

      const sparklineInput = logSplits.slice(0, 7).map((s) => ({ stat: s.stat }))
      const sparkline = extractSparklineData(sparklineInput)
      const last7Total = sparkline.reduce((a, b) => a + b, 0)
      const yday = logSplits[0]?.stat || {}

      enriched[idx] = {
        ...enriched[idx],
        // Season H/R/RBI: stat.hits, stat.runs, stat.rbi from season group
        seasonH: ss.hits || 0,
        seasonR: ss.runs || 0,
        seasonRBI: ss.rbi || 0,
        seasonTotal: (ss.hits || 0) + (ss.runs || 0) + (ss.rbi || 0),
        sparkline,
        last7Total,
        // Yesterday's line: first game-log entry (most recent game)
        yesterdayH: yday.hits || 0,
        yesterdayR: yday.runs || 0,
        yesterdayRBI: yday.rbi || 0,
      }
    }

    onProgress([...enriched])
    await new Promise((r) => setTimeout(r, 20))
  }
  return enriched
}

export default function PregameTab({ gamesData, loading, error, onRetry, players, stars, onToggleStar, selectedGamePk, onSelectGame, updatedIds }) {
  const season = currentSeason()

  // Hot players: already enriched via parent, sorted by last7Total
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
