'use client'
import { TIER_CONFIG } from '@/lib/mlbApi'

/**
 * Sparkline — SVG trend line for last N game H+R+RBI totals.
 *
 * Props:
 *   data: number[]     — H+R+RBI per game, oldest → newest
 *   heatTier: 1|2|3|4 — controls color and stroke width per tier spec
 *   width / height     — SVG dimensions
 *   filled: bool       — show area fill under line
 *
 * Tier colors:
 *   1 ON FIRE — #16a34a, 2px stroke
 *   2 HOT     — #22c55e, 1.5px stroke
 *   3 WARM    — #f59e0b, 1.5px stroke
 *   4 COLD    — #93c5fd, 1.5px stroke (light blue, NOT red)
 */
export default function Sparkline({
  data = [],
  heatTier = 3,
  width = 64,
  height = 22,
  filled = true,
}) {
  const config = TIER_CONFIG[heatTier] || TIER_CONFIG[3]
  const color = config.sparklineColor
  const strokeWidth = config.sparklineWidth

  if (!data || data.length < 2) {
    return (
      <svg width={width} height={height} aria-hidden="true" className="opacity-30">
        <line
          x1={0} y1={height / 2} x2={width} y2={height / 2}
          stroke={color} strokeWidth={1} strokeDasharray="3,2"
        />
      </svg>
    )
  }

  const pad = 2
  const max = Math.max(...data, 1)
  const range = max || 1

  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2)
    const y = pad + (1 - v / range) * (height - pad * 2)
    return [x, y]
  })

  const linePath = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const areaPath = filled
    ? `${linePath} L${pts[pts.length - 1][0].toFixed(1)},${height} L${pts[0][0].toFixed(1)},${height} Z`
    : null

  const lastPt = pts[pts.length - 1]
  const gradId = `sg-${color.replace('#', '')}-${width}`

  return (
    <svg width={width} height={height} aria-hidden="true">
      {filled && (
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
      )}
      {filled && <path d={areaPath} fill={`url(#${gradId})`} />}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastPt[0].toFixed(1)} cy={lastPt[1].toFixed(1)} r={2} fill={color} />
    </svg>
  )
}
