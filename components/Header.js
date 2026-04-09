'use client'
import { getTodayLabel } from '@/lib/utils'
import { useStars } from '@/hooks/useStars'

export default function Header({ onOpenPicks }) {
  const { starCount } = useStars()

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-200 card-shadow">
      <div className="max-w-screen-2xl mx-auto px-4 py-2.5 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          {/* Desktop */}
          <div className="hidden sm:flex items-center gap-2.5">
            <span className="text-2xl">⚾</span>
            <div>
              <h1
                className="text-2xl leading-none tracking-widest text-slate-900"
                style={{ fontFamily: "'Bebas Neue', sans-serif" }}
              >
                Daily Diamond{' '}
                <span className="text-amber-500">Edge</span>
              </h1>
              <p className="text-[10px] text-slate-400 tracking-widest uppercase mt-0.5">
                Your daily edge on the diamond
              </p>
            </div>
          </div>
          {/* Mobile compact */}
          <div className="flex sm:hidden items-center gap-2">
            <span className="text-xl">⚾</span>
            <span
              className="text-xl leading-none tracking-widest text-slate-900"
              style={{ fontFamily: "'Bebas Neue', sans-serif" }}
            >
              DDE
            </span>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2.5">
          <span className="hidden md:block text-xs text-slate-400">
            {getTodayLabel()}
          </span>

          {/* Stars counter */}
          <div className="flex items-center gap-1.5 bg-amber-50 rounded-lg px-2.5 py-1.5 border border-amber-200">
            <span className="text-amber-500 text-sm leading-none">★</span>
            <span className="text-xs font-semibold text-slate-700 tabular-nums">
              {starCount}/10
            </span>
          </div>

          {/* My Picks */}
          <button
            onClick={onOpenPicks}
            className="flex items-center gap-1.5 bg-white hover:bg-slate-50 rounded-lg px-3 py-1.5 border border-slate-200 hover:border-amber-300 transition-colors min-h-[36px] card-shadow"
            title="My Season Picks"
          >
            <span className="text-sm">📊</span>
            <span className="hidden sm:inline text-xs font-medium text-slate-600">My Picks</span>
          </button>
        </div>
      </div>
    </header>
  )
}
