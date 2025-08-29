import React, { useState } from 'react'
import { useRecipes } from '@/services/api'
import { RecipeCard } from './RecipeCard'
import { RecipeSearch } from './RecipeSearch'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Grid, List } from 'lucide-react'

interface RecipeListProps {
  onRecipeSelect?: (recipe: any) => void
  onAddRecipe?: () => void
}

export const RecipeList: React.FC<RecipeListProps> = ({ 
  onRecipeSelect, 
  onAddRecipe 
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState({
    dietaryRestrictions: [] as string[],
    prepTime: '' as string,
    difficulty: '' as string,
    tags: [] as string[]
  })

  const { data: recipes, isLoading, error } = useRecipes({ limit: 50 })

  const filteredRecipes =
    (recipes as any)?.recipes?.filter((recipe: any) => {
      // Search filter
      if (
        searchQuery &&
        !recipe.title.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }

      // Dietary restrictions filter
      if (filters.dietaryRestrictions.length > 0) {
        const recipeTags = recipe.tags || [];
        if (
          !filters.dietaryRestrictions.some((restriction) =>
            recipeTags.includes(restriction)
          )
        ) {
          return false;
        }
      }

      // Prep time filter
      if (filters.prepTime) {
        const [min, max] = filters.prepTime.split("-").map(Number);
        if (recipe.prepTime < min || recipe.prepTime > max) {
          return false;
        }
      }

      // Difficulty filter
      if (filters.difficulty && recipe.difficulty !== filters.difficulty) {
        return false;
      }

      return true;
    }) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <p className="text-red-600">Failed to load recipes. Please try again.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Recipes</h2>
          <p className="text-muted-foreground">
            {filteredRecipes.length} recipe{filteredRecipes.length !== 1 ? 's' : ''} found
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('grid')}
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
          {onAddRecipe && (
            <Button onClick={onAddRecipe}>
              <Plus className="h-4 w-4 mr-2" />
              Add Recipe
            </Button>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <RecipeSearch
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filters={filters}
        onFiltersChange={setFilters}
      />

      {/* Recipe Grid/List */}
      {filteredRecipes.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">📖</span>
            </div>
            <h3 className="text-lg font-semibold mb-2">No recipes found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || Object.values(filters).some(f => f && f.length > 0)
                ? 'Try adjusting your search or filters'
                : 'Get started by adding your first recipe'
              }
            </p>
            {onAddRecipe && (
              <Button onClick={onAddRecipe}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Recipe
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className={
          viewMode === 'grid' 
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
            : 'space-y-4'
        }>
          {filteredRecipes.map((recipe: any) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              viewMode={viewMode}
              onClick={() => onRecipeSelect?.(recipe)}
            />
          ))}
        </div>
      )}
    </div>
  )
}


