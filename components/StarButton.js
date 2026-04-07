'use client'
import { useState } from 'react'

/**
 * StarButton — instant optimistic star toggle
 * Props:
 *   starred: bool
 *   onToggle: () => { starred, count, limitReached? }
 *   pickCount: number
 *   size: 'sm' | 'md'
 */
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

  const sizeClass = size === 'md' ? 'text-xl p-1.5 min-w-[44px] min-h-[44px]' : 'text-base p-1 min-w-[32px] min-h-[32px]'

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={handleClick}
        className={`
          ${sizeClass} rounded-lg flex items-center justify-center transition-all duration-100
          ${starred
            ? 'text-gold-500 bg-gold-500/10 hover:bg-gold-500/20'
            : 'text-slate-500 hover:text-slate-300 hover:bg-navy-700'
          }
          ${limitFlash ? 'text-red-400 bg-red-900/20 animate-pulse' : ''}
        `}
        title={starred ? 'Unstar player' : limitFlash ? 'Max 10 stars reached' : 'Star player'}
        aria-label={starred ? 'Unstar' : 'Star'}
        aria-pressed={starred}
      >
        {starred ? '★' : '☆'}
      </button>
      {pickCount > 0 && (
        <span
          className="text-[9px] font-semibold text-slate-500 tabular-nums leading-none"
          title={`Picked ${pickCount}x this season`}
        >
          {pickCount}x
        </span>
      )}
    </div>
  )
}
