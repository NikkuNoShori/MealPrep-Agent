import { Loader2, Flame } from 'lucide-react'
import type { DashboardStats } from '@/types/dashboard'

interface MostCookedWidgetProps {
  stats: DashboardStats | null | undefined
  isLoading: boolean
}

/** Most-cooked recipes this month — server-aggregated recipeId occurrences
 *  across this month's meal plans (bounded to the current month, not an
 *  all-time scan). */
const MostCookedWidget = ({ stats, isLoading }: MostCookedWidgetProps) => {
  const entries = stats?.mostCookedThisMonth ?? []

  return (
    <div className="rounded-2xl border border-surface-200/60 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-4">
      <h2
        className="text-sm font-semibold italic text-surface-800 dark:text-gray-200 mb-3"
        style={{ fontFamily: "'Fraunces', serif" }}
      >
        Most cooked this month
      </h2>

      <div className="border-t border-dashed border-surface-200 dark:border-white/[0.08] pt-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-surface-400 dark:text-gray-500" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-8">
            <Flame className="h-5 w-5 text-surface-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-xs text-surface-400 dark:text-gray-500" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              Nothing cooked yet this month
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {entries.slice(0, 5).map((entry) => (
              <li key={entry.recipeId} className="flex items-center justify-between gap-2">
                <span className="text-sm text-surface-700 dark:text-gray-300 truncate" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  {entry.title}
                </span>
                <span className="text-xs font-medium text-amber-600 dark:text-amber-400 tabular-nums flex-shrink-0" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  {entry.count}×
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default MostCookedWidget
