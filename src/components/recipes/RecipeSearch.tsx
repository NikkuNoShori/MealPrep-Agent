import React, { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Search, Filter, X, Clock } from 'lucide-react'

interface RecipeSearchProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  filters: {
    dietaryRestrictions: string[]
    prepTime: string
    difficulty: string
    tags: string[]
  }
  onFiltersChange: (filters: any) => void
}

const DIETARY_RESTRICTIONS = [
  'Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 
  'Keto', 'Paleo', 'Low-Carb', 'Nut-Free'
]

const PREP_TIME_RANGES = [
  { label: 'Quick (< 15 min)', value: '0-15' },
  { label: 'Fast (15-30 min)', value: '15-30' },
  { label: 'Medium (30-60 min)', value: '30-60' },
  { label: 'Long (> 60 min)', value: '60-999' }
]

const DIFFICULTY_LEVELS = ['easy', 'medium', 'hard']

export const RecipeSearch: React.FC<RecipeSearchProps> = ({
  searchQuery,
  onSearchChange,
  filters,
  onFiltersChange
}) => {
  const [showFilters, setShowFilters] = useState(false)

  const updateFilter = (key: string, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value
    })
  }

  const toggleDietaryRestriction = (restriction: string) => {
    const current = filters.dietaryRestrictions
    const updated = current.includes(restriction)
      ? current.filter(r => r !== restriction)
      : [...current, restriction]
    updateFilter('dietaryRestrictions', updated)
  }

  const toggleTag = (tag: string) => {
    const current = filters.tags
    const updated = current.includes(tag)
      ? current.filter(t => t !== tag)
      : [...current, tag]
    updateFilter('tags', updated)
  }

  const clearAllFilters = () => {
    onFiltersChange({
      dietaryRestrictions: [],
      prepTime: '',
      difficulty: '',
      tags: []
    })
  }

  const hasActiveFilters = Object.values(filters).some(f => 
    f && (Array.isArray(f) ? f.length > 0 : f !== '')
  )

  return (
    <div className="space-y-6">
      {/* Enhanced Search Bar */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
          <Input
            placeholder="Search recipes by name, ingredients, or tags..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-12 h-12 text-lg border-2 border-slate-200 dark:border-slate-700 rounded-xl focus:border-blue-500 dark:focus:border-blue-400 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-200"
          />
        </div>
        <Button
          variant={showFilters ? 'default' : 'outline'}
          onClick={() => setShowFilters(!showFilters)}
          className={`h-12 px-6 rounded-xl transition-all duration-200 ${
            showFilters 
              ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg' 
              : 'border-2 border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm'
          }`}
        >
          <Filter className="h-5 w-5 mr-2" />
          Filters
          {hasActiveFilters && (
            <div className="ml-2 w-2 h-2 bg-red-500 rounded-full"></div>
          )}
        </Button>
        {hasActiveFilters && (
          <Button 
            variant="outline" 
            onClick={clearAllFilters}
            className="h-12 px-6 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-red-500 dark:hover:border-red-400 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
          >
            <X className="h-5 w-5 mr-2" />
            Clear All
          </Button>
        )}
      </div>

      {/* Enhanced Active Filters Display */}
      {hasActiveFilters && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 bg-gradient-to-b from-blue-600 to-purple-600 rounded-full"></div>
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Active Filters:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {filters.dietaryRestrictions.map(restriction => (
              <Badge key={restriction} variant="secondary" className="gap-2 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border-0 px-3 py-1.5 rounded-lg">
                {restriction}
                <button
                  onClick={() => toggleDietaryRestriction(restriction)}
                  className="ml-1 hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5 transition-colors duration-200"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {filters.prepTime && (
              <Badge variant="secondary" className="gap-2 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border-0 px-3 py-1.5 rounded-lg">
                {PREP_TIME_RANGES.find(r => r.value === filters.prepTime)?.label}
                <button
                  onClick={() => updateFilter('prepTime', '')}
                  className="ml-1 hover:bg-green-200 dark:hover:bg-green-800 rounded-full p-0.5 transition-colors duration-200"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {filters.difficulty && (
              <Badge variant="secondary" className="gap-2 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 border-0 px-3 py-1.5 rounded-lg">
                {filters.difficulty}
                <button
                  onClick={() => updateFilter('difficulty', '')}
                  className="ml-1 hover:bg-purple-200 dark:hover:bg-purple-800 rounded-full p-0.5 transition-colors duration-200"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {filters.tags.map(tag => (
              <Badge key={tag} variant="secondary" className="gap-2 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 border-0 px-3 py-1.5 rounded-lg">
                {tag}
                <button
                  onClick={() => toggleTag(tag)}
                  className="ml-1 hover:bg-orange-200 dark:hover:bg-orange-800 rounded-full p-0.5 transition-colors duration-200"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Enhanced Filter Panel */}
      {showFilters && (
        <div className="animate-fade-in">
          <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
            <CardContent className="p-8 space-y-8">
              {/* Dietary Restrictions */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                    <span className="text-blue-600 dark:text-blue-400 text-sm">🥗</span>
                  </div>
                  <h4 className="text-lg font-semibold text-slate-900 dark:text-white">Dietary Restrictions</h4>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {DIETARY_RESTRICTIONS.map(restriction => (
                    <Badge
                      key={restriction}
                      variant={filters.dietaryRestrictions.includes(restriction) ? 'default' : 'outline'}
                      className={`cursor-pointer px-4 py-2 rounded-lg transition-all duration-200 ${
                        filters.dietaryRestrictions.includes(restriction)
                          ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg'
                          : 'border-2 border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm'
                      }`}
                      onClick={() => toggleDietaryRestriction(restriction)}
                    >
                      {restriction}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Prep Time */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                    <Clock className="w-4 h-4 text-green-600 dark:text-green-400" />
                  </div>
                  <h4 className="text-lg font-semibold text-slate-900 dark:text-white">Prep Time</h4>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {PREP_TIME_RANGES.map(range => (
                    <Badge
                      key={range.value}
                      variant={filters.prepTime === range.value ? 'default' : 'outline'}
                      className={`cursor-pointer px-4 py-2 rounded-lg transition-all duration-200 ${
                        filters.prepTime === range.value
                          ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg'
                          : 'border-2 border-slate-200 dark:border-slate-700 hover:border-green-500 dark:hover:border-green-400 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm'
                      }`}
                      onClick={() => updateFilter('prepTime', filters.prepTime === range.value ? '' : range.value)}
                    >
                      {range.label}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Difficulty */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                    <span className="text-purple-600 dark:text-purple-400 text-sm">⚡</span>
                  </div>
                  <h4 className="text-lg font-semibold text-slate-900 dark:text-white">Difficulty Level</h4>
                </div>
                <div className="flex gap-3">
                  {DIFFICULTY_LEVELS.map(difficulty => (
                    <Badge
                      key={difficulty}
                      variant={filters.difficulty === difficulty ? 'default' : 'outline'}
                      className={`cursor-pointer px-6 py-2 rounded-lg transition-all duration-200 capitalize ${
                        filters.difficulty === difficulty
                          ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg'
                          : 'border-2 border-slate-200 dark:border-slate-700 hover:border-purple-500 dark:hover:border-purple-400 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm'
                      }`}
                      onClick={() => updateFilter('difficulty', filters.difficulty === difficulty ? '' : difficulty)}
                    >
                      {difficulty}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Popular Tags */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                    <span className="text-orange-600 dark:text-orange-400 text-sm">🏷️</span>
                  </div>
                  <h4 className="text-lg font-semibold text-slate-900 dark:text-white">Popular Tags</h4>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {['Quick', 'Healthy', 'Budget-Friendly', 'Family-Friendly', 'Spicy', 'Sweet', 'Savory'].map(tag => (
                    <Badge
                      key={tag}
                      variant={filters.tags.includes(tag) ? 'default' : 'outline'}
                      className={`cursor-pointer px-4 py-2 rounded-lg transition-all duration-200 ${
                        filters.tags.includes(tag)
                          ? 'bg-orange-600 hover:bg-orange-700 text-white shadow-lg'
                          : 'border-2 border-slate-200 dark:border-slate-700 hover:border-orange-500 dark:hover:border-orange-400 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm'
                      }`}
                      onClick={() => toggleTag(tag)}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}


