import { Calendar, Sparkles, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

const MealPlanner = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-stone-900 dark:text-white tracking-tight">
          Meal Planner
        </h1>
        <p className="text-stone-500 dark:text-gray-400 mt-1">
          Plan your family's meals with AI assistance
        </p>
      </div>

      <div className="card max-w-2xl mx-auto">
        <div className="text-center py-16">
          <div className="relative inline-flex mb-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500/10 to-secondary-500/10 dark:from-primary-500/20 dark:to-secondary-500/10 flex items-center justify-center">
              <Calendar className="w-9 h-9 text-primary-500" />
            </div>
            <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center shadow-lg shadow-primary-500/30">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
          </div>
          <h3 className="text-xl font-semibold text-stone-900 dark:text-white mb-2">
            Smart Meal Planning
          </h3>
          <p className="text-stone-500 dark:text-gray-400 max-w-md mx-auto mb-6 leading-relaxed">
            Our intelligent meal planning system is under development.
            You'll be able to create personalized meal plans and generate
            shopping lists automatically.
          </p>
          <Link to="/chat">
            <Button variant="outline" className="gap-2">
              Ask AI for Suggestions
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

export default MealPlanner
