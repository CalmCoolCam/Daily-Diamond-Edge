'use client'
import TeamBadge from '../ui/TeamBadge'
import { SkeletonMatchupCard } from '../ui/Skeleton'
import { computeMatchupGrade, gradeColor, gradeBgColor, fmtERA } from '@/lib/mlbApi'
import { formatCSTTime } from '@/lib/utils'

function extractPitcherStats(statsData) {
  const splits = statsData?.stats?.[0]?.splits || []
  const stat = splits[0]?.stat || {}
  return {
    era: stat.era != null ? parseFloat(stat.era) : null,
    kPer9: stat.strikeoutsPer9Inn != null ? parseFloat(stat.strikeoutsPer9Inn) : null,
    whip: stat.whip != null ? parseFloat(stat.whip) : null,
    wins: stat.wins || 0,
    losses: stat.losses || 0,
    ip: stat.inningsPitched || '0',
  }
}

function StatPill({ label, value }) {
  return (
    <div className="text-center">
      <div className="text-[9px] text-slate-500 uppercase tracking-wider">{label}</div>
      <div className="text-xs font-semibold text-white tabular-nums">{value}</div>
    </div>
  )
}

function MatchupCard({ game, selectedGamePk, onSelectGame }) {
  const home = game.teams?.home
  const away = game.teams?.away
  const homePitcher = home?.probablePitcher
  const awayPitcher = away?.probablePitcher

  const homePitcherStats = extractPitcherStats(game.homePitcherStats)
  const awayPitcherStats = extractPitcherStats(game.awayPitcherStats)

  // Grade is based on pitcher ERA batting team sees
  // Away batters face home pitcher → grade from home pitcher stats
  // Home batters face away pitcher → grade from away pitcher stats
  // Use combined as the "game" grade shown on the card
  const homeERA = awayPitcherStats.era ?? 4.5
  const awayERA = homePitcherStats.era ?? 4.5
  const avgERA = (homeERA + awayERA) / 2
  const gameGrade = computeMatchupGrade(avgERA, avgERA) // simplified single-game grade

  const isSelected = selectedGamePk === game.gamePk
  const gameTime = formatCSTTime(game.gameDate)

  return (
    <button
      onClick={() => onSelectGame(isSelected ? null : game.gamePk)}
      className={`
        w-full text-left rounded-xl border p-3.5 transition-all duration-150
        hover:border-navy-600
        ${isSelected
          ? 'border-gold-500/40 bg-navy-700/60'
          : `border-navy-700 ${gradeBgColor(gameGrade)}`
        }
      `}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TeamBadge abbr={away?.team?.abbreviation} size="xs" />
          <span className="text-xs text-slate-400">@</span>
          <TeamBadge abbr={home?.team?.abbreviation} size="xs" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">{gameTime}</span>
          <div className={`text-2xl font-bold leading-none ${gradeColor(gameGrade)}`}
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >
            {gameGrade}
          </div>
        </div>
      </div>

      {/* Pitchers */}
      <div className="grid grid-cols-2 gap-2">
        {/* Away starter */}
        <div className="bg-navy-900/60 rounded-lg p-2">
          <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">
            {away?.team?.abbreviation} Starter
          </div>
          {awayPitcher ? (
            <>
              <div className="text-xs font-medium text-white truncate mb-1.5">
                {awayPitcher.fullName}
              </div>
              <div className="flex gap-2.5">
                <StatPill label="ERA" value={fmtERA(awayPitcherStats.era)} />
                <StatPill label="K/9" value={awayPitcherStats.kPer9?.toFixed(1) || '--'} />
                <StatPill label="WHIP" value={awayPitcherStats.whip?.toFixed(2) || '--'} />
              </div>
            </>
          ) : (
            <div className="text-xs text-slate-600 italic">TBD</div>
          )}
        </div>

        {/* Home starter */}
        <div className="bg-navy-900/60 rounded-lg p-2">
          <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">
            {home?.team?.abbreviation} Starter
          </div>
          {homePitcher ? (
            <>
              <div className="text-xs font-medium text-white truncate mb-1.5">
                {homePitcher.fullName}
              </div>
              <div className="flex gap-2.5">
                <StatPill label="ERA" value={fmtERA(homePitcherStats.era)} />
                <StatPill label="K/9" value={homePitcherStats.kPer9?.toFixed(1) || '--'} />
                <StatPill label="WHIP" value={homePitcherStats.whip?.toFixed(2) || '--'} />
              </div>
            </>
          ) : (
            <div className="text-xs text-slate-600 italic">TBD</div>
          )}
        </div>
      </div>
    </button>
  )
}

export default function MatchupGrades({ games, loading, selectedGamePk, onSelectGame }) {
  const displayGames = selectedGamePk
    ? games.filter((g) => g.gamePk === selectedGamePk)
    : games

  return (
    <section aria-label="Matchup Grades" className="mt-5">
      <div className="flex items-center justify-between mb-3">
        <h2
          className="text-lg text-white tracking-wider"
          style={{ fontFamily: "'Bebas Neue', sans-serif" }}
        >
          ⚡ Matchup Grades
        </h2>
        <div className="flex items-center gap-1 text-[10px] text-slate-600">
          <span className="grade-A">A</span>
          <span className="grade-B">B</span>
          <span className="grade-C">C</span>
          <span className="grade-D">D</span>
          <span className="grade-F">F</span>
        </div>
      </div>

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonMatchupCard key={i} />)}
        </div>
      )}

      {!loading && displayGames.length === 0 && (
        <div className="text-sm text-slate-500 text-center py-4">
          No games to show
        </div>
      )}

      <div className="space-y-2">
        {displayGames.map((game) => (
          <MatchupCard
            key={game.gamePk}
            game={game}
            selectedGamePk={selectedGamePk}
            onSelectGame={onSelectGame}
          />
        ))}
      </div>
    </section>
  )
}
