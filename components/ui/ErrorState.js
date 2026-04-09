'use client'

export default function ErrorState({ message, onRetry, compact = false }) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-600 py-2 px-3 bg-red-50 rounded-lg border border-red-200">
        <span>⚠</span>
        <span className="flex-1">{message || 'Data unavailable'}</span>
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-xs font-medium text-amber-600 hover:text-amber-700 underline"
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
      <h3 className="text-xl text-slate-900" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
        Data Temporarily Unavailable
      </h3>
      <p className="text-sm text-slate-500 max-w-xs">
        {message || "Can't reach the MLB Stats API right now. Check your connection or try again."}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-white font-semibold text-sm rounded-lg transition-colors min-h-[44px]"
        >
          Try Again
        </button>
      )}
    </div>
  )
}
