import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  Sparkles,
  TrendingUp
} from 'lucide-react'

const StatCard = ({ label, value, icon: Icon, color, loading }: {
  label: string
  value: number | string
  icon: any
  color: string
  loading?: boolean
}) => {
  const colorMap: Record<string, string> = {
    blue: 'from-blue-500/10 to-blue-600/5 dark:from-blue-500/[0.08] dark:to-blue-600/[0.02] border-blue-200/50 dark:border-blue-500/10',
    purple: 'from-purple-500/10 to-purple-600/5 dark:from-purple-500/[0.08] dark:to-purple-600/[0.02] border-purple-200/50 dark:border-purple-500/10',
    emerald: 'from-emerald-500/10 to-emerald-600/5 dark:from-emerald-500/[0.08] dark:to-emerald-600/[0.02] border-emerald-200/50 dark:border-emerald-500/10',
    amber: 'from-amber-500/10 to-amber-600/5 dark:from-amber-500/[0.08] dark:to-amber-600/[0.02] border-amber-200/50 dark:border-amber-500/10',
  }

  const iconColorMap: Record<string, string> = {
    blue: 'text-blue-500',
    purple: 'text-purple-500',
    emerald: 'text-emerald-500',
    amber: 'text-amber-500',
  }

  return (
    <div className={`stat-card bg-gradient-to-br ${colorMap[color]} border`}>
      <div className="flex items-center justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-white/60 dark:bg-white/5 flex items-center justify-center">
          <Icon className={`w-5 h-5 ${iconColorMap[color]}`} />
        </div>
        <TrendingUp className="w-4 h-4 text-stone-300 dark:text-gray-600" />
      </div>
      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin text-stone-400 dark:text-gray-500" />
      ) : (
        <p className="text-3xl font-bold text-stone-900 dark:text-white tracking-tight">{value}</p>
      )}
      <p className="text-sm text-stone-500 dark:text-gray-400 mt-1">{label}</p>
    </div>
  )
}

const Dashboard = () => {
  const { data: recipesData, isLoading: recipesLoading } = useRecipes({ limit: 10 })
  const { data: mealPlansData, isLoading: mealPlansLoading } = useMealPlans({ limit: 7 })

  const recipes = recipesData?.recipes || []
  const mealPlans = mealPlansData || []
  const thisWeekMeals = mealPlans.length
  const recentRecipes = recipes.slice(0, 3)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-stone-900 dark:text-white tracking-tight">
          Dashboard
        </h1>
        <p className="text-stone-500 dark:text-gray-400 mt-1">
          Welcome back. Here's your kitchen at a glance.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger-in">
        <StatCard label="Total Recipes" value={recipes.length} icon={BookOpen} color="blue" loading={recipesLoading} />
        <StatCard label="This Week's Meals" value={thisWeekMeals} icon={Calendar} color="purple" loading={mealPlansLoading} />
        <StatCard label="Family Members" value={0} icon={Users} color="emerald" />
        <StatCard label="Grocery Items" value={0} icon={ShoppingCart} color="amber" />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500/10 to-secondary-500/10 dark:from-primary-500/20 dark:to-secondary-500/10 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-primary-500" />
              </div>
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <Link to="/recipes">
              <Button className="w-full justify-start group" variant="outline" size="default">
                <Plus className="h-4 w-4 mr-3 text-emerald-500" />
                <span>Add New Recipe</span>
                <ArrowRight className="h-3.5 w-3.5 ml-auto opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 text-stone-400" />
              </Button>
            </Link>
            <Link to="/meal-planner">
              <Button className="w-full justify-start group" variant="outline" size="default">
                <Calendar className="h-4 w-4 mr-3 text-purple-500" />
                <span>Plan This Week</span>
                <ArrowRight className="h-3.5 w-3.5 ml-auto opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 text-stone-400" />
              </Button>
            </Link>
            <Link to="/chat">
              <Button className="w-full justify-start group" variant="outline" size="default">
                <MessageSquare className="h-4 w-4 mr-3 text-blue-500" />
                <span>Ask AI Assistant</span>
                <ArrowRight className="h-3.5 w-3.5 ml-auto opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 text-stone-400" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Recent Recipes */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/10 to-blue-600/5 dark:from-blue-500/20 dark:to-blue-600/10 flex items-center justify-center">
                <BookOpen className="h-4 w-4 text-blue-500" />
              </div>
              Recent Recipes
            </CardTitle>
            <Link to="/recipes">
              <Button variant="ghost" size="sm" className="text-xs gap-1.5 text-stone-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400">
                View All
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recipesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-stone-400 dark:text-gray-500" />
              </div>
            ) : recentRecipes.length > 0 ? (
              <div className="space-y-2.5">
                {recentRecipes.map((recipe: any) => (
                  <Link
                    key={recipe.id}
                    to="/recipes"
                    className="flex items-center gap-4 p-3.5 rounded-xl border border-stone-200/60 dark:border-white/[0.06] hover:bg-stone-50 dark:hover:bg-white/[0.02] hover:border-stone-300/60 dark:hover:border-white/10 transition-all duration-200 group"
                  >
                    {recipe.imageUrl ? (
                      <img
                        src={recipe.imageUrl}
                        alt={recipe.title}
                        className="w-14 h-14 rounded-xl object-cover ring-1 ring-stone-200/50 dark:ring-white/5"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary-500/10 to-secondary-500/10 dark:from-primary-500/20 dark:to-secondary-500/10 flex items-center justify-center shrink-0">
                        <ChefHat className="w-6 h-6 text-primary-500/60" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-stone-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                        {recipe.title.length > 60 ? recipe.title.slice(0, 60) + '...' : recipe.title}
                      </h3>
                      <div className="flex items-center gap-4 mt-1 text-sm text-stone-400 dark:text-gray-500">
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
                    <ArrowRight className="w-4 h-4 text-stone-300 dark:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-stone-100 to-stone-50 dark:from-white/5 dark:to-white/[0.02] flex items-center justify-center mx-auto mb-4">
                  <BookOpen className="h-7 w-7 text-stone-300 dark:text-gray-600" />
                </div>
                <p className="text-sm font-medium text-stone-500 dark:text-gray-400 mb-1">No recipes yet</p>
                <p className="text-xs text-stone-400 dark:text-gray-500 mb-4">Start building your collection</p>
                <Link to="/recipes">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Create Your First Recipe
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default Dashboard
