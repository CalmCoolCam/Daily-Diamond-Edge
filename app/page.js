'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Header from '@/components/Header'
import ScoreCards from '@/components/ScoreCards'
import TabNav from '@/components/TabNav'
import PregameTab from '@/components/pregame/PregameTab'
import LeaderboardTab from '@/components/leaderboard/LeaderboardTab'
import PlayerListTab from '@/components/players/PlayerListTab'
import MyPicks from '@/components/MyPicks'
import { useStars } from '@/hooks/useStars'
import { usePicks } from '@/hooks/usePicks'
import { extractSparklineData, computePlayerTiers, computeProvisionalGrade, currentSeason } from '@/lib/mlbApi'
import { getCached, setCached } from '@/lib/storage'
import { PageSkeleton } from '@/components/ui/Skeleton'

const REFRESH_MS = 60_000

export default function App() {
  const [activeTab, setActiveTab] = useState('leaderboard')
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

  function handleToggleStar(playerId, meta) {
    const result = toggleStar(playerId, meta)
    if (result?.starred) refreshPicks()
    return result
  }

  // ── Build player list from raw game data + live batting stats ──────────────

  function buildPlayerList(games, liveStatsGames = {}) {
    const list = []

    for (const game of games) {
      const homeTeam = game.teams?.home?.team
      const awayTeam = game.teams?.away?.team
      const gameStatus = game.status?.abstractGameState

      // Live batting stats from /api/mlb/games/live-stats
      const gameLive = liveStatsGames[game.gamePk] || {}

      for (const side of ['home', 'away']) {
        const team     = side === 'home' ? homeTeam : awayTeam
        const opponent = side === 'home' ? awayTeam : homeTeam
        const roster   = side === 'home' ? game.homeRoster : game.awayRoster
        // liveSideStats keyed by player ID string: { h, r, rbi, ab, hr, bb, sb, so }
        const liveSideStats = side === 'home' ? (gameLive.home || {}) : (gameLive.away || {})

        if (!roster?.roster) continue

        for (const member of roster.roster) {
          if (member.position?.abbreviation === 'P') continue

          const pid = member.person?.id
          const livePlayerStats = liveSideStats[String(pid)] || {}

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
            // Provisional grade computed after enrichment (uses last7Total + pitcher stats)
            matchupGrade: '--',
            // Today: from live-stats feed (hits/runs/rbi NOT homeRuns)
            todayH:   livePlayerStats.h   || 0,
            todayR:   livePlayerStats.r   || 0,
            todayRBI: livePlayerStats.rbi || 0,
            todayAB:  livePlayerStats.ab  || 0,
            todayHR:  livePlayerStats.hr  || 0,
            todayBB:  livePlayerStats.bb  || 0,
            todaySB:  livePlayerStats.sb  || 0,
            todaySO:  livePlayerStats.so  || 0,
            // Season stats & game log populated via enrichment
            heatTier: 4,
            seasonH: 0, seasonR: 0, seasonRBI: 0, seasonHR: 0, seasonAVG: null, seasonOPS: null, seasonTotal: 0,
            sparkline: [], last7Total: 0,
            last7Hits: 0, last7Runs: 0, last7HR: 0, last7BB: 0, last7SB: 0, last7SO: 0,
            yesterdayH: 0, yesterdayR: 0, yesterdayRBI: 0,
          })
        }
      }
    }

    return list
  }

  // ── Fetch today's game data + live batting stats ───────────────────────────

  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)

    try {
      setError(null)

      // Fetch rosters/schedule and live batting stats in parallel
      const [todayRes, liveRes] = await Promise.allSettled([
        fetch('/api/mlb/games/today'),
        fetch('/api/mlb/games/live-stats'),
      ])

      if (todayRes.status !== 'fulfilled' || !todayRes.value.ok) {
        const msg = todayRes.status === 'fulfilled'
          ? await todayRes.value.json().then((j) => j.error || `HTTP ${todayRes.value.status}`).catch(() => 'Server error')
          : 'Network error'
        throw new Error(msg)
      }

      const json = await todayRes.value.json()
      const liveStats = liveRes.status === 'fulfilled' && liveRes.value.ok
        ? await liveRes.value.json()
        : { games: {} }

      isLiveRef.current = json.games?.some(
        (g) => g.status?.abstractGameState === 'Live',
      ) || false

      setGamesData(json)

      const built = buildPlayerList(json.games || [], liveStats.games || {})

      // Detect stat changes for highlight animation
      const updated = new Set()
      built.forEach((p) => {
        const prev = prevPlayersRef.current[p.id]
        if (!prev) return
        if (prev.todayH !== p.todayH || prev.todayR !== p.todayR || prev.todayRBI !== p.todayRBI) {
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
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Initial load + periodic refresh when Live tab active or live games exist
  useEffect(() => {
    fetchData(true)

    intervalRef.current = setInterval(() => {
      if (isLiveRef.current) {
        fetchData(false)
      }
    }, REFRESH_MS)

    return () => clearInterval(intervalRef.current)
  }, [fetchData, activeTab])

  // ── Progressively enrich players with season stats + game logs ─────────────

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

        // Cache key includes today's date so results expire daily (not just by TTL)
        const todayDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
        const cacheKey = `batch_${season}_${todayDate}_${ids.slice(0, 3).join('-')}`
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
          // Season stats: type=season → splits[0].stat → hits/runs/rbi
          const seasonStat = statsArr.find((s) => s.type?.displayName === 'season')
          // Game log: type=gameLog → splits[] per game, most-recent-first, NOT cumulative
          const gameLog = statsArr.find((s) => s.type?.displayName === 'gameLog')

          const ss = seasonStat?.splits?.[0]?.stat || {}
          // Game log splits: all entries within the 7-day calendar window
          // (startDate = today-7 CST, endDate = yesterday CST — set by batch route)
          // Each split is ONE game. Sum ALL entries for the 7-day total.
          // Doubleheader games on the same day each get their own split entry.
          // Field path: splits[].stat.hits + stat.runs (NOT homeRuns) + stat.rbi
          const logSplits = gameLog?.splits || []

          // Pass ALL splits in the window — date range already limits to 7 days
          const sparklineInput = logSplits.map((s) => ({ stat: s.stat }))
          const sparkline = extractSparklineData(sparklineInput, 7)
          // Sum ALL splits in the window (not capped at 7 entries — handles doubleheaders)
          let last7Total = 0, last7Hits = 0, last7Runs = 0, last7HR = 0, last7BB = 0, last7SB = 0, last7SO = 0
          for (const s of logSplits) {
            const st = s.stat || {}
            last7Hits  += st.hits         || 0
            last7Runs  += st.runs         || 0
            last7HR    += st.homeRuns     || 0
            last7BB    += st.baseOnBalls  || 0
            last7SB    += st.stolenBases  || 0
            last7SO    += st.strikeOuts   || 0
            last7Total += (st.hits || 0) + (st.runs || 0) + (st.rbi || 0)
          }
          // Yesterday = most recent game log entry (logSplits[0], most-recent-first)
          const yday = logSplits[0]?.stat || {}

          enriched[idx] = {
            ...enriched[idx],
            seasonH:     ss.hits      || 0,
            seasonR:     ss.runs      || 0,
            seasonRBI:   ss.rbi       || 0,
            seasonHR:    ss.homeRuns  || 0,
            seasonAVG:   ss.avg       || null,
            seasonOPS:   ss.ops       || null,
            seasonTotal: (ss.hits || 0) + (ss.runs || 0) + (ss.rbi || 0),
            sparkline,
            last7Total,
            last7Hits, last7Runs, last7HR, last7BB, last7SB, last7SO,
            yesterdayH:   yday.hits || 0,
            yesterdayR:   yday.runs || 0,
            yesterdayRBI: yday.rbi  || 0,
          }
        }

        if (!cancelled) {
          // Compute relative heat tiers from full enriched list (top-5 = tier 1, etc.)
          const tiers = computePlayerTiers(enriched)
          // Build a gamePk → game lookup for provisional grade computation
          const gameMap = {}
          for (const g of gamesData?.games || []) gameMap[g.gamePk] = g
          setPlayers(enriched.map((p) => ({
            ...p,
            heatTier: tiers[p.id] || 4,
            matchupGrade: computeProvisionalGrade(p, gameMap[p.gamePk]),
          })))
        }
        await new Promise((r) => setTimeout(r, 25))
      }
    }

    enrich()
    return () => { cancelled = true }
  }, [gamesData]) // Re-enrich when games data refreshes

  const scheduleGames = gamesData?.games || []

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[var(--bg-page)] flex flex-col transition-colors">
      <Header onOpenPicks={() => setPicksOpen(true)} activeTab={activeTab} />

      {/* ScoreCards strip — hidden on Daily Matchups tab (that tab has its own vertical list) */}
      {activeTab !== 'dailymatchups' && (
        <ScoreCards
          games={scheduleGames}
          loading={loading}
          error={null}
          onRetry={() => fetchData(true)}
          selectedGamePk={selectedGamePk}
          onSelectGame={setSelectedGamePk}
        />
      )}

      {/* Tab nav — desktop top bar + mobile bottom bar */}
      <TabNav activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="flex-1 max-w-screen-2xl mx-auto w-full pb-20 lg:pb-4">
        {loading && !gamesData && <PageSkeleton />}

        {!loading && error && !gamesData && (
          <div className="p-8 text-center">
            <div className="text-5xl mb-4">⚾</div>
            <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Couldn&apos;t load game data</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-4">{error}</p>
            <button
              onClick={() => fetchData(true)}
              className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-white font-semibold rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {(gamesData || !loading) && (
          <>
            {activeTab === 'dailymatchups' && (
              <PregameTab
                players={players}
                stars={stars}
                onToggleStar={handleToggleStar}
                selectedGamePk={selectedGamePk}
                onSelectGame={setSelectedGamePk}
              />
            )}

            {activeTab === 'leaderboard' && (
              <LeaderboardTab
                players={players}
                games={scheduleGames}
                loading={loading}
                error={error}
                onRetry={() => fetchData(true)}
                stars={stars}
                onToggleStar={handleToggleStar}
                selectedGamePk={selectedGamePk}
              />
            )}

            {activeTab === 'players' && (
              <PlayerListTab
                players={players}
                games={scheduleGames}
                loading={loading}
                error={error}
                onRetry={() => fetchData(true)}
                stars={stars}
                onToggleStar={handleToggleStar}
                selectedGamePk={selectedGamePk}
                updatedIds={updatedIds}
              />
            )}
          </>
        )}
      </main>

      <MyPicks
        isOpen={picksOpen}
        onClose={() => setPicksOpen(false)}
        allPlayers={players}
      />
    </div>
  )
}
