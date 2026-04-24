'use client'
import { useState } from 'react'
import TeamBadge from '../ui/TeamBadge'
import { SkeletonMatchupCard } from '../ui/Skeleton'
import { computeMatchupGrade, gradeColor, gradeBgColor, fmtERA } from '@/lib/mlbApi'
import { formatCSTTime } from '@/lib/utils'

function extractPitcherStats(statsData) {
  const splits = statsData?.stats?.[0]?.splits || []
  const stat = splits[0]?.stat || {}
  return {
    era:   stat.era != null ? parseFloat(stat.era) : null,
    kPer9: stat.strikeoutsPer9Inn != null ? parseFloat(stat.strikeoutsPer9Inn) : null,
    whip:  stat.whip != null ? parseFloat(stat.whip) : null,
  }
}

function StatPill({ label, value }) {
  return (
    <div className="text-center">
      <div className="stat-box-label">{label}</div>
      <div className="stat-box-value">{value}</div>
    </div>
  )
}

// ── Mobile chip + expandable drawer ──────────────────────────────────────────

function MatchupChipMobile({ game, isExpanded, onToggle }) {
  const home = game.teams?.home
  const away = game.teams?.away
  const homePitcherStats = extractPitcherStats(game.homePitcherStats)
  const awayPitcherStats = extractPitcherStats(game.awayPitcherStats)
  const avgERA = ((awayPitcherStats.era ?? 4.5) + (homePitcherStats.era ?? 4.5)) / 2
  const grade = computeMatchupGrade(avgERA, avgERA)

  return (
    <div className="flex-shrink-0">
      <button
        onClick={onToggle}
        className={`
          flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-medium
          transition-all duration-150 whitespace-nowrap
          ${isExpanded
            ? 'bg-amber-50 border-amber-300 shadow-sm'
            : 'bg-[var(--bg-card)] border-[var(--border)] hover:border-[var(--border-strong)] card-shadow'
          }
        `}
      >
        <span className="text-[var(--text-secondary)]">{away?.team?.abbreviation}</span>
        <span className="text-[var(--text-muted)]">@</span>
        <span className="text-[var(--text-secondary)]">{home?.team?.abbreviation}</span>
        <span className={`font-bold text-sm ml-0.5 ${gradeColor(grade)}`}
          style={{ fontFamily: "'Bebas Neue', sans-serif" }}
        >
          {grade}
        </span>
      </button>
    </div>
  )
}

