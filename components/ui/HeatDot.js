'use client'
import { computeHeat } from '@/lib/mlbApi'

const HEAT_CONFIG = {
  hot:  { emoji: '🟢', label: 'Hot',  cls: 'text-green-400', dot: 'bg-green-400' },
  warm: { emoji: '🟡', label: 'Warm', cls: 'text-yellow-400', dot: 'bg-yellow-400' },
  cold: { emoji: '🔴', label: 'Cold', cls: 'text-red-400', dot: 'bg-red-400' },
}

/**
 * HeatDot — colored indicator showing player temperature
 * Props:
 *   total7Day: number  — H+R+RBI over last 7 games
 *   heat: 'hot'|'warm'|'cold'  — or computed from total7Day
 *   size: 'sm'|'md'|'lg'
 *   showEmoji: bool
 *   showLabel: bool
 */
export default function HeatDot({
  total7Day,
  heat: heatProp,
  size = 'sm',
  showEmoji = false,
  showLabel = false,
}) {
  const heat = heatProp || (total7Day != null ? computeHeat(total7Day) : 'cold')
  const config = HEAT_CONFIG[heat] || HEAT_CONFIG.cold

  const sizeMap = { sm: 'w-2 h-2', md: 'w-3 h-3', lg: 'w-4 h-4' }

  if (showEmoji) {
    return (
      <span title={config.label} aria-label={config.label}>
        {config.emoji}
        {showLabel && (
          <span className={`ml-1 text-xs ${config.cls}`}>{config.label}</span>
        )}
      </span>
    )
  }

  return (
    <span className="flex items-center gap-1">
      <span
        className={`inline-block rounded-full ${sizeMap[size]} ${config.dot}`}
        title={config.label}
        aria-label={config.label}
      />
      {showLabel && (
        <span className={`text-xs ${config.cls}`}>{config.label}</span>
      )}
    </span>
  )
}
