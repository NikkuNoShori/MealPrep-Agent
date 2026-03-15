import { Button } from '@/components/ui/button'
import { useRecipes, useMealPlans } from '@/services/api'
import { Link } from 'react-router-dom'
import {
  Plus,
  ChefHat,
  Clock,
  ArrowRight,
  Loader2,
  Calendar,
  BookOpen,
  MessageSquare,
  Users,
  ShoppingCart,
} from 'lucide-react'

const Dashboard = () => {
  const { data: recipesData, isLoading: recipesLoading } = useRecipes({ limit: 10 })
  const { data: mealPlansData, isLoading: mealPlansLoading } = useMealPlans({ limit: 7 })

  const recipes = recipesData?.recipes || []
  const mealPlans = mealPlansData || []
  const thisWeekMeals = mealPlans.length
  const recentRecipes = recipes.slice(0, 5)

  const stats = [
    { label: 'Recipes', value: recipes.length, icon: BookOpen, color: 'text-emerald-600 dark:text-emerald-400', loading: recipesLoading },
    { label: 'This week', value: thisWeekMeals, icon: Calendar, color: 'text-amber-600 dark:text-amber-400', loading: mealPlansLoading },
    { label: 'Family', value: 0, icon: Users, color: 'text-rose-500 dark:text-rose-400', loading: false },
    { label: 'Grocery', value: 0, icon: ShoppingCart, color: 'text-teal-600 dark:text-teal-400', loading: false },
  ]

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-fade-in">
      {/* Header + Stats row */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-white tracking-tight" style={{ fontFamily: "'Fraunces', serif" }}>
            Good evening
          </h1>
          <p className="text-sm text-stone-500 dark:text-gray-400 mt-0.5" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            Here's your kitchen at a glance.
          </p>
        </div>

        {/* Compact stats */}
        <div className="flex items-center gap-5">
          {stats.map((s) => (
            <div key={s.label} className="flex items-center gap-2">
              <s.icon className={`h-4 w-4 ${s.color}`} />
              {s.loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400 dark:text-gray-500" />
              ) : (
                <span className="text-sm font-semibold text-stone-900 dark:text-white tabular-nums" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  {s.value}
                </span>
              )}
              <span className="text-xs text-stone-400 dark:text-gray-500" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions — horizontal row */}
      <div className="flex items-center gap-2">
        <Link to="/recipes">
          <button className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-stone-200/60 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] text-sm text-stone-700 dark:text-gray-300 hover:border-[#1D9E75]/30 dark:hover:border-[#34d399]/20 hover:shadow-sm transition-all duration-200" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <Plus className="h-3.5 w-3.5 text-[#1D9E75] dark:text-[#34d399]" />
            Add Recipe
          </button>
        </Link>
        <Link to="/meal-planner">
          <button className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-stone-200/60 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] text-sm text-stone-700 dark:text-gray-300 hover:border-amber-400/30 hover:shadow-sm transition-all duration-200" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <Calendar className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
            Plan Week
          </button>
        </Link>
        <Link to="/chat">
          <button className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-stone-200/60 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] text-sm text-stone-700 dark:text-gray-300 hover:border-teal-400/30 hover:shadow-sm transition-all duration-200" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <MessageSquare className="h-3.5 w-3.5 text-teal-500 dark:text-teal-400" />
            AI Assistant
          </button>
        </Link>
      </div>

      {/* Recent Recipes */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-stone-800 dark:text-gray-200" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            Recent Recipes
          </h2>
          <Link to="/recipes">
            <button className="text-xs text-stone-400 hover:text-[#1D9E75] dark:text-gray-500 dark:hover:text-[#34d399] transition-colors flex items-center gap-1" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              View all
              <ArrowRight className="h-3 w-3" />
            </button>
          </Link>
        </div>

        {recipesLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-stone-400 dark:text-gray-500" />
          </div>
        ) : recentRecipes.length > 0 ? (
          <div className="space-y-1.5">
            {recentRecipes.map((recipe: any) => (
              <Link
                key={recipe.id}
                to="/recipes"
                className="flex items-center gap-3 px-3 py-2.5 -mx-3 rounded-xl transition-all duration-150 group"
              >
                {recipe.imageUrl ? (
                  <img
                    src={recipe.imageUrl}
                    alt={recipe.title}
                    className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-stone-100 dark:bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                    <ChefHat className="w-4 h-4 text-stone-400 dark:text-gray-500" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-800 dark:text-gray-200 group-hover:text-[#1D9E75] dark:group-hover:text-[#34d399] transition-colors truncate" style={{ fontFamily: "'Fraunces', serif" }}>
                    {recipe.title}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-stone-400 dark:text-gray-500" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    {recipe.prepTime && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {recipe.prepTime} min
                      </span>
                    )}
                    {recipe.tags && recipe.tags.length > 0 && (
                      <span className="truncate">{recipe.tags.slice(0, 2).join(', ')}</span>
                    )}
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-stone-300 dark:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-xl bg-stone-100 dark:bg-white/[0.06] flex items-center justify-center mx-auto mb-3">
              <BookOpen className="h-5 w-5 text-stone-300 dark:text-gray-600" />
            </div>
            <p className="text-sm text-stone-500 dark:text-gray-400 mb-1" style={{ fontFamily: "'DM Sans', sans-serif" }}>No recipes yet</p>
            <p className="text-xs text-stone-400 dark:text-gray-500 mb-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>Start building your collection</p>
            <Link to="/recipes">
              <Button variant="outline" size="sm" className="gap-2 rounded-xl text-xs">
                <Plus className="h-3.5 w-3.5" />
                Create Your First Recipe
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard
