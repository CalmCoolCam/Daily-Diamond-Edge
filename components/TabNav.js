'use client'

function BatterIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20" aria-hidden="true">
      <circle cx="10" cy="3" r="2" />
      <path d="M7.5 6h5l.8 3.5H6.7L7.5 6z" />
      <path d="M6.7 9.5l-.8 4h1.5l.5-2h4.2l.5 2h1.5l-.8-4H6.7z" />
      <path d="M9 13.5v4h2v-4H9z" />
      <path d="M13.5 7.5l4.5-2.5-.6-1.2-4.5 2.5.6 1.2z" />
    </svg>
  )
}

const TABS = [
  { id: 'leaderboard',   label: 'Leaderboard',    icon: '🏆', mobileLabel: 'Board'    },
  { id: 'dailymatchups', label: 'Daily Matchups', icon: '🎯', mobileLabel: 'Matchups' },
  { id: 'players',       label: 'Player List',    icon: <BatterIcon />, mobileLabel: 'Players' },
]

export default function TabNav({ activeTab, onTabChange }) {
  return (
    <>
      {/* Desktop top tab bar */}
      <div className="hidden lg:flex bg-[var(--bg-card)] border-b border-[var(--border)]">
        <div className="max-w-screen-2xl mx-auto w-full px-4 flex gap-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                px-6 py-3 text-sm font-medium tracking-wide transition-all duration-150
                border-b-2 -mb-px flex items-center gap-2
                ${activeTab === tab.id
                  ? 'border-amber-500 text-[var(--text-primary)]'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:border-[var(--border)]'
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
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-card)] border-t border-[var(--border)] safe-area-pb"
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
                transition-colors duration-150 relative
                ${activeTab === tab.id ? 'text-amber-500' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}
              `}
              aria-selected={activeTab === tab.id}
              role="tab"
              aria-label={tab.label}
            >
              {activeTab === tab.id && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-amber-500 rounded-full" />
              )}
              <span className="text-xl leading-none flex items-center justify-center">{tab.icon}</span>
              <span className="text-[10px] font-medium tracking-wide">{tab.mobileLabel}</span>
            </button>
          ))}
        </div>
      </nav>
    </>
  )
}
