import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useMeasurementSystem } from '@/contexts/MeasurementSystemContext'
import { convertIngredient, optimizeUnit, formatConvertedValue, Unit } from '@/utils/unitConverter'
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
  ThumbsDown,
  X,
  TrendingUp,
  TrendingDown,
  MinusCircle
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
  const [isImageFullscreen, setIsImageFullscreen] = useState(false)
  const { system } = useMeasurementSystem()
  const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0)
  
  const getDifficultyIcon = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return TrendingDown
      case 'medium': return MinusCircle
      case 'hard': return TrendingUp
      default: return MinusCircle
    }
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'text-green-600 dark:text-green-400'
      case 'medium': return 'text-yellow-600 dark:text-yellow-400'
      case 'hard': return 'text-red-600 dark:text-red-400'
      default: return 'text-gray-600 dark:text-gray-400'
    }
  }

  const getDifficultyLabel = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'Easy'
      case 'medium': return 'Medium'
      case 'hard': return 'Hard'
      default: return difficulty
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
    <div className="max-w-4xl mx-auto">
      {/* Header with Image */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            {onClose && (
              <Button variant="outline" size="icon" onClick={onClose}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <h1 className="text-3xl font-bold">{recipe.title}</h1>
          </div>
          {onEdit && (
            <Button onClick={onEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
        </div>

        {/* Recipe Image - Compact header size */}
        {recipe.imageUrl && (
          <>
            <div 
              className="rounded-lg overflow-hidden bg-muted/50 mb-4 cursor-pointer hover:opacity-95 transition-all group shadow-md hover:shadow-lg"
              onClick={() => setIsImageFullscreen(true)}
            >
              <div className="relative w-full h-56">
                <img 
                  src={recipe.imageUrl} 
                  alt={recipe.title}
                  className="w-full h-full object-cover"
                  style={{ 
                    imageRendering: '-webkit-optimize-contrast',
                    backfaceVisibility: 'hidden',
                    transform: 'translateZ(0)',
                    willChange: 'transform'
                  }}
                  loading="lazy"
                  onError={(e) => {
                    console.error('Image failed to load:', recipe.imageUrl);
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-2">
                  <div className="text-white text-xs bg-black/60 px-3 py-1.5 rounded-full backdrop-blur-sm">
                    Click to view full size
                  </div>
                </div>
              </div>
            </div>

            {/* Fullscreen Image Modal */}
            {isImageFullscreen && (
              <div
                className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
                onClick={() => setIsImageFullscreen(false)}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-4 right-4 text-white hover:bg-white/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsImageFullscreen(false);
                  }}
                >
                  <X className="h-6 w-6" />
                </Button>
                <div
                  className="relative max-w-full max-h-full"
                  onClick={(e) => e.stopPropagation()}
                >
                  <img
                    src={recipe.imageUrl}
                    alt={recipe.title}
                    className="max-w-full max-h-[90vh] object-contain rounded-lg"
                  />
                </div>
              </div>
            )}
          </>
        )}

        {/* Description */}
        {recipe.description && (
          <p className="text-muted-foreground text-lg leading-relaxed">{recipe.description}</p>
        )}
      </div>

      {/* Recipe Meta */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Recipe Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
            {recipe.difficulty && (() => {
              const DifficultyIcon = getDifficultyIcon(recipe.difficulty);
              return (
                <div className="text-center">
                  <DifficultyIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Difficulty</p>
                  <p className="font-semibold">{getDifficultyLabel(recipe.difficulty)}</p>
                </div>
              );
            })()}
            {!recipe.difficulty && recipe.rating && (
              <div className="text-center">
                <Star className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Rating</p>
                <p className="font-semibold">{recipe.rating.toFixed(1)}</p>
              </div>
            )}
          </div>

          {/* Tags */}
          {recipe.tags && recipe.tags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-muted-foreground">Tags:</span>
              {recipe.tags.map((tag, index) => (
                <Badge key={index} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ingredients */}
      {recipe.ingredients && recipe.ingredients.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Ingredients</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recipe.ingredients.map((ingredient, index) => {
                // Ensure amount is a valid number
                const amount = typeof ingredient.amount === 'number' ? ingredient.amount : parseFloat(ingredient.amount) || 0;
                const unit = (ingredient.unit || 'piece') as Unit;
                
                // Convert ingredient to user's preferred measurement system
                const converted = convertIngredient(
                  amount,
                  unit,
                  system
                );
                const optimized = optimizeUnit(converted.amount, converted.unit);
                const displayValue = formatConvertedValue(optimized.value, optimized.unit);
                
                return (
                  <div key={index} className="flex items-center justify-between py-2">
                    <span className="font-medium">{ingredient.name}</span>
                    <span className="text-muted-foreground">
                      {displayValue}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      {recipe.instructions && recipe.instructions.length > 0 && (
        <Card className="mb-6">
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

      {/* Family Preferences */}
      {recipe.familyPreferences && Object.keys(recipe.familyPreferences).length > 0 && (
        <Card className="mb-6">
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
  )
}


