'use client'

/**
 * ErrorState — shown when the MLB API is unavailable
 * Never shows a blank screen.
 */
export default function ErrorState({ message, onRetry, compact = false }) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-400 py-2 px-3 bg-red-900/20 rounded-lg border border-red-800/40">
        <span>⚠</span>
        <span>{message || 'Data unavailable'}</span>
        {onRetry && (
          <button
            onClick={onRetry}
            className="ml-auto text-xs text-gold-500 hover:text-gold-400 underline"
          >
            Retry
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center space-y-4">
      <div className="text-5xl">⚾</div>
      <h3 className="text-xl font-display text-white tracking-wide">
        Data Temporarily Unavailable
      </h3>
      <p className="text-sm text-slate-400 max-w-xs">
        {message || "Can't reach the MLB Stats API right now. Check your connection or try again."}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 px-5 py-2.5 bg-gold-500 hover:bg-gold-400 text-navy-950 font-semibold text-sm rounded-lg transition-colors min-h-[44px]"
        >
          Try Again
        </button>
      )}
    </div>
  )
}
