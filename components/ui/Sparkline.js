'use client'

/**
 * Sparkline — small SVG trend line showing last N game totals
 * Props:
 *   data: number[]   — array of H+R+RBI values (oldest → newest)
 *   width: number
 *   height: number
 *   color: string    — stroke color (default: gold)
 *   filled: bool     — show filled area under line
 */
export default function Sparkline({
  data = [],
  width = 64,
  height = 24,
  color = '#f59e0b',
  filled = true,
}) {
  if (!data || data.length < 2) {
    return (
      <svg width={width} height={height} className="opacity-30">
        <line x1={0} y1={height / 2} x2={width} y2={height / 2}
          stroke={color} strokeWidth={1} strokeDasharray="3,2" />
      </svg>
    )
  }

  const pad = 2
  const max = Math.max(...data, 1)
  const min = 0
  const range = max - min || 1

  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2)
    const y = pad + (1 - (v - min) / range) * (height - pad * 2)
    return [x, y]
  })

  const linePath = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ')
  const areaPath = filled
    ? `${linePath} L${pts[pts.length - 1][0]},${height} L${pts[0][0]},${height} Z`
    : null

  const lastPt = pts[pts.length - 1]

  return (
    <svg width={width} height={height} aria-hidden="true">
      {filled && (
        <defs>
          <linearGradient id={`sg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.03" />
          </linearGradient>
        </defs>
      )}
      {filled && (
        <path
          d={areaPath}
          fill={`url(#sg-${color.replace('#', '')})`}
        />
      )}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Last point dot */}
      <circle cx={lastPt[0]} cy={lastPt[1]} r={2} fill={color} />
    </svg>
  )
}
