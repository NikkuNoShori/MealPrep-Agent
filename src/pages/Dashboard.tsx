import { useDashboardStats, useMyHousehold } from '@/services/api'
import { Link } from 'react-router-dom'
import { Plus, Calendar, MessageSquare } from 'lucide-react'
import KpiStrip from '@/components/dashboard/KpiStrip'
import TodayWidget from '@/components/dashboard/TodayWidget'
import GroceryCartWidget from '@/components/dashboard/GroceryCartWidget'
import MostCookedWidget from '@/components/dashboard/MostCookedWidget'
import TopCuisinesWidget from '@/components/dashboard/TopCuisinesWidget'

const Dashboard = () => {
  const { data: stats, isLoading: statsLoading } = useDashboardStats()
  const { data: householdData, isLoading: householdLoading } = useMyHousehold()

  const householdSize = householdData?.members?.length || 0

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white tracking-tight" style={{ fontFamily: "'Fraunces', serif" }}>
            Good evening
          </h1>
          <p className="text-sm text-surface-500 dark:text-gray-400 mt-0.5" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            Here's your kitchen at a glance.
          </p>
        </div>

        <KpiStrip
          stats={stats}
          isLoading={statsLoading}
          householdSize={householdSize}
          householdLoading={householdLoading}
        />
      </div>

      {/* Quick actions — horizontal row */}
      <div className="flex items-center gap-2">
        <Link to="/recipes">
          <button className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-surface-200/60 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] text-sm text-surface-700 dark:text-gray-300 hover:border-primary-500/30 dark:hover:border-primary-400/20 hover:shadow-sm transition-all duration-200" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <Plus className="h-3.5 w-3.5 text-primary-500 dark:text-primary-400" />
            Add Recipe
          </button>
        </Link>
        <Link to="/meal-planner">
          <button className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-surface-200/60 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] text-sm text-surface-700 dark:text-gray-300 hover:border-amber-400/30 hover:shadow-sm transition-all duration-200" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <Calendar className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
            Plan Week
          </button>
        </Link>
        <Link to="/chat">
          <button className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-surface-200/60 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] text-sm text-surface-700 dark:text-gray-300 hover:border-teal-400/30 hover:shadow-sm transition-all duration-200" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <MessageSquare className="h-3.5 w-3.5 text-teal-500 dark:text-teal-400" />
            AI Assistant
          </button>
        </Link>
      </div>

      {/* Widget grid — 2x2 quadrants, cards grow with the wider page */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <TodayWidget stats={stats} isLoading={statsLoading} />
        <GroceryCartWidget stats={stats} isLoading={statsLoading} />
        <MostCookedWidget stats={stats} isLoading={statsLoading} />
        <TopCuisinesWidget stats={stats} isLoading={statsLoading} />
      </div>
    </div>
  )
}

export default Dashboard
