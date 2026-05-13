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
import {
  extractSparklineData, computePlayerTiers, computeProvisionalGrade,
  currentSeason, scoreToGrade, computeBatterMatchupScore, computePitcherMatchupScore,
} from '@/lib/mlbApi'
import {
  getFanGraphsBatters, getFanGraphsPitchers, getTeamWrcAverages, getFanGraphsLastUpdated,
} from '@/lib/fangraphsData'
import { getCached, setCached } from '@/lib/storage'
import { PageSkeleton } from '@/components/ui/Skeleton'

const REFRESH_MS = 60_000
const PITCHER_BATCH_TTL = 60 * 60 * 1000  // 1 hour

export default function App() {
  const [activeTab, setActiveTab] = useState('leaderboard')
  const [picksOpen, setPicksOpen] = useState(false)
  const [selectedGamePk, setSelectedGamePk] = useState(null)

  // Master data state
  const [gamesData, setGamesData]               = useState(null)
  const [players, setPlayers]                   = useState([])
  const [pitchers, setPitchers]                 = useState([])
  const [probableStarterIds, setProbableStarterIds] = useState(new Set())
  const [loading, setLoading]                   = useState(true)
  const [error, setError]                       = useState(null)
  const [updatedIds, setUpdatedIds]             = useState(new Set())

  // FanGraphs state
  const [fgBatters, setFgBatters]       = useState({})
  const [fgPitchers, setFgPitchers]     = useState({})
  const [fgLastUpdated, setFgLastUpdated] = useState(null)
  const fgLoadedRef = useRef(false)

  const prevPlayersRef = useRef({})
  const intervalRef    = useRef(null)
  const isLiveRef      = useRef(false)

  // Stars + picks
  const { stars, isStarred, toggle: toggleStar } = useStars()
  const { refresh: refreshPicks } = usePicks()

  function handleToggleStar(playerId, meta) {
    const result = toggleStar(playerId, meta)
    if (result?.starred) refreshPicks()
    return result
  }

  // ── Load FanGraphs data (once per session) ──────────────────────────────────

  const loadFanGraphsData = useCallback(async () => {
    if (fgLoadedRef.current) return
    fgLoadedRef.current = true
    try {
      const [batters, pitchersFG, lastUpdated] = await Promise.all([
        getFanGraphsBatters(),
        getFanGraphsPitchers(),
        getFanGraphsLastUpdated(),
      ])
      setFgBatters(batters)
      setFgPitchers(pitchersFG)
      setFgLastUpdated(lastUpdated)
    } catch {
      // Supabase unavailable — fallback: keep empty objects, grades redistribute weights
    }
  }, [])

  // ── Build batter list from raw game data ────────────────────────────────────

  function buildPlayerList(games, liveStatsGames = {}) {
    const list = []
    for (const game of games) {
      const homeTeam = game.teams?.home?.team
      const awayTeam = game.teams?.away?.team
      const gameStatus = game.status?.abstractGameState
      const gameLive   = liveStatsGames[game.gamePk] || {}

      for (const side of ['home', 'away']) {
        const team          = side === 'home' ? homeTeam : awayTeam
        const opponent      = side === 'home' ? awayTeam : homeTeam
        const roster        = side === 'home' ? game.homeRoster : game.awayRoster
        const liveSideStats = side === 'home' ? (gameLive.home || {}) : (gameLive.away || {})

        if (!roster?.roster) continue

        for (const member of roster.roster) {
          if (member.position?.abbreviation === 'P') continue  // batters only

          const pid = member.person?.id
          const livePlayerStats = liveSideStats[String(pid)] || {}

          list.push({
            id: pid,
            name:         member.person?.fullName || '',
            teamId:       team?.id,
            teamAbbr:     team?.abbreviation || '',
            opponentAbbr: opponent?.abbreviation || '',
            position:     member.position?.abbreviation || '',
            gamePk:       game.gamePk,
            gameStatus,
            isHome:       side === 'home',
            matchupGrade: '--',
            todayH:   livePlayerStats.h   || 0,
            todayR:   livePlayerStats.r   || 0,
            todayRBI: livePlayerStats.rbi || 0,
            todayAB:  livePlayerStats.ab  || 0,
            todayHR:  livePlayerStats.hr  || 0,
            todayBB:  livePlayerStats.bb  || 0,
            todaySB:  livePlayerStats.sb  || 0,
            todaySO:  livePlayerStats.so  || 0,
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

  // ── Build pitcher list from roster data ─────────────────────────────────────

  function buildPitcherList(games, probIds = new Set()) {
    const seen = new Set()
    const list = []

    for (const game of games) {
      const homeTeam = game.teams?.home?.team
      const awayTeam = game.teams?.away?.team

      for (const side of ['home', 'away']) {
        const team     = side === 'home' ? homeTeam : awayTeam
        const opponent = side === 'home' ? awayTeam : homeTeam
        const roster   = side === 'home' ? game.homeRoster : game.awayRoster

        if (!roster?.roster) continue

        for (const member of roster.roster) {
          if (member.position?.abbreviation !== 'P') continue  // pitchers only
          const pid = member.person?.id
          if (!pid || seen.has(pid)) continue
          seen.add(pid)

          // Record position code from roster for SP/RP classification
          const rosterPositionCode = member.position?.code || ''

          list.push({
            id:                pid,
            name:              member.person?.fullName || '',
            teamId:            team?.id,
            teamAbbr:          team?.abbreviation || '',
            opponentAbbr:      opponent?.abbreviation || '',
            throws:            member.person?.pitchHand?.code || null,
            gamePk:            game.gamePk,
            isHome:            side === 'home',
            matchupGrade:      '--',
            matchupScore:      null,
            fgData:            null,
            seasonIP:          '--',
            last3:             [],
            last5:             [],
            last3Avg:          null,
            opposingTeamAbbr:  opponent?.abbreviation || '',
            rosterPositionCode,
            // Probable starters are always classified as SP
            pitcherType:       probIds.has(pid) ? 'SP' : null,
          })
        }
      }
    }
    return list
  }

  // ── Fetch today's game data + live batting stats ─────────────────────────────

  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    try {
      setError(null)
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

      const json      = await todayRes.value.json()
      const liveStats = liveRes.status === 'fulfilled' && liveRes.value.ok
        ? await liveRes.value.json()
        : { games: {} }

      isLiveRef.current = json.games?.some((g) => g.status?.abstractGameState === 'Live') || false

      setGamesData(json)

      // Build probable starter ID set from today's schedule
      const probIds = new Set()
      for (const g of json.games || []) {
        if (g.teams?.home?.probablePitcher?.id) probIds.add(g.teams.home.probablePitcher.id)
        if (g.teams?.away?.probablePitcher?.id) probIds.add(g.teams.away.probablePitcher.id)
      }
      setProbableStarterIds(probIds)

      const built = buildPlayerList(json.games || [], liveStats.games || {})
      const pitcherBuilt = buildPitcherList(json.games || [], probIds)

      // Detect stat changes for animation
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
      setPitchers(pitcherBuilt)
    } catch (err) {
      setError(err.message)
    } finally {
      if (showLoading) setLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Initial load + periodic refresh
  useEffect(() => {
    fetchData(true)
    intervalRef.current = setInterval(() => {
      if (isLiveRef.current) fetchData(false)
    }, REFRESH_MS)
    return () => clearInterval(intervalRef.current)
  }, [fetchData, activeTab])

  // Load FanGraphs data on first tab switch to 'players' (or eagerly after first data load)
  useEffect(() => {
    if (gamesData && !fgLoadedRef.current) loadFanGraphsData()
  }, [gamesData, loadFanGraphsData])

  // Also load on players tab activation
  useEffect(() => {
    if (activeTab === 'players') loadFanGraphsData()
  }, [activeTab, loadFanGraphsData])

  // ── Enrich batters with season stats + game logs ────────────────────────────

  useEffect(() => {
    if (!players.length) return
    const season    = currentSeason()
    let cancelled   = false
    const BATCH     = 10

    async function enrich() {
      const enriched = [...players]

      for (let i = 0; i < enriched.length; i += BATCH) {
        if (cancelled) break
        const batch = enriched.slice(i, i + BATCH)
        const ids   = batch.map((p) => p.id).filter(Boolean)
        if (!ids.length) continue

        const todayDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
        const cacheKey  = `batch_${season}_${todayDate}_${ids.slice(0, 3).join('-')}`
        let result = getCached(cacheKey)

        if (!result) {
          try {
            const res = await fetch(`/api/mlb/players/batch?ids=${ids.join(',')}&season=${season}`)
            if (!res.ok) continue
            result = await res.json()
            setCached(cacheKey, result)
          } catch { continue }
        }

        for (const item of result?.players || []) {
          const idx = enriched.findIndex((p) => p.id === item.personId)
          if (idx === -1) continue

          const statsArr  = item.data?.stats || []
          const seasonStat = statsArr.find((s) => s.type?.displayName === 'season')
          const gameLog    = statsArr.find((s) => s.type?.displayName === 'gameLog')

          const ss        = seasonStat?.splits?.[0]?.stat || {}
          const logSplits = gameLog?.splits || []

          const sparklineInput = logSplits.map((s) => ({ stat: s.stat }))
          const sparkline      = extractSparklineData(sparklineInput, 7)

          let last7Total = 0, last7Hits = 0, last7Runs = 0, last7HR = 0, last7BB = 0, last7SB = 0, last7SO = 0
          for (const s of logSplits) {
            const st = s.stat || {}
            last7Hits  += st.hits        || 0
            last7Runs  += st.runs        || 0
            last7HR    += st.homeRuns    || 0
            last7BB    += st.baseOnBalls || 0
            last7SB    += st.stolenBases || 0
            last7SO    += st.strikeOuts  || 0
            last7Total += (st.hits || 0) + (st.runs || 0) + (st.rbi || 0)
          }
          const yday = logSplits[0]?.stat || {}

          enriched[idx] = {
            ...enriched[idx],
            seasonH:     ss.hits     || 0,
            seasonR:     ss.runs     || 0,
            seasonRBI:   ss.rbi      || 0,
            seasonHR:    ss.homeRuns || 0,
            seasonAVG:   ss.avg      || null,
            seasonOPS:   ss.ops      || null,
            seasonTotal: (ss.hits || 0) + (ss.runs || 0) + (ss.rbi || 0),
            sparkline,
            last7Total, last7Hits, last7Runs, last7HR, last7BB, last7SB, last7SO,
            yesterdayH:   yday.hits || 0,
            yesterdayR:   yday.runs || 0,
            yesterdayRBI: yday.rbi  || 0,
          }
        }

        if (!cancelled) {
          const tiers   = computePlayerTiers(enriched)
          const gameMap = {}
          for (const g of gamesData?.games || []) gameMap[g.gamePk] = g

          // Compute batter matchup grade using FanGraphs if available
          const allScores = enriched.map((p) => {
            const game       = gameMap[p.gamePk]
            if (!game) return 50
            const isHome     = p.isHome
            const pitcherObj = isHome ? game.teams?.away?.probablePitcher : game.teams?.home?.probablePitcher
            const bullpenERA = isHome
              ? parseFloat(game.teams?.away?.team?.bullpenERA) || 4.5
              : parseFloat(game.teams?.home?.team?.bullpenERA) || 4.5
            const fgP = pitcherObj?.fullName ? (fgPitchers[pitcherObj.fullName] || null) : null
            const fgB = fgBatters[p.name] || null
            // ERA+ and handedness splits are fetched lazily on row expansion — null here
            const { score } = computeBatterMatchupScore({
              starterSIERA:  fgP?.siera   != null ? parseFloat(fgP.siera)   : null,
              starterXFIP:   fgP?.xfip    != null ? parseFloat(fgP.xfip)    : null,
              starterERAplus: null,
              vsPlayer:      null,
              batterSplitOPS: null,
              batterForm:    p.last7Total || 0,
              batterWRC:     fgB?.wrc_plus != null ? parseFloat(fgB.wrc_plus) : null,
              batterBABIP:   fgB?.babip    != null ? parseFloat(fgB.babip)    : null,
              bullpenERA,
            })
            return score
          })

          setPlayers(enriched.map((p, idx2) => {
            const game   = gameMap[p.gamePk]
            const grade  = game ? scoreToGrade(allScores[idx2], allScores) : '--'
            return {
              ...p,
              heatTier:     tiers[p.id] || 4,
              matchupGrade: grade,
              matchupScore: allScores[idx2],
            }
          }))
        }
        await new Promise((r) => setTimeout(r, 25))
      }
    }

    enrich()
    return () => { cancelled = true }
  }, [gamesData, fgBatters, fgPitchers]) // re-enrich when FG data arrives

  // ── Enrich pitchers with season stats + last 3 starts + FanGraphs ──────────

  useEffect(() => {
    if (!pitchers.length || !gamesData) return
    const season  = currentSeason()
    let cancelled = false
    const BATCH   = 10

    async function enrichPitchers() {
      const enriched = [...pitchers]

      for (let i = 0; i < enriched.length; i += BATCH) {
        if (cancelled) break
        const batch = enriched.slice(i, i + BATCH)
        const ids   = batch.map((p) => p.id).filter(Boolean)
        if (!ids.length) continue

        const todayDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
        const cacheKey  = `pitcher_enrich_${season}_${todayDate}_${ids.slice(0, 3).join('-')}`
        let result = getCached(cacheKey)

        if (!result) {
          try {
            const res = await fetch(`/api/mlb/players/pitcher-batch?ids=${ids.join(',')}&season=${season}`)
            if (!res.ok) continue
            result = await res.json()
            setCached(cacheKey, result, PITCHER_BATCH_TTL)
          } catch { continue }
        }

        for (const item of result?.pitchers || []) {
          const idx = enriched.findIndex((p) => p.id === item.personId)
          if (idx === -1) continue
          const p = enriched[idx]

          // SP/RP classification: probable starter > roster code > GS fallback
          let pitcherType = p.pitcherType  // 'SP' if already marked as probable
          if (!pitcherType) {
            const code = p.rosterPositionCode
            if (code === 'SP') pitcherType = 'SP'
            else if (code === 'RP' || code === 'CL') pitcherType = 'RP'
            else pitcherType = (item.seasonGS || 0) > 0 ? 'SP' : 'RP'
          }

          enriched[idx] = {
            ...p,
            seasonERA:  item.seasonERA,
            seasonWHIP: item.seasonWHIP,
            seasonIP:   item.seasonIP,
            seasonW:    item.seasonW,
            seasonL:    item.seasonL,
            seasonSV:   item.seasonSV,
            seasonHLD:  item.seasonHLD,
            seasonGS:   item.seasonGS,
            last3:      item.last3 || [],
            last5:      item.last5 || [],
            last3Avg:   item.last3Avg,
            pitcherType,
          }
        }

        if (!cancelled) {
          // Attach FanGraphs data + compute pitcher matchup score
          const teamWrcMap = await getTeamWrcAverages().catch(() => ({}))
          const withFG = enriched.map((p) => {
            const fgP     = fgPitchers[p.name] || null
            const oppTeam = teamWrcMap[p.opposingTeamAbbr] || null
            const kPct  = fgP?.k_pct  != null ? parseFloat(fgP.k_pct)  : null
            const bbPct = fgP?.bb_pct != null ? parseFloat(fgP.bb_pct) : null

            const { score } = computePitcherMatchupScore({
              pitcherXFIP:     fgP?.xfip  != null ? parseFloat(fgP.xfip)  : null,
              pitcherSIERA:    fgP?.siera != null ? parseFloat(fgP.siera) : null,
              opposingWRC:     oppTeam?.wrc_plus  != null ? parseFloat(oppTeam.wrc_plus)  : null,
              pitcherKPct:     kPct,
              pitcherBBPct:    bbPct,
              last3StartsAvg:  p.last3Avg,
              opposingHardPct: oppTeam?.hard_pct  != null ? parseFloat(oppTeam.hard_pct)  : null,
            })
            return { ...p, fgData: fgP, matchupScore: score }
          })

          // Percentile-based grades across all pitchers with games today
          const allScores = withFG.map((p) => p.matchupScore ?? 50)
          setPitchers(withFG.map((p) => ({
            ...p,
            matchupGrade: p.gamePk ? scoreToGrade(p.matchupScore ?? 50, allScores) : '--',
          })))
        }
        await new Promise((r) => setTimeout(r, 25))
      }
    }

    enrichPitchers()
    return () => { cancelled = true }
  }, [gamesData, fgPitchers]) // re-enrich when FG data arrives

  const scheduleGames = gamesData?.games || []

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[var(--bg-page)] flex flex-col transition-colors">
      <Header onOpenPicks={() => setPicksOpen(true)} fgLastUpdated={fgLastUpdated} />

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
                pitchers={pitchers}
                games={scheduleGames}
                loading={loading}
                error={error}
                onRetry={() => fetchData(true)}
                stars={stars}
                onToggleStar={handleToggleStar}
                selectedGamePk={selectedGamePk}
                updatedIds={updatedIds}
                fgBatters={fgBatters}
                fgPitchers={fgPitchers}
                probableStarterIds={probableStarterIds}
              />
            )}
          </>
        )}
      </main>

      <MyPicks isOpen={picksOpen} onClose={() => setPicksOpen(false)} allPlayers={players} />
    </div>
  )
}
