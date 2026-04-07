'use client'

const TABS = [
  { id: 'pregame', label: 'Pregame', icon: '🎯', mobileLabel: 'Pre' },
  { id: 'live',    label: 'Live',    icon: '⚡', mobileLabel: 'Live' },
  { id: 'results', label: 'Results', icon: '📋', mobileLabel: 'Results' },
]

/**
 * TabNav — desktop top tabs + mobile bottom tab bar
 */
export default function TabNav({ activeTab, onTabChange }) {
  return (
    <>
      {/* Desktop top tab bar */}
      <div className="hidden lg:flex border-b border-navy-800 bg-[#060d1a]/80">
        <div className="max-w-screen-2xl mx-auto w-full px-4 flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                px-6 py-3 text-sm font-medium tracking-wide transition-all duration-150
                border-b-2 -mb-px flex items-center gap-2
                ${activeTab === tab.id
                  ? 'border-gold-500 text-gold-500'
                  : 'border-transparent text-slate-400 hover:text-white hover:border-slate-600'
                }
              `}
              aria-selected={activeTab === tab.id}
              role="tab"
            >
              <span>{tab.icon}</span>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-base tracking-widest">
                {tab.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Mobile bottom tab bar */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 tab-bar bg-navy-900/95 border-t border-navy-700 safe-area-pb"
        role="tablist"
        aria-label="Main navigation"
      >
        <div className="flex">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                flex-1 flex flex-col items-center justify-center py-2 gap-0.5 min-h-[56px]
                transition-colors duration-150
                ${activeTab === tab.id
                  ? 'text-gold-500'
                  : 'text-slate-500 hover:text-slate-300'
                }
              `}
              aria-selected={activeTab === tab.id}
              role="tab"
            >
              <span className="text-xl leading-none">{tab.icon}</span>
              <span className="text-[10px] font-medium tracking-wide">{tab.mobileLabel}</span>
              {activeTab === tab.id && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-gold-500 rounded-full" />
              )}
            </button>
          ))}
        </div>
      </nav>
    </>
  )
}
