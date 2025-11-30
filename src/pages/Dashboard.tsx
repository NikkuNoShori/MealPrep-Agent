import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useRecipes, useMealPlans } from '@/services/api'
import { Link } from 'react-router-dom'
import { 
  BookOpen, 
  Calendar, 
  Users, 
  ShoppingCart, 
  Plus, 
  ChefHat,
  Clock,
  ArrowRight,
  Loader2
} from 'lucide-react'

const Dashboard = () => {
  const { data: recipesData, isLoading: recipesLoading } = useRecipes({ limit: 10 })
  const { data: mealPlansData, isLoading: mealPlansLoading } = useMealPlans(7)
  
  const recipes = recipesData?.recipes || []
  const mealPlans = mealPlansData?.mealPlans || []
  
  // Calculate this week's meals
  const thisWeekMeals = mealPlans.length
  
  // Get recent recipes (last 3)
  const recentRecipes = recipes.slice(0, 3)

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-300 mt-1">Welcome to your meal planning dashboard</p>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Total Recipes
            </CardTitle>
            <BookOpen className="h-4 w-4 text-primary-600 dark:text-primary-400" />
          </CardHeader>
          <CardContent>
            {recipesLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            ) : (
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{recipes.length}</p>
            )}
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              This Week's Meals
            </CardTitle>
            <Calendar className="h-4 w-4 text-primary-600 dark:text-primary-400" />
          </CardHeader>
          <CardContent>
            {mealPlansLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            ) : (
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{thisWeekMeals}</p>
            )}
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Family Members
            </CardTitle>
            <Users className="h-4 w-4 text-primary-600 dark:text-primary-400" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">0</p>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Grocery Items
            </CardTitle>
            <ShoppingCart className="h-4 w-4 text-primary-600 dark:text-primary-400" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">0</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions & Recent Recipes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ChefHat className="h-5 w-5" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link to="/recipes">
              <Button className="w-full justify-start" variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add New Recipe
              </Button>
            </Link>
            <Link to="/meal-planner">
              <Button className="w-full justify-start" variant="outline">
                <Calendar className="h-4 w-4 mr-2" />
                Plan This Week
              </Button>
            </Link>
            <Link to="/chat">
              <Button className="w-full justify-start" variant="outline">
                <ChefHat className="h-4 w-4 mr-2" />
                Ask AI Assistant
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Recent Recipes */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Recent Recipes
            </CardTitle>
            <Link to="/recipes">
              <Button variant="ghost" size="sm" className="text-xs">
                View All
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recipesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : recentRecipes.length > 0 ? (
              <div className="space-y-3">
                {recentRecipes.map((recipe: any) => (
                  <Link
                    key={recipe.id}
                    to={`/recipes`}
                    className="flex items-center gap-4 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
                  >
                    {recipe.imageUrl && (
                      <img
                        src={recipe.imageUrl}
                        alt={recipe.title}
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                        {recipe.title.length > 75 ? recipe.title.slice(0, 75) + '...' : recipe.title}
                      </h3>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {recipe.prepTime && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {recipe.prepTime} min
                          </span>
                        )}
                        {recipe.tags && recipe.tags.length > 0 && (
                          <span className="truncate">
                            {recipe.tags.slice(0, 2).join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No recipes yet</p>
                <Link to="/recipes">
                  <Button variant="outline" size="sm" className="mt-3">
                    <Plus className="h-4 w-4 mr-2" />
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
