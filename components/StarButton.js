'use client'
import { useState } from 'react'

export default function StarButton({ starred, onToggle, pickCount = 0, size = 'sm' }) {
  const [limitFlash, setLimitFlash] = useState(false)

  function handleClick(e) {
    e.stopPropagation()
    const result = onToggle()
    if (result?.limitReached) {
      setLimitFlash(true)
      setTimeout(() => setLimitFlash(false), 1500)
    }
  }

  const sizeClass = size === 'md'
    ? 'text-xl p-1.5 min-w-[44px] min-h-[44px]'
    : 'text-base p-1 min-w-[36px] min-h-[36px]'

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={handleClick}
        className={`
          ${sizeClass} rounded-lg flex items-center justify-center transition-all duration-100
          ${starred
            ? 'text-amber-500 bg-amber-50 hover:bg-amber-100 border border-amber-200'
            : 'text-slate-300 hover:text-amber-400 hover:bg-amber-50 border border-transparent'
          }
          ${limitFlash ? 'text-red-500 bg-red-50 border-red-200 animate-pulse' : ''}
        `}
        title={starred ? 'Unstar player' : limitFlash ? 'Max 10 stars reached' : 'Star player'}
        aria-label={starred ? 'Unstar' : 'Star'}
        aria-pressed={starred}
      >
        {starred ? '★' : '☆'}
      </button>
      {pickCount > 0 && (
        <span className="text-[9px] font-semibold text-slate-400 tabular-nums leading-none">
          {pickCount}x
        </span>
      )}
    </div>
  )
}
