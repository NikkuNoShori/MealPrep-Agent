import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  ArrowLeft, 
  Edit, 
  Clock, 
  Users, 
  Star, 
  ChefHat,
  Heart,
  ThumbsUp,
  Minus,
  ThumbsDown
} from 'lucide-react'

interface RecipeDetailProps {
  recipe: {
    id: string
    title: string
    description?: string
    prepTime?: number
    cookTime?: number
    servings?: number
    difficulty?: 'easy' | 'medium' | 'hard'
    tags?: string[]
    imageUrl?: string
    rating?: number
    ingredients?: Array<{
      name: string
      amount: number
      unit: string
      category?: string
    }>
    instructions?: string[]
    familyPreferences?: { [memberId: string]: 'love' | 'like' | 'neutral' | 'dislike' }
    nutritionInfo?: {
      calories?: number
      protein?: number
      carbs?: number
      fat?: number
    }
  }
  onEdit?: () => void
  onClose?: () => void
}

export const RecipeDetail: React.FC<RecipeDetailProps> = ({ 
  recipe, 
  onEdit, 
  onClose 
}) => {
  const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0)
  
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'hard': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  const getPreferenceIcon = (preference: string) => {
    switch (preference) {
      case 'love': return <Heart className="h-4 w-4 fill-red-500 text-red-500" />
      case 'like': return <ThumbsUp className="h-4 w-4 fill-green-500 text-green-500" />
      case 'neutral': return <Minus className="h-4 w-4 text-gray-500" />
      case 'dislike': return <ThumbsDown className="h-4 w-4 fill-red-500 text-red-500" />
      default: return null
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {onClose && (
            <Button variant="outline" size="icon" onClick={onClose}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <h1 className="text-3xl font-bold">{recipe.title}</h1>
            {recipe.description && (
              <p className="text-muted-foreground mt-1">{recipe.description}</p>
            )}
          </div>
        </div>
        {onEdit && (
          <Button onClick={onEdit}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Recipe
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recipe Image */}
          {recipe.imageUrl && (
            <Card>
              <CardContent className="p-0">
                <img 
                  src={recipe.imageUrl} 
                  alt={recipe.title}
                  className="w-full h-64 object-cover rounded-t-lg"
                />
              </CardContent>
            </Card>
          )}

          {/* Recipe Meta */}
          <Card>
            <CardHeader>
              <CardTitle>Recipe Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {totalTime > 0 && (
                  <div className="text-center">
                    <Clock className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Total Time</p>
                    <p className="font-semibold">{totalTime} min</p>
                  </div>
                )}
                {recipe.prepTime && (
                  <div className="text-center">
                    <ChefHat className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Prep Time</p>
                    <p className="font-semibold">{recipe.prepTime} min</p>
                  </div>
                )}
                {recipe.servings && (
                  <div className="text-center">
                    <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Servings</p>
                    <p className="font-semibold">{recipe.servings}</p>
                  </div>
                )}
                {recipe.rating && (
                  <div className="text-center">
                    <Star className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Rating</p>
                    <p className="font-semibold">{recipe.rating.toFixed(1)}</p>
                  </div>
                )}
              </div>

              {/* Tags and Difficulty */}
              <div className="flex items-center gap-4 mt-4">
                {recipe.difficulty && (
                  <Badge 
                    variant="outline" 
                    className={`${getDifficultyColor(recipe.difficulty)}`}
                  >
                    {recipe.difficulty}
                  </Badge>
                )}
                {recipe.tags && recipe.tags.map((tag, index) => (
                  <Badge key={index} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Ingredients */}
          {recipe.ingredients && recipe.ingredients.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Ingredients</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {recipe.ingredients.map((ingredient, index) => (
                    <div key={index} className="flex items-center justify-between py-2">
                      <span className="font-medium">{ingredient.name}</span>
                      <span className="text-muted-foreground">
                        {ingredient.amount} {ingredient.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Instructions */}
          {recipe.instructions && recipe.instructions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Instructions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recipe.instructions.map((instruction, index) => (
                    <div key={index} className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-semibold">
                        {index + 1}
                      </div>
                      <p className="flex-1">{instruction}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Family Preferences */}
          {recipe.familyPreferences && Object.keys(recipe.familyPreferences).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Family Preferences</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(recipe.familyPreferences).map(([memberId, preference]) => (
                    <div key={memberId} className="flex items-center justify-between">
                      <span className="font-medium">{memberId}</span>
                      <div className="flex items-center gap-1">
                        {getPreferenceIcon(preference)}
                        <span className="text-sm capitalize">{preference}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Nutrition Information */}
          {recipe.nutritionInfo && (
            <Card>
              <CardHeader>
                <CardTitle>Nutrition (per serving)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recipe.nutritionInfo.calories && (
                    <div className="flex justify-between">
                      <span>Calories</span>
                      <span className="font-medium">{recipe.nutritionInfo.calories}</span>
                    </div>
                  )}
                  {recipe.nutritionInfo.protein && (
                    <div className="flex justify-between">
                      <span>Protein</span>
                      <span className="font-medium">{recipe.nutritionInfo.protein}g</span>
                    </div>
                  )}
                  {recipe.nutritionInfo.carbs && (
                    <div className="flex justify-between">
                      <span>Carbohydrates</span>
                      <span className="font-medium">{recipe.nutritionInfo.carbs}g</span>
                    </div>
                  )}
                  {recipe.nutritionInfo.fat && (
                    <div className="flex justify-between">
                      <span>Fat</span>
                      <span className="font-medium">{recipe.nutritionInfo.fat}g</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}


