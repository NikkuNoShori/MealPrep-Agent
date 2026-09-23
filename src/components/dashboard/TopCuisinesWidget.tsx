import { Loader2, Globe2 } from 'lucide-react'
import type { DashboardStats } from '@/types/dashboard'

interface TopCuisinesWidgetProps {
  stats: DashboardStats | null | undefined
  isLoading: boolean
}

/** Top cuisines across the caller's visible recipes (own + household +
 *  public), normalized via lower(trim(cuisine)) server-side. Free-text
 *  cuisine entry means casing/spelling variants can still fragment counts —
 *  a known data-quality caveat, not something this widget corrects. */
const TopCuisinesWidget = ({ stats, isLoading }: TopCuisinesWidgetProps) => {
  const cuisines = stats?.topCuisines ?? []
  const maxCount = cuisines.length > 0 ? cuisines[0].count : 0

  return (
    <div className="rounded-2xl border border-stone-200/60 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-4">
      <h2
        className="text-sm font-semibold italic text-stone-800 dark:text-gray-200 mb-3"
        style={{ fontFamily: "'Fraunces', serif" }}
      >
        Top cuisines
      </h2>

      <div className="border-t border-dashed border-stone-200 dark:border-white/[0.08] pt-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-stone-400 dark:text-gray-500" />
          </div>
        ) : cuisines.length === 0 ? (
          <div className="text-center py-8">
            <Globe2 className="h-5 w-5 text-stone-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-xs text-stone-400 dark:text-gray-500" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              No cuisines tagged yet
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {cuisines.slice(0, 5).map((c) => (
              <li key={c.cuisine} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-stone-700 dark:text-gray-300 capitalize truncate" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    {c.cuisine}
                  </span>
                  <span className="text-xs text-stone-400 dark:text-gray-500 tabular-nums flex-shrink-0" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    {c.count}
                  </span>
                </div>
                <div className="h-1 rounded-full bg-stone-100 dark:bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary-500 dark:bg-primary-400"
                    style={{ width: `${maxCount > 0 ? (c.count / maxCount) * 100 : 0}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default TopCuisinesWidget
