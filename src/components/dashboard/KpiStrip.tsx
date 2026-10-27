import { BookOpen, Calendar, ThumbsUp, Users, Loader2 } from 'lucide-react'
import { DASHBOARD_STAT_ACCENTS } from '@/theme/accentCategories'
import type { DashboardStats } from '@/types/dashboard'

interface KpiStripProps {
  stats: DashboardStats | null | undefined
  isLoading: boolean
  householdSize: number
  householdLoading: boolean
}

/** Top-of-dashboard KPI strip: total recipes (own + shared), active plans,
 *  reactions given, household size. Each figure renders its own spinner
 *  independently — the strip never blocks on a single slow source. */
const KpiStrip = ({ stats, isLoading, householdSize, householdLoading }: KpiStripProps) => {
  const totalRecipes = stats
    ? stats.recipeCounts.ownCount +
      stats.recipeCounts.householdCount +
      stats.recipeCounts.collectionSharedCount
    : undefined

  const items = [
    {
      label: 'Recipes',
      value: totalRecipes,
      loading: isLoading,
      icon: BookOpen,
      color: DASHBOARD_STAT_ACCENTS.recipes,
    },
    {
      label: 'Active plans',
      value: stats?.activePlanCount,
      loading: isLoading,
      icon: Calendar,
      color: DASHBOARD_STAT_ACCENTS.thisWeek,
    },
    {
      label: 'Reactions given',
      value: stats?.reactionsGiven,
      loading: isLoading,
      icon: ThumbsUp,
      color: DASHBOARD_STAT_ACCENTS.grocery,
    },
    {
      label: 'Household',
      value: householdSize,
      loading: householdLoading,
      icon: Users,
      color: DASHBOARD_STAT_ACCENTS.family,
    },
  ]

  return (
    <div className="flex items-center gap-5 flex-wrap">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <item.icon className={`h-4 w-4 ${item.color}`} />
          {item.loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-fg-faint" />
          ) : (
            <span
              className="text-sm font-semibold text-fg tabular-nums"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              {item.value ?? 0}
            </span>
          )}
          <span
            className="text-xs text-fg-muted"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            {item.label}
          </span>
        </div>
      ))}
    </div>
  )
}

export default KpiStrip
