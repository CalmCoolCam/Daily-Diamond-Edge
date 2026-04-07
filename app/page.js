'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Header from '@/components/Header'
import ScoreCards from '@/components/ScoreCards'
import TabNav from '@/components/TabNav'
import PregameTab from '@/components/pregame/PregameTab'
import LiveTab from '@/components/live/LiveTab'
import ResultsTab from '@/components/results/ResultsTab'
import MyPicks from '@/components/MyPicks'
import { useStars } from '@/hooks/useStars'
import { usePicks } from '@/hooks/usePicks'
import { computeHeat, computeMatchupGrade, extractSparklineData, currentSeason } from '@/lib/mlbApi'
import { getCached, setCached } from '@/lib/storage'
import { PageSkeleton } from '@/components/ui/Skeleton'

const REFRESH_MS = 60_000

export default function App() {
  const [activeTab, setActiveTab] = useState('pregame')
  const [picksOpen, setPicksOpen] = useState(false)
  const [selectedGamePk, setSelectedGamePk] = useState(null)

  // Master data state
  const [gamesData, setGamesData] = useState(null)
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [updatedIds, setUpdatedIds] = useState(new Set())

  const prevPlayersRef = useRef({})
  const intervalRef = useRef(null)
  const isLiveRef = useRef(false)

  // Stars + picks
  const { stars, starCount, isStarred, toggle: toggleStar } = useStars()
  const { refresh: refreshPicks } = usePicks()

  // Handle star toggle with picks sync
  function handleToggleStar(playerId, meta) {
    const result = toggleStar(playerId, meta)
    if (result?.starred) refreshPicks()
    return result
  }

  // ── Fetch today's enriched game data ────────────────────────────────────────
  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)

    try {
      setError(null)
      const res = await fetch('/api/mlb/games/today')
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Server error' }))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      const json = await res.json()

      // Check for live games
      isLiveRef.current = json.games?.some(
        (g) => g.status?.abstractGameState === 'Live',
      ) || false

      setGamesData(json)

      // Build flat player list from all game rosters
      const built = buildPlayerList(json.games || [])

      // Detect stat updates
      const updated = new Set()
      built.forEach((p) => {
        const prev = prevPlayersRef.current[p.id]
        if (!prev) return
        if (
          prev.todayH !== p.todayH ||
          prev.todayR !== p.todayR ||
          prev.todayRBI !== p.todayRBI
        ) {
          updated.add(String(p.id))
        }
      })
      if (updated.size > 0) {
        setUpdatedIds(updated)
        setTimeout(() => setUpdatedIds(new Set()), 3000)
      }
      built.forEach((p) => { prevPlayersRef.current[p.id] = p })

      setPlayers(built)
      setLastRefresh(new Date())
    } catch (err) {
      setError(err.message)
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [])

  // Initial load + periodic refresh when Live tab is active or live games exist
  useEffect(() => {
    fetchData(true)

    intervalRef.current = setInterval(() => {
      if (activeTab === 'live' || isLiveRef.current) {
        fetchData(false)
      }
    }, REFRESH_MS)

    return () => clearInterval(intervalRef.current)
  }, [fetchData, activeTab])

  // ── Build player list from raw game data ───────────────────────────────────

  function buildPlayerList(games) {
    const list = []

    for (const game of games) {
      const homeTeam = game.teams?.home?.team
      const awayTeam = game.teams?.away?.team
      const gameStatus = game.status?.abstractGameState

      // Extract pitcher stats for matchup grades
      const homePitcherStat = game.homePitcherStats?.stats?.[0]?.splits?.[0]?.stat || {}
      const awayPitcherStat = game.awayPitcherStats?.stats?.[0]?.splits?.[0]?.stat || {}
      const homePitcherERA = parseFloat(homePitcherStat.era) || 4.5
      const awayPitcherERA = parseFloat(awayPitcherStat.era) || 4.5

      const awayBattersGrade = computeMatchupGrade(homePitcherERA, homePitcherERA)
      const homeBattersGrade = computeMatchupGrade(awayPitcherERA, awayPitcherERA)

      // Get live boxscore stats if available
      const liveFeed = game.liveData
      const homePlayers = liveFeed?.boxscore?.teams?.home?.players || {}
      const awayPlayers = liveFeed?.boxscore?.teams?.away?.players || {}

      for (const side of ['home', 'away']) {
        const team = side === 'home' ? homeTeam : awayTeam
        const opponent = side === 'home' ? awayTeam : homeTeam
        const roster = side === 'home' ? game.homeRoster : game.awayRoster
        const grade = side === 'home' ? homeBattersGrade : awayBattersGrade
        const liveBoxPlayers = side === 'home' ? homePlayers : awayPlayers

        if (!roster?.roster) continue

        for (const member of roster.roster) {
          if (member.position?.abbreviation === 'P') continue

          const pid = member.person?.id
          const livePlayer = liveBoxPlayers[`ID${pid}`]
          const liveBatting = livePlayer?.stats?.batting || {}

          list.push({
            id: pid,
            name: member.person?.fullName || '',
            teamId: team?.id,
            teamAbbr: team?.abbreviation || '',
            opponentAbbr: opponent?.abbreviation || '',
            position: member.position?.abbreviation || '',
            gamePk: game.gamePk,
            gameStatus,
            isHome: side === 'home',
            matchupGrade: grade,
            // Today's stats from live feed
            todayH: liveBatting.hits || 0,
            todayR: liveBatting.runs || 0,
            todayRBI: liveBatting.rbi || 0,
            todayAB: liveBatting.atBats || 0,
            // Season stats & game log will be populated via enrichment
            seasonH: 0,
            seasonR: 0,
            seasonRBI: 0,
            seasonTotal: 0,
            sparkline: [],
            last7Total: 0,
            yesterdayH: 0,
            yesterdayR: 0,
            yesterdayRBI: 0,
            heat: 'cold',
          })
        }
      }
    }

    return list
  }

  // ── Progressively enrich players with season stats ─────────────────────────

  useEffect(() => {
    if (!players.length) return

    const season = currentSeason()
    let cancelled = false
    const BATCH = 10

    async function enrich() {
      const enriched = [...players]

      for (let i = 0; i < enriched.length; i += BATCH) {
        if (cancelled) break

        const batch = enriched.slice(i, i + BATCH)
        const ids = batch.map((p) => p.id).filter(Boolean)
        if (!ids.length) continue

        const cacheKey = `batch_${season}_${ids.slice(0, 3).join('-')}`
        let result = getCached(cacheKey)

        if (!result) {
          try {
            const res = await fetch(`/api/mlb/players/batch?ids=${ids.join(',')}&season=${season}`)
            if (!res.ok) continue
            result = await res.json()
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

          const ss = seasonStat?.splits?.[0]?.stat || {}
          const logSplits = gameLog?.splits || []

          const sparklineInput = logSplits.slice(0, 7).map((s) => ({ stat: s.stat }))
          const sparkline = extractSparklineData(sparklineInput)
          const last7Total = sparkline.reduce((a, b) => a + b, 0)
          const yday = logSplits[0]?.stat || {}

          enriched[idx] = {
            ...enriched[idx],
            seasonH: ss.hits || 0,
            seasonR: ss.runs || 0,
            seasonRBI: ss.rbi || 0,
            seasonTotal: (ss.hits || 0) + (ss.runs || 0) + (ss.rbi || 0),
            sparkline,
            last7Total,
            yesterdayH: yday.hits || 0,
            yesterdayR: yday.runs || 0,
            yesterdayRBI: yday.rbi || 0,
            heat: computeHeat(last7Total),
          }
        }

        if (!cancelled) {
          setPlayers([...enriched])
        }
        await new Promise((r) => setTimeout(r, 25))
      }
    }

    enrich()
    return () => { cancelled = true }
  }, [gamesData]) // Re-enrich when games data refreshes

  // ── Schedule data (for score cards) ───────────────────────────────────────

  const scheduleGames = gamesData?.games || []

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#060d1a] flex flex-col">
      {/* Sticky header */}
      <Header onOpenPicks={() => setPicksOpen(true)} activeTab={activeTab} />

      {/* Score cards strip — always visible */}
      <ScoreCards
        games={scheduleGames}
        loading={loading}
        error={null}
        onRetry={() => fetchData(true)}
        selectedGamePk={selectedGamePk}
        onSelectGame={setSelectedGamePk}
      />

      {/* Desktop top tabs */}
      <TabNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab content */}
      <main className="flex-1 max-w-screen-2xl mx-auto w-full pb-20 lg:pb-4">
        {loading && !gamesData && (
          <PageSkeleton />
        )}

        {!loading && error && !gamesData && (
          <div className="p-8 text-center">
            <div className="text-5xl mb-4">⚾</div>
            <h3 className="text-xl font-display text-white mb-2">Couldn't load game data</h3>
            <p className="text-sm text-slate-400 mb-4">{error}</p>
            <button
              onClick={() => fetchData(true)}
              className="px-6 py-3 bg-gold-500 hover:bg-gold-400 text-navy-950 font-semibold rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {(gamesData || !loading) && (
          <>
            {activeTab === 'pregame' && (
              <PregameTab
                gamesData={gamesData}
                loading={loading}
                error={error}
                onRetry={() => fetchData(true)}
                stars={stars}
                onToggleStar={handleToggleStar}
                selectedGamePk={selectedGamePk}
                onSelectGame={setSelectedGamePk}
              />
            )}

            {activeTab === 'live' && (
              <LiveTab
                players={players}
                loading={loading}
                error={error}
                onRetry={() => fetchData(false)}
                stars={stars}
                onToggleStar={handleToggleStar}
                selectedGamePk={selectedGamePk}
                lastRefresh={lastRefresh}
              />
            )}

            {activeTab === 'results' && (
              <ResultsTab
                players={players}
                loading={loading}
                error={error}
                onRetry={() => fetchData(true)}
                stars={stars}
                onToggleStar={handleToggleStar}
                selectedGamePk={selectedGamePk}
              />
            )}
          </>
        )}
      </main>

      {/* Mobile bottom tab nav */}
      <TabNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* My Picks modal */}
      <MyPicks
        isOpen={picksOpen}
        onClose={() => setPicksOpen(false)}
        allPlayers={players}
      />
    </div>
  )
}
