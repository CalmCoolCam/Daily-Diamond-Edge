'use client'

/** Generic shimmer skeleton block */
export function SkeletonBlock({ className = '' }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />
}

/** Skeleton for a score card */
export function SkeletonScoreCard() {
  return (
    <div className="flex-shrink-0 w-40 h-20 rounded-xl bg-navy-800 p-3 space-y-2 border border-navy-700">
      <SkeletonBlock className="h-3 w-24 rounded" />
      <SkeletonBlock className="h-5 w-16 rounded" />
      <SkeletonBlock className="h-3 w-20 rounded" />
    </div>
  )
}

/** Skeleton for a player table row */
export function SkeletonTableRow({ cols = 8 }) {
  return (
    <tr className="border-b border-navy-800">
      <td className="px-3 py-2 sticky-col">
        <SkeletonBlock className="h-4 w-28 rounded" />
      </td>
      {Array.from({ length: cols - 1 }).map((_, i) => (
        <td key={i} className="px-3 py-2">
          <SkeletonBlock className="h-4 w-12 rounded mx-auto" />
        </td>
      ))}
    </tr>
  )
}

/** Skeleton for a hot player card */
export function SkeletonHotCard() {
  return (
    <div className="bg-navy-800 rounded-xl p-4 border border-navy-700 space-y-3">
      <div className="flex justify-between">
        <div className="space-y-1">
          <SkeletonBlock className="h-4 w-32 rounded" />
          <SkeletonBlock className="h-3 w-20 rounded" />
        </div>
        <SkeletonBlock className="h-8 w-8 rounded-full" />
      </div>
      <div className="flex gap-3">
        <SkeletonBlock className="h-6 w-12 rounded" />
        <SkeletonBlock className="h-6 w-12 rounded" />
        <SkeletonBlock className="h-6 w-12 rounded" />
      </div>
      <SkeletonBlock className="h-6 w-full rounded" />
    </div>
  )
}

/** Skeleton for matchup card */
export function SkeletonMatchupCard() {
  return (
    <div className="bg-navy-800 rounded-xl p-4 border border-navy-700 space-y-2">
      <SkeletonBlock className="h-4 w-32 rounded" />
      <div className="flex gap-4">
        <SkeletonBlock className="h-10 w-10 rounded" />
        <div className="space-y-1 flex-1">
          <SkeletonBlock className="h-3 w-24 rounded" />
          <SkeletonBlock className="h-3 w-32 rounded" />
        </div>
      </div>
    </div>
  )
}

/** Full page skeleton while initial load */
export function PageSkeleton() {
  return (
    <div className="space-y-4 p-4 animate-fade-in">
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonScoreCard key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[40%_60%] gap-4">
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonHotCard key={i} />
          ))}
        </div>
        <div className="bg-navy-800 rounded-xl border border-navy-700 overflow-hidden">
          <table className="w-full">
            <tbody>
              {Array.from({ length: 10 }).map((_, i) => (
                <SkeletonTableRow key={i} cols={10} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
