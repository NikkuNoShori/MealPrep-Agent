import { Loader2, ChefHat } from 'lucide-react'
import { SectionHeader } from '@/components/ui/section-header'
import { DAILY_MEAL_SLOTS } from '@/theme/accentCategories'
import type { DashboardStats } from '@/types/dashboard'
import type { MealSlot } from '@/types/mealPlan'

interface TodayWidgetProps {
  stats: DashboardStats | null | undefined
  isLoading: boolean
}

/** Today's actual meal-plan slots — the plan overlapping the current date,
 *  not the N most-recent plans by start_date. Owns its own loading/empty
 *  state so a slow dashboard-stats fetch never blocks sibling widgets. */
const TodayWidget = ({ stats, isLoading }: TodayWidgetProps) => {
  const todayMeals = stats?.thisWeek?.todayMeals
  const hasAnyMeal = !!todayMeals && DAILY_MEAL_SLOTS.some(
    (slot) => (todayMeals[slot.key as MealSlot]?.length ?? 0) > 0
  )

  return (
    <div className="rounded-2xl border border-stone-200/60 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-4">
      <SectionHeader title="Today" action={{ label: 'Plan week', to: '/meal-planner' }} />

      <div>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-stone-400 dark:text-gray-500" />
          </div>
        ) : !stats?.thisWeek?.planId ? (
          <div className="text-center py-8">
            <ChefHat className="h-5 w-5 text-stone-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-xs text-stone-400 dark:text-gray-500" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              No meal plan yet
            </p>
          </div>
        ) : !hasAnyMeal ? (
          <p className="text-xs text-stone-400 dark:text-gray-500 py-4 text-center" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            Nothing planned for today
          </p>
        ) : (
          <div className="space-y-2">
            {DAILY_MEAL_SLOTS.map((slot) => {
              const entries = todayMeals?.[slot.key as MealSlot] ?? []
              if (entries.length === 0) return null
              return (
                <div key={slot.key} className="flex items-start gap-2">
                  <slot.icon className={`h-3.5 w-3.5 mt-0.5 ${slot.color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-wide text-stone-400 dark:text-gray-500" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                      {slot.label}
                    </p>
                    <p className="text-sm text-stone-700 dark:text-gray-300 truncate" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                      {entries.map((e) => e.recipeName).join(', ')}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default TodayWidget
