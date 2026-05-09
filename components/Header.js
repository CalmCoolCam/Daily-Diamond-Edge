'use client'
import { getTodayLabel } from '@/lib/utils'
import { useStars } from '@/hooks/useStars'
import { useTheme } from '@/hooks/useTheme'

export default function Header({ onOpenPicks, fgLastUpdated }) {
  const { starCount } = useStars()
  const { isDark, toggleTheme } = useTheme()

  // Format the FanGraphs last-updated date (ISO string → "May 9")
  function fmtFGDate(iso) {
    if (!iso) return null
    try {
      return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    } catch {
      return null
    }
  }
  const fgDateLabel = fmtFGDate(fgLastUpdated)

  return (
    <header className="sticky top-0 z-50 bg-[var(--bg-page)] border-b border-[var(--border)] card-shadow transition-colors">
      <div className="max-w-screen-2xl mx-auto px-4 py-2.5 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          {/* Desktop */}
          <div className="hidden sm:flex items-center gap-3">
            <div style={{ background: 'inherit' }}>
              <img src="/logo.png" alt="Daily Diamond Edge" className="mix-blend-normal" style={{ height: '52px', width: 'auto', display: 'block' }} />
            </div>
            <div className="flex flex-col gap-0.5">
              <p className="text-[10px] text-[var(--text-muted)] tracking-widest uppercase">
                Your daily edge on the diamond
              </p>
              {fgDateLabel && (
                <p className="text-[9px] text-emerald-600 font-medium">
                  FG Data: Updated {fgDateLabel}
                </p>
              )}
            </div>
          </div>
          {/* Mobile compact */}
          <div className="flex sm:hidden items-center gap-2">
            <div style={{ background: 'inherit' }}>
              <img src="/logo.png" alt="Daily Diamond Edge" className="mix-blend-normal" style={{ height: '38px', width: 'auto', display: 'block' }} />
            </div>
            {fgDateLabel && (
              <span className="text-[8px] text-emerald-600 font-medium">FG {fgDateLabel}</span>
            )}
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <span className="hidden md:block text-xs text-[var(--text-muted)]">
            {getTodayLabel()}
          </span>

          {/* Stars counter */}
          <div className="flex items-center gap-1.5 bg-amber-50 rounded-lg px-2.5 py-1.5 border border-amber-200">
            <span className="text-amber-500 text-sm leading-none">★</span>
            <span className="text-xs font-semibold text-[var(--text-secondary)] tabular-nums">
              {starCount}/10
            </span>
          </div>

          {/* My Picks */}
          <button
            onClick={onOpenPicks}
            className="flex items-center gap-1.5 bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] rounded-lg px-3 py-1.5 border border-[var(--border)] hover:border-amber-300 transition-colors min-h-[36px] card-shadow"
            title="My Season Picks"
          >
            <span className="text-sm">📊</span>
            <span className="hidden sm:inline text-xs font-medium text-[var(--text-secondary)]">My Picks</span>
          </button>

          {/* Dark/Light mode toggle */}
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center w-9 h-9 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] transition-colors"
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <span className="text-base leading-none select-none">
              {isDark ? '☀️' : '🌙'}
            </span>
          </button>
        </div>
      </div>
    </header>
  )
}
