'use client'
import { TIER_CONFIG } from '@/lib/mlbApi'

/**
 * HeatDot — 8px colored circle showing heat tier.
 *
 * Props:
 *   heatTier: 1|2|3|4   — preferred; use player.heatTier from data layer
 *   showLabel: bool
 *
 * Tier colors (no red anywhere):
 *   1 ON FIRE — green #16a34a with glow
 *   2 HOT     — green #22c55e
 *   3 WARM    — amber #f59e0b
 *   4 COLD    — light blue #93c5fd
 */
export default function HeatDot({ heatTier = 4, showLabel = false }) {
  const config = TIER_CONFIG[heatTier] || TIER_CONFIG[4]

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`inline-block rounded-full w-2 h-2 flex-shrink-0 ${config.dotClass}`}
        style={config.dotGlow ? { boxShadow: config.dotGlow } : undefined}
        title={config.label}
        aria-label={config.label}
      />
      {showLabel && (
        <span className="text-xs font-medium text-slate-500">{config.label}</span>
      )}
    </span>
  )
}
