'use client'
import { teamColorClass } from '@/lib/utils'

const TEAM_COLORS = {
  NYY: { bg: '#003087', text: '#ffffff' },
  BOS: { bg: '#BD3039', text: '#ffffff' },
  TOR: { bg: '#134A8E', text: '#ffffff' },
  BAL: { bg: '#DF4601', text: '#ffffff' },
  TBR: { bg: '#092C5C', text: '#8FBCE6' },
  CLE: { bg: '#00385D', text: '#E31937' },
  CWS: { bg: '#27251F', text: '#ffffff' },
  DET: { bg: '#0C2340', text: '#FA4616' },
  KCR: { bg: '#004687', text: '#C09A5B' },
  MIN: { bg: '#002B5C', text: '#D31145' },
  HOU: { bg: '#002D62', text: '#EB6E1F' },
  LAA: { bg: '#003263', text: '#BA0021' },
  OAK: { bg: '#003831', text: '#EFB21E' },
  SEA: { bg: '#0C2C56', text: '#005C5C' },
  TEX: { bg: '#003278', text: '#C0111F' },
  ATL: { bg: '#13274F', text: '#CE1141' },
  MIA: { bg: '#00A3E0', text: '#EF3340' },
  NYM: { bg: '#002D72', text: '#FF5910' },
  PHI: { bg: '#E81828', text: '#284898' },
  WSN: { bg: '#AB0003', text: '#14225A' },
  CHC: { bg: '#0E3386', text: '#CC3433' },
  CIN: { bg: '#C6011F', text: '#ffffff' },
  MIL: { bg: '#12284B', text: '#FFC52F' },
  PIT: { bg: '#27251F', text: '#FDB827' },
  STL: { bg: '#C41E3A', text: '#0C2340' },
  ARI: { bg: '#A71930', text: '#E3D4AD' },
  COL: { bg: '#33006F', text: '#C4CED4' },
  LAD: { bg: '#005A9C', text: '#EF3E42' },
  SDP: { bg: '#2F241D', text: '#FFC425' },
  SFG: { bg: '#FD5A1E', text: '#27251F' },
}

/**
 * TeamBadge — shows team abbreviation with team colors
 * Props:
 *   abbr: string      — team abbreviation (e.g. "NYY")
 *   size: 'xs'|'sm'|'md'|'lg'
 *   showFull: bool    — show full name if provided
 */
export default function TeamBadge({ abbr = '', size = 'sm' }) {
  const colors = TEAM_COLORS[abbr] || { bg: '#1e3058', text: '#94a3b8' }

  const sizeClasses = {
    xs:  'text-[10px] px-1 py-0.5 rounded',
    sm:  'text-xs px-1.5 py-0.5 rounded',
    md:  'text-sm px-2 py-1 rounded-md',
    lg:  'text-base px-3 py-1.5 rounded-md',
  }

  return (
    <span
      className={`inline-block font-bold tracking-wide font-mono ${sizeClasses[size]}`}
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      {abbr || '—'}
    </span>
  )
}
