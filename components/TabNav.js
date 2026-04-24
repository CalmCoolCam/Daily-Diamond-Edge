'use client'

function BatterIcon() {
  return (
    <svg
      width="22" height="22" viewBox="0 0 24 24"
      fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Head */}
      <circle cx="15" cy="4" r="2" fill="currentColor" stroke="none" />
      {/* Helmet brim */}
      <path d="M12.5 3.5 L17.5 3.5" strokeWidth="1" />
      {/* Body */}
      <path d="M15 6 C14.5 7.5 13.5 9 13 11 L11.5 16 L10 21" />
      <path d="M13 11 L15 15 L16.5 21" />
      {/* Back arm + bat */}
      <path d="M14.5 8.5 L12 9.5 L4 7" />
      {/* Front arm */}
      <path d="M14.5 8.5 L16.5 9.5 L17 11" />
    </svg>
  )
}

const TABS = [
  { id: 'leaderboard', label: 'Leaderboard', icon: '🏆', mobileLabel: 'Board' },
  { id: 'matchups',    label: 'Matchups',    icon: '🎯', mobileLabel: 'Matchups' },
  { id: 'players',     label: 'Players',     icon: null,  mobileLabel: 'Players', svgIcon: true },
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
              {tab.svgIcon ? (
                <span className={activeTab === tab.id ? 'text-amber-500' : ''}>
                  <BatterIcon />
                </span>
              ) : (
                <span>{tab.icon}</span>
              )}
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
            >
              {activeTab === tab.id && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-amber-500 rounded-full" />
              )}
              <span className="text-xl leading-none flex items-center justify-center">
                {tab.svgIcon ? <BatterIcon /> : tab.icon}
              </span>
              <span className="text-[10px] font-medium tracking-wide">{tab.mobileLabel}</span>
            </button>
          ))}
        </div>
      </nav>
    </>
  )
}
