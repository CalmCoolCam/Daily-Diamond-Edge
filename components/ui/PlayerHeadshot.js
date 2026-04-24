'use client'
import { useState } from 'react'

// Module-level 404 cache — never retry a failed headshot URL in this session
const headshotErrorCache = {}

// Team primary colors for initials fallback (matches TeamLogo.js palette)
const TEAM_COLORS = {
  NYY: '#003087', BOS: '#BD3039', TOR: '#134A8E', BAL: '#DF4601', TBR: '#092C5C',
  CLE: '#00385D', CWS: '#27251F', DET: '#0C2340', KCR: '#004687', MIN: '#002B5C',
  HOU: '#002D62', LAA: '#003263', OAK: '#003831', SEA: '#0C2C56', TEX: '#003278',
  ATL: '#13274F', MIA: '#00A3E0', NYM: '#002D72', PHI: '#E81828', WSN: '#AB0003',
  CHC: '#0E3386', CIN: '#C6011F', MIL: '#12284B', PIT: '#27251F', STL: '#C41E3A',
  ARI: '#A71930', COL: '#33006F', LAD: '#005A9C', SDP: '#2F241D', SFG: '#FD5A1E',
}

function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

/**
 * PlayerHeadshot — MLB CDN headshot with shimmer skeleton + initials fallback.
 *
 * Caches 404 results at module level so failed headshots never retry.
 * Uses team primary color for the initials circle fallback.
 *
 * Props:
 *   personId:  number  — MLB player ID
 *   name:      string  — Full name (used for initials + alt text)
 *   teamAbbr:  string  — Team abbreviation (used for fallback color)
 *   height:    number  — Pixel size (both width and height); default 80
 *   className: string  — Extra class names applied to the wrapper
 */
export default function PlayerHeadshot({ personId, name = '', teamAbbr = '', height = 80, className = '' }) {
  const [loaded, setLoaded] = useState(false)
  const [errored, setErrored] = useState(() => Boolean(headshotErrorCache[personId]))

  const bgColor = TEAM_COLORS[teamAbbr] || '#1e3058'
  const initials = getInitials(name)
  const fontSize = Math.round(height * 0.28)

  if (!personId || errored) {
    return (
      <div
        className={`flex items-center justify-center rounded-full font-bold flex-shrink-0 select-none ${className}`}
        style={{ width: height, height, minWidth: height, backgroundColor: bgColor, color: '#ffffff', fontSize }}
        aria-label={name || 'Player'}
      >
        {initials}
      </div>
    )
  }

  return (
    <div
      className={`relative flex-shrink-0 ${className}`}
      style={{ width: height, height, minWidth: height }}
    >
      {/* Shimmer skeleton while loading */}
      {!loaded && <div className="absolute inset-0 rounded-full skeleton" />}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://img.mlbstatic.com/mlb-photos/image/upload/w_213,q_100/v1/people/${personId}/headshot/67/current`}
        alt={name}
        width={height}
        height={height}
        className="w-full h-full rounded-full object-cover"
        style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.2s ease' }}
        onLoad={() => setLoaded(true)}
        onError={() => {
          headshotErrorCache[personId] = true
          setErrored(true)
        }}
        loading="lazy"
      />
    </div>
  )
}