function MatchupDetailDrawer({ game }) {
  const home = game.teams?.home
  const away = game.teams?.away
  const homePitcher = home?.probablePitcher
  const awayPitcher = away?.probablePitcher
  const homePitcherStats = extractPitcherStats(game.homePitcherStats)
  const awayPitcherStats = extractPitcherStats(game.awayPitcherStats)
  const avgERA = ((awayPitcherStats.era ?? 4.5) + (homePitcherStats.era ?? 4.5)) / 2
  const grade = computeMatchupGrade(avgERA, avgERA)
  const gameTime = formatCSTTime(game.gameDate)

  return (
    <div className={`mx-0 mt-2 rounded-xl border p-3.5 filter-drawer card-shadow ${gradeBgColor(grade)}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <TeamBadge abbr={away?.team?.abbreviation} size="xs" />
          <span className="text-xs text-[var(--text-muted)]">@</span>
          <TeamBadge abbr={home?.team?.abbreviation} size="xs" />
          <span className="text-xs text-[var(--text-muted)]">{gameTime}</span>
        </div>
        <span className={`text-2xl font-bold ${gradeColor(grade)}`}
          style={{ fontFamily: "'Bebas Neue', sans-serif" }}
        >
          {grade}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="stat-box">
          <div className="stat-box-label mb-1">
            {away?.team?.abbreviation} Starter
          </div>
          {awayPitcher ? (
            <>
              <div className="stat-box-name truncate mb-1.5">
                {awayPitcher.fullName}
              </div>
              <div className="flex gap-3">
                <StatPill label="ERA" value={fmtERA(awayPitcherStats.era)} />
                <StatPill label="K/9" value={awayPitcherStats.kPer9?.toFixed(1) || '--'} />
                <StatPill label="WHIP" value={awayPitcherStats.whip?.toFixed(2) || '--'} />
              </div>
            </>
          ) : <div className="stat-box-label italic">TBA</div>}
        </div>

        <div className="stat-box">
          <div className="stat-box-label mb-1">
            {home?.team?.abbreviation} Starter
          </div>
          {homePitcher ? (
            <>
              <div className="stat-box-name truncate mb-1.5">
                {homePitcher.fullName}
              </div>
              <div className="flex gap-3">
                <StatPill label="ERA" value={fmtERA(homePitcherStats.era)} />
                <StatPill label="K/9" value={homePitcherStats.kPer9?.toFixed(1) || '--'} />
                <StatPill label="WHIP" value={homePitcherStats.whip?.toFixed(2) || '--'} />
              </div>
            </>
          ) : <div className="stat-box-label italic">TBA</div>}
        </div>
      </div>
    </div>
  )
}

// ── Desktop full card ─────────────────────────────────────────────────────────

function MatchupCardDesktop({ game, selectedGamePk, onSelectGame }) {
  const home = game.teams?.home
  const away = game.teams?.away
  const homePitcher = home?.probablePitcher
  const awayPitcher = away?.probablePitcher
  const homePitcherStats = extractPitcherStats(game.homePitcherStats)
  const awayPitcherStats = extractPitcherStats(game.awayPitcherStats)
  const avgERA = ((awayPitcherStats.era ?? 4.5) + (homePitcherStats.era ?? 4.5)) / 2
  const grade = computeMatchupGrade(avgERA, avgERA)
  const isSelected = selectedGamePk === game.gamePk
  const gameTime = formatCSTTime(game.gameDate)

  return (
    <button
      onClick={() => onSelectGame(isSelected ? null : game.gamePk)}
      className={`
        w-full text-left rounded-xl border p-3.5 transition-all duration-150 card-shadow
        ${isSelected ? 'border-amber-300 bg-amber-50' : `${gradeBgColor(grade)} hover:shadow-md`}
      `}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TeamBadge abbr={away?.team?.abbreviation} size="xs" />
          <span className="text-xs text-[var(--text-muted)]">@</span>
          <TeamBadge abbr={home?.team?.abbreviation} size="xs" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)]">{gameTime}</span>
          <span
            className={`text-2xl font-bold leading-none ${gradeColor(grade)}`}
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >
            {grade}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="stat-box">
          <div className="stat-box-label mb-1">
            {away?.team?.abbreviation} Starter
          </div>
          {awayPitcher ? (
            <>
              <div className="stat-box-name truncate mb-1.5">{awayPitcher.fullName}</div>
              <div className="flex gap-3">
                <StatPill label="ERA" value={fmtERA(awayPitcherStats.era)} />
                <StatPill label="K/9" value={awayPitcherStats.kPer9?.toFixed(1) || '--'} />
                <StatPill label="WHIP" value={awayPitcherStats.whip?.toFixed(2) || '--'} />
              </div>
            </>
          ) : <div className="stat-box-label italic">TBA</div>}
        </div>
        <div className="stat-box">
          <div className="stat-box-label mb-1">
            {home?.team?.abbreviation} Starter
          </div>
          {homePitcher ? (
            <>
              <div className="stat-box-name truncate mb-1.5">{homePitcher.fullName}</div>
              <div className="flex gap-3">
                <StatPill label="ERA" value={fmtERA(homePitcherStats.era)} />
                <StatPill label="K/9" value={homePitcherStats.kPer9?.toFixed(1) || '--'} />
                <StatPill label="WHIP" value={homePitcherStats.whip?.toFixed(2) || '--'} />
              </div>
            </>
          ) : <div className="stat-box-label italic">TBA</div>}
        </div>
      </div>
    </button>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function MatchupGrades({ games, loading, selectedGamePk, onSelectGame }) {
  const [expandedPk, setExpandedPk] = useState(null)
  const displayGames = selectedGamePk ? games.filter((g) => g.gamePk === selectedGamePk) : games

  return (
    <section aria-label="Matchup Grades" className="mt-5">
      <div className="flex items-center justify-between mb-3">
        <h2
          className="text-lg text-[var(--text-primary)] tracking-wider"
          style={{ fontFamily: "'Bebas Neue', sans-serif" }}
        >
          ⚡ Matchup Grades
        </h2>
        <div className="flex items-center gap-1 text-xs font-bold">
          <span className="grade-A">A</span>
          <span className="grade-B">B</span>
          <span className="grade-C">C</span>
          <span className="grade-D">D</span>
          <span className="grade-F">F</span>
        </div>
      </div>

      {/* Mobile: horizontal chip strip with expandable drawer */}
      <div className="lg:hidden">
        {loading ? (
          <div className="flex gap-2 overflow-x-auto score-scroll pb-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-24 h-9 rounded-xl skeleton" />
            ))}
          </div>
        ) : (
          <>
            <div className="flex gap-2 overflow-x-auto score-scroll pb-1">
              {displayGames.map((game) => (
                <MatchupChipMobile
                  key={game.gamePk}
                  game={game}
                  isExpanded={expandedPk === game.gamePk}
                  onToggle={() => setExpandedPk(expandedPk === game.gamePk ? null : game.gamePk)}
                />
              ))}
            </div>
            {expandedPk && (
              <MatchupDetailDrawer
                game={displayGames.find((g) => g.gamePk === expandedPk)}
              />
            )}
          </>
        )}
      </div>

      {/* Desktop: vertical stack of full cards */}
      <div className="hidden lg:block space-y-2">
        {loading && Array.from({ length: 3 }).map((_, i) => <SkeletonMatchupCard key={i} />)}
        {!loading && displayGames.map((game) => (
          <MatchupCardDesktop
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
