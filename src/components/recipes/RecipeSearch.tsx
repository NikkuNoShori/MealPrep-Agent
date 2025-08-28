import React, { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Search, Filter, X } from 'lucide-react'

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
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search recipes..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button
          variant={showFilters ? 'default' : 'outline'}
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="h-4 w-4 mr-2" />
          Filters
        </Button>
        {hasActiveFilters && (
          <Button variant="outline" onClick={clearAllFilters}>
            <X className="h-4 w-4 mr-2" />
            Clear
          </Button>
        )}
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {filters.dietaryRestrictions.map(restriction => (
            <Badge key={restriction} variant="secondary" className="gap-1">
              {restriction}
              <button
                onClick={() => toggleDietaryRestriction(restriction)}
                className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {filters.prepTime && (
            <Badge variant="secondary" className="gap-1">
              {PREP_TIME_RANGES.find(r => r.value === filters.prepTime)?.label}
              <button
                onClick={() => updateFilter('prepTime', '')}
                className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.difficulty && (
            <Badge variant="secondary" className="gap-1">
              {filters.difficulty}
              <button
                onClick={() => updateFilter('difficulty', '')}
                className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.tags.map(tag => (
            <Badge key={tag} variant="secondary" className="gap-1">
              {tag}
              <button
                onClick={() => toggleTag(tag)}
                className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Filter Panel */}
      {showFilters && (
        <Card>
          <CardContent className="p-4 space-y-6">
            {/* Dietary Restrictions */}
            <div>
              <h4 className="font-medium mb-3">Dietary Restrictions</h4>
              <div className="flex flex-wrap gap-2">
                {DIETARY_RESTRICTIONS.map(restriction => (
                  <Badge
                    key={restriction}
                    variant={filters.dietaryRestrictions.includes(restriction) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleDietaryRestriction(restriction)}
                  >
                    {restriction}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Prep Time */}
            <div>
              <h4 className="font-medium mb-3">Prep Time</h4>
              <div className="flex flex-wrap gap-2">
                {PREP_TIME_RANGES.map(range => (
                  <Badge
                    key={range.value}
                    variant={filters.prepTime === range.value ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => updateFilter('prepTime', filters.prepTime === range.value ? '' : range.value)}
                  >
                    {range.label}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Difficulty */}
            <div>
              <h4 className="font-medium mb-3">Difficulty</h4>
              <div className="flex gap-2">
                {DIFFICULTY_LEVELS.map(difficulty => (
                  <Badge
                    key={difficulty}
                    variant={filters.difficulty === difficulty ? 'default' : 'outline'}
                    className="cursor-pointer capitalize"
                    onClick={() => updateFilter('difficulty', filters.difficulty === difficulty ? '' : difficulty)}
                  >
                    {difficulty}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Popular Tags */}
            <div>
              <h4 className="font-medium mb-3">Popular Tags</h4>
              <div className="flex flex-wrap gap-2">
                {['Quick', 'Healthy', 'Budget-Friendly', 'Family-Friendly', 'Spicy', 'Sweet', 'Savory'].map(tag => (
                  <Badge
                    key={tag}
                    variant={filters.tags.includes(tag) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}


