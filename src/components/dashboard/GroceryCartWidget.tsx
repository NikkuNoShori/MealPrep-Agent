import { Link } from 'react-router-dom'
import { Loader2, ShoppingCart } from 'lucide-react'
import type { DashboardStats } from '@/types/dashboard'

interface GroceryCartWidgetProps {
  stats: DashboardStats | null | undefined
  isLoading: boolean
}

/** Real checked/total grocery progress (server-computed) with a
 *  per-category breakdown, replacing the old arbitrary single-plan
 *  unchecked-item count. */
const GroceryCartWidget = ({ stats, isLoading }: GroceryCartWidgetProps) => {
  const progress = stats?.groceryProgress
  const total = progress?.total ?? 0
  const checked = progress?.checked ?? 0
  const pct = total > 0 ? Math.round((checked / total) * 100) : 0

  return (
    <div className="rounded-2xl border border-stone-200/60 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-4">
      <div className="flex items-center justify-between mb-3">
        <h2
          className="text-sm font-semibold italic text-stone-800 dark:text-gray-200"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          Grocery cart
        </h2>
        <Link
          to="/meal-planner"
          className="text-xs text-stone-400 hover:text-teal-500 dark:text-gray-500 dark:hover:text-teal-400 transition-colors"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          Open cart
        </Link>
      </div>

      <div className="border-t border-dashed border-stone-200 dark:border-white/[0.08] pt-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-stone-400 dark:text-gray-500" />
          </div>
        ) : !progress?.planId || total === 0 ? (
          <div className="text-center py-8">
            <ShoppingCart className="h-5 w-5 text-stone-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-xs text-stone-400 dark:text-gray-500" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              No grocery list yet
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-stone-900 dark:text-white tabular-nums" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                {checked} / {total} checked
              </span>
              <span className="text-xs text-teal-600 dark:text-teal-400 tabular-nums" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                {pct}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-stone-100 dark:bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full bg-teal-500 dark:bg-teal-400 transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
            {progress.categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {progress.categories.map((cat) => (
                  <span
                    key={cat.category}
                    className="px-2 py-0.5 rounded-full text-[10px] bg-stone-100 dark:bg-white/[0.06] text-stone-500 dark:text-gray-400 tabular-nums"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                  >
                    {cat.category} {cat.checked}/{cat.total}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default GroceryCartWidget
