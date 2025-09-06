import React, { useState } from 'react'
import { useRecipes, useCreateRecipe, useDeleteRecipe } from '@/services/api'
import { RecipeCard } from './RecipeCard'
import { RecipeSearch } from './RecipeSearch'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Grid, List, TestTube, CheckCircle } from 'lucide-react'

interface RecipeListProps {
  onRecipeSelect?: (recipe: any) => void
  onAddRecipe?: () => void
  onEditRecipe?: (recipe: any) => void
}

export const RecipeList: React.FC<RecipeListProps> = ({ 
  onRecipeSelect, 
  onAddRecipe,
  onEditRecipe
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState({
    dietaryRestrictions: [] as string[],
    prepTime: '' as string,
    difficulty: '' as string,
    tags: [] as string[]
  })
  const [testRecipeSuccess, setTestRecipeSuccess] = useState(false)

  const { data: recipes, isLoading, error } = useRecipes({ limit: 50 })
  const createRecipeMutation = useCreateRecipe()
  const deleteRecipeMutation = useDeleteRecipe()

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

  const createTestRecipe = async () => {
    const testRecipe = {
      title: 'Quick Test Pasta',
      description: 'A simple test recipe for development and testing purposes.',
      prepTime: 10,
      cookTime: 15,
      servings: 2,
      difficulty: 'easy',
      tags: ['Test', 'Quick', 'Pasta', 'Easy'],
      ingredients: [
        { name: 'Pasta', amount: 200, unit: 'g' },
        { name: 'Tomato sauce', amount: 1, unit: 'cup' },
        { name: 'Garlic', amount: 2, unit: 'cloves' },
        { name: 'Olive oil', amount: 2, unit: 'tbsp' }
      ],
      instructions: [
        'Boil water and cook pasta according to package directions.',
        'Heat olive oil in a pan and sauté minced garlic.',
        'Add tomato sauce and simmer for 5 minutes.',
        'Drain pasta and mix with sauce.',
        'Serve hot with grated cheese if desired.'
      ],
      imageUrl: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&h=600&fit=crop'
    }

    console.log('Creating test recipe with data:', testRecipe)
    
    try {
      const result = await createRecipeMutation.mutateAsync(testRecipe)
      console.log('Test recipe created successfully:', result)
      setTestRecipeSuccess(true)
      setTimeout(() => setTestRecipeSuccess(false), 3000) // Hide success message after 3 seconds
    } catch (error) {
      console.error('Failed to create test recipe:', error)
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        status: (error as any)?.status,
        response: (error as any)?.response
      })
    }
  }

  const handleDeleteRecipe = async (recipeId: string) => {
    if (window.confirm('Are you sure you want to delete this recipe? This action cannot be undone.')) {
      try {
        await deleteRecipeMutation.mutateAsync(recipeId)
        console.log('Recipe deleted successfully:', recipeId)
      } catch (error) {
        console.error('Failed to delete recipe:', error)
      }
    }
  }

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
    <div className="space-y-8">
      {/* Modern Header with Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-2 h-8 bg-gradient-to-b from-blue-600 to-purple-600 rounded-full"></div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-200 bg-clip-text text-transparent">
              Your Recipes
            </h2>
          </div>
          <p className="text-slate-600 dark:text-slate-400 text-lg">
            {filteredRecipes.length} recipe{filteredRecipes.length !== 1 ? 's' : ''} in your collection
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className={`rounded-lg transition-all duration-200 ${
                viewMode === 'grid' 
                  ? 'bg-white dark:bg-slate-700 shadow-sm' 
                  : 'hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className={`rounded-lg transition-all duration-200 ${
                viewMode === 'list' 
                  ? 'bg-white dark:bg-slate-700 shadow-sm' 
                  : 'hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          
          <Button 
            onClick={createTestRecipe}
            disabled={createRecipeMutation.isPending}
            className={`px-4 py-2 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 ${
              testRecipeSuccess 
                ? 'bg-gradient-to-r from-green-500 to-green-600 text-white' 
                : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white'
            }`}
          >
            {testRecipeSuccess ? (
              <CheckCircle className="h-4 w-4 mr-2" />
            ) : (
              <TestTube className="h-4 w-4 mr-2" />
            )}
            {testRecipeSuccess ? 'Added!' : createRecipeMutation.isPending ? 'Adding...' : 'Quick Test'}
          </Button>
          {onAddRecipe && (
            <Button 
              onClick={onAddRecipe}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-2 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Recipe
            </Button>
          )}
        </div>
      </div>

      {/* Enhanced Search and Filters */}
      <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/50 p-6 shadow-sm">
        <RecipeSearch
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filters={filters}
          onFiltersChange={setFilters}
        />
      </div>

      {/* Recipe Grid/List with Enhanced Empty State */}
      {filteredRecipes.length === 0 ? (
        <div className="text-center py-16">
          <div className="max-w-md mx-auto">
            <div className="relative mb-8">
              <div className="w-32 h-32 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 rounded-3xl flex items-center justify-center mx-auto shadow-lg">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center">
                  <span className="text-3xl">📖</span>
                </div>
              </div>
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-sm">✨</span>
              </div>
            </div>
            
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
              {searchQuery || Object.values(filters).some(f => f && f.length > 0)
                ? 'No recipes match your search'
                : 'Start building your recipe collection'
              }
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-8 text-lg leading-relaxed">
              {searchQuery || Object.values(filters).some(f => f && f.length > 0)
                ? 'Try adjusting your search terms or filters to find what you\'re looking for.'
                : 'Add your first recipe to get started with meal planning and cooking inspiration.'
              }
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                onClick={createTestRecipe}
                disabled={createRecipeMutation.isPending}
                size="lg"
                className={`px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5 ${
                  testRecipeSuccess 
                    ? 'bg-gradient-to-r from-green-500 to-green-600 text-white' 
                    : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white'
                }`}
              >
                {testRecipeSuccess ? (
                  <CheckCircle className="h-5 w-5 mr-2" />
                ) : (
                  <TestTube className="h-5 w-5 mr-2" />
                )}
                {testRecipeSuccess ? 'Test Recipe Added!' : createRecipeMutation.isPending ? 'Adding Test Recipe...' : 'Add Test Recipe'}
              </Button>
              {onAddRecipe && (
                <Button 
                  onClick={onAddRecipe}
                  size="lg"
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  {searchQuery || Object.values(filters).some(f => f && f.length > 0)
                    ? 'Add New Recipe'
                    : 'Add Your First Recipe'
                  }
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className={
          viewMode === 'grid' 
            ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
            : 'space-y-4'
        }>
          {filteredRecipes.map((recipe: any, index: number) => (
            <div 
              key={recipe.id}
              className="animate-fade-in"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <RecipeCard
                recipe={recipe}
                viewMode={viewMode}
                onClick={() => onRecipeSelect?.(recipe)}
                onEdit={onEditRecipe}
                onDelete={handleDeleteRecipe}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


