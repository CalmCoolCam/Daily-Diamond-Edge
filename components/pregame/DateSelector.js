'use client'
import { useRef } from 'react'

const MLB_SEASON_START = '2026-03-18'
const MLB_SEASON_END   = '2026-09-28'

function getTodayStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
}

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d + n)
  return [
    dt.getFullYear(),
    String(dt.getMonth() + 1).padStart(2, '0'),
    String(dt.getDate()).padStart(2, '0'),
  ].join('-')
}

function formatDisplayDate(dateStr) {
  // Parse date string as local date to avoid timezone shifts
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

export default function DateSelector({ selectedDate, onDateChange }) {
  const inputRef = useRef(null)
  const today    = getTodayStr()
  const isToday  = selectedDate === today

  const canGoBack    = selectedDate > MLB_SEASON_START
  const canGoForward = selectedDate < MLB_SEASON_END

  function openPicker() {
    try { inputRef.current?.showPicker() } catch { inputRef.current?.click() }
  }

  return (
    <div className="flex items-center w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-xl card-shadow px-1 py-1">
      {/* Left arrow */}
      <button
        onClick={() => canGoBack && onDateChange(addDays(selectedDate, -1))}
        disabled={!canGoBack}
        className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-xl font-light text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed select-none"
        aria-label="Previous day"
      >
        ‹
      </button>

      {/* Date display — tappable to open calendar */}
      <button
        className="relative flex-1 flex items-center justify-center gap-2 py-2 rounded-lg hover:bg-[var(--bg-subtle)] transition-colors min-h-[44px]"
        onClick={openPicker}
        aria-label="Pick a date"
      >
        <span className={`text-sm font-semibold ${isToday ? 'text-amber-500' : 'text-[var(--text-primary)]'}`}>
          {formatDisplayDate(selectedDate)}
        </span>
        {isToday && (
          <span className="text-[10px] font-bold text-amber-500 bg-amber-50 border border-amber-200 rounded px-1 py-0.5 leading-none">
            TODAY
          </span>
        )}
        {/* Hidden native date input — triggered programmatically */}
        <input
          ref={inputRef}
          type="date"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          min={MLB_SEASON_START}
          max={MLB_SEASON_END}
          value={selectedDate}
          onChange={(e) => e.target.value && onDateChange(e.target.value)}
          tabIndex={-1}
          aria-hidden="true"
        />
      </button>

      {/* Right arrow */}
      <button
        onClick={() => canGoForward && onDateChange(addDays(selectedDate, 1))}
        disabled={!canGoForward}
        className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-xl font-light text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed select-none"
        aria-label="Next day"
      >
        ›
      </button>
    </div>
  )
}
