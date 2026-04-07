'use client'
import { getTodayLabel } from '@/lib/utils'
import { useStars } from '@/hooks/useStars'

export default function Header({ onOpenPicks, activeTab }) {
  const { starCount } = useStars()

  return (
    <header className="sticky top-0 z-50 bg-[#060d1a]/95 border-b border-navy-800 backdrop-blur-sm">
      <div className="max-w-screen-2xl mx-auto px-4 py-2 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-2xl">⚾</span>
            <div>
              <h1
                className="text-2xl leading-none tracking-widest text-white"
                style={{ fontFamily: "'Bebas Neue', sans-serif" }}
              >
                Daily Diamond Edge
              </h1>
              <p className="text-[10px] text-gold-500 tracking-widest uppercase">
                Your daily edge on the diamond
              </p>
            </div>
          </div>
          {/* Mobile compact */}
          <div className="flex sm:hidden items-center gap-2">
            <span className="text-xl">⚾</span>
            <span
              className="text-xl leading-none tracking-widest text-white"
              style={{ fontFamily: "'Bebas Neue', sans-serif" }}
            >
              DDE
            </span>
          </div>
        </div>

        {/* Right side: date + picks */}
        <div className="flex items-center gap-3">
          <span className="hidden md:block text-xs text-slate-400">
            {getTodayLabel()}
          </span>

          {/* Stars counter */}
          <div className="flex items-center gap-1.5 bg-navy-800 rounded-lg px-2.5 py-1.5 border border-navy-700">
            <span className="text-gold-500 text-sm">★</span>
            <span className="text-xs font-semibold text-white tabular-nums">
              {starCount}/10
            </span>
          </div>

          {/* My Picks button */}
          <button
            onClick={onOpenPicks}
            className="flex items-center gap-1.5 bg-navy-800 hover:bg-navy-700 rounded-lg px-3 py-1.5 border border-navy-700 hover:border-gold-500/50 transition-colors min-h-[36px]"
            title="My Season Picks"
          >
            <span className="text-sm">📊</span>
            <span className="hidden sm:inline text-xs font-medium text-slate-300">My Picks</span>
          </button>
        </div>
      </div>
    </header>
  )
}
