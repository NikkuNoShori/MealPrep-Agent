import React, { useState } from 'react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useMeasurementSystem } from '@/contexts/MeasurementSystemContext'
import { convertIngredient, optimizeUnit, formatConvertedValue, Unit } from '@/utils/unitConverter'
import { VisibilityPicker, type RecipeVisibility } from '@/components/recipes/VisibilityPicker'
import { AddToCollectionMenu } from '@/components/recipes/AddToCollectionMenu'
import AddToPlanButton from '@/components/meal-planning/AddToPlanButton'
import { useUpdateRecipeVisibility } from '@/services/api'
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
  MinusCircle,
  Flame,
  UtensilsCrossed,
  ListChecks,
  ChevronDown
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
    visibility?: RecipeVisibility
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
  const [showAllIngredients, setShowAllIngredients] = useState(false)
  const [localVisibility, setLocalVisibility] = useState<RecipeVisibility>(recipe.visibility || 'private')
  const { system } = useMeasurementSystem()
  const updateVisibility = useUpdateRecipeVisibility()
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
      case 'easy': return 'text-green-500 bg-green-500/10 dark:bg-green-500/20'
      case 'medium': return 'text-yellow-500 bg-yellow-500/10 dark:bg-yellow-500/20'
      case 'hard': return 'text-red-500 bg-red-500/10 dark:bg-red-500/20'
      default: return 'text-muted-foreground bg-muted'
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

  const hasImage = recipe.imageUrl && recipe.imageUrl !== 'none'
  const hasNutrition = recipe.nutritionInfo && (
    (recipe.nutritionInfo.calories && recipe.nutritionInfo.calories > 0) ||
    (recipe.nutritionInfo.protein && recipe.nutritionInfo.protein > 0) ||
    (recipe.nutritionInfo.carbs && recipe.nutritionInfo.carbs > 0) ||
    (recipe.nutritionInfo.fat && recipe.nutritionInfo.fat > 0)
  )

  const maxNutrient = Math.max(
    recipe.nutritionInfo?.protein || 0,
    recipe.nutritionInfo?.carbs || 0,
    recipe.nutritionInfo?.fat || 0
  )

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      {/* ── Top Bar ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {onClose && (
            <Button
              variant="outline"
              size="icon"
              onClick={onClose}
              className="rounded-xl border-border/60 bg-background/80 backdrop-blur-sm hover:bg-accent/50 hover:-translate-y-0.5 transition-all duration-200 shadow-sm"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onEdit && (
            <Button
              onClick={onEdit}
              className="rounded-xl hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
          <AddToPlanButton
            recipeId={recipe.id}
            recipeName={recipe.title}
            recipeImage={recipe.imageUrl}
            servings={recipe.servings}
            prepTime={recipe.prepTime}
            cookTime={recipe.cookTime}
            size="sm"
          />
          <AddToCollectionMenu recipeId={recipe.id} size="sm" />
          <VisibilityPicker
            value={localVisibility}
            onChange={(v) => {
              const prev = localVisibility
              setLocalVisibility(v)
              updateVisibility.mutate({ recipeId: recipe.id, visibility: v }, {
                onSuccess: () => {
                  toast.success(`Recipe set to ${v}`)
                },
                onError: (err: any) => {
                  toast.error(err?.message || 'Failed to update visibility')
                  setLocalVisibility(prev)
                },
              })
            }}
            size="sm"
          />
        </div>
      </div>

      {/* ── Hero Image (full width) ── */}
      {hasImage && (
        <>
          <div
            className="relative rounded-2xl overflow-hidden cursor-pointer group shadow-lg hover:shadow-2xl transition-all duration-500 mb-6"
            onClick={() => setIsImageFullscreen(true)}
          >
            <div className="relative w-full h-72 sm:h-80 lg:h-96">
              <img
                src={recipe.imageUrl}
                alt={recipe.title}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                style={{
                  imageRendering: '-webkit-optimize-contrast',
                  backfaceVisibility: 'hidden',
                  transform: 'translateZ(0)',
                }}
                loading="lazy"
                onError={(e) => {
                  console.error('Image failed to load:', recipe.imageUrl)
                  e.currentTarget.style.display = 'none'
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
                <h1 className="text-3xl sm:text-4xl font-bold text-white drop-shadow-lg leading-tight">
                  {recipe.title}
                </h1>
                {recipe.description && (
                  <p className="text-white/80 text-sm sm:text-base mt-2 line-clamp-2 max-w-2xl">
                    {recipe.description}
                  </p>
                )}
              </div>
              <div className="absolute top-4 right-4 text-white text-xs bg-black/50 px-3 py-1.5 rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                Click to enlarge
              </div>
            </div>
          </div>

          {isImageFullscreen && (
            <div
              className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
              onClick={() => setIsImageFullscreen(false)}
            >
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 text-white hover:bg-white/20 rounded-xl"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsImageFullscreen(false)
                }}
              >
                <X className="h-6 w-6" />
              </Button>
              <div className="relative max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
                <img
                  src={recipe.imageUrl}
                  alt={recipe.title}
                  className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl"
                />
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Title (no-image fallback) ── */}
      {!hasImage && (
        <div className="mb-6">
          <h1 className="text-3xl sm:text-4xl font-bold">{recipe.title}</h1>
          {recipe.description && (
            <p className="text-muted-foreground text-base sm:text-lg leading-relaxed mt-3 max-w-2xl">
              {recipe.description}
            </p>
          )}
        </div>
      )}

      {/* ── Quick Stats Pills ── */}
      {(totalTime > 0 || recipe.servings || recipe.difficulty) && (
        <div className="flex flex-wrap gap-3 mb-6 animate-slide-up">
          {totalTime > 0 && (
            <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/20 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
              <Clock className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">{totalTime} min</span>
            </div>
          )}
          {recipe.prepTime !== undefined && recipe.prepTime > 0 && (
            <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-violet-500/10 dark:bg-violet-500/20 border border-violet-500/20 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
              <ChefHat className="h-4 w-4 text-violet-500" />
              <span className="text-sm font-semibold text-violet-700 dark:text-violet-300">Prep {recipe.prepTime}m</span>
            </div>
          )}
          {recipe.cookTime !== undefined && recipe.cookTime > 0 && (
            <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-orange-500/10 dark:bg-orange-500/20 border border-orange-500/20 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
              <Flame className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-semibold text-orange-700 dark:text-orange-300">Cook {recipe.cookTime}m</span>
            </div>
          )}
          {recipe.servings && (
            <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/20 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
              <Users className="h-4 w-4 text-emerald-500" />
              <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{recipe.servings} servings</span>
            </div>
          )}
          {recipe.difficulty && (() => {
            const DifficultyIcon = getDifficultyIcon(recipe.difficulty)
            const colorClasses = getDifficultyColor(recipe.difficulty)
            return (
              <div className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-current/20 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${colorClasses}`}>
                <DifficultyIcon className="h-4 w-4" />
                <span className="text-sm font-semibold">{getDifficultyLabel(recipe.difficulty)}</span>
              </div>
            )
          })()}
          {!recipe.difficulty && recipe.rating && (
            <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-yellow-500/10 dark:bg-yellow-500/20 border border-yellow-500/20 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
              <span className="text-sm font-semibold text-yellow-700 dark:text-yellow-300">{recipe.rating.toFixed(1)}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Tags ── */}
      {recipe.tags && recipe.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {recipe.tags.map((tag, index) => (
            <Badge
              key={index}
              variant="secondary"
              className="rounded-full px-3 py-1 text-xs font-medium bg-primary/5 dark:bg-primary/10 text-primary border-primary/20 hover:bg-primary/10 dark:hover:bg-primary/20 transition-colors duration-200"
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* ── Two-Column Content Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">
        {/* Left Column — Ingredients + Nutrition */}
        <div className="lg:col-span-2 space-y-6">
          {/* Ingredients */}
          {recipe.ingredients && recipe.ingredients.length > 0 && (
            <div className="rounded-2xl border border-border/60 bg-white/60 dark:bg-white/[0.03] backdrop-blur-xl shadow-sm p-5 transition-all duration-300 hover:shadow-md">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-xl bg-primary/10 dark:bg-primary/20">
                  <UtensilsCrossed className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-lg font-bold">Ingredients</h2>
                <span className="text-xs text-muted-foreground ml-auto bg-muted/60 px-2.5 py-1 rounded-full">
                  {recipe.ingredients.length}
                </span>
              </div>
              {(() => {
                const INGREDIENT_LIMIT = 10
                const allIngredients = recipe.ingredients!
                const isOverLimit = allIngredients.length > INGREDIENT_LIMIT
                const visibleIngredients = showAllIngredients ? allIngredients : allIngredients.slice(0, INGREDIENT_LIMIT)
                const hiddenCount = allIngredients.length - INGREDIENT_LIMIT

                return (
                  <>
                    <div className="space-y-0.5">
                      {visibleIngredients.map((ingredient, index) => {
                        const amount = typeof ingredient.amount === 'number' ? ingredient.amount : parseFloat(ingredient.amount) || 0
                        const unit = (ingredient.unit || 'piece') as Unit
                        const converted = convertIngredient(amount, unit, system)
                        const optimized = optimizeUnit(converted.amount, converted.unit)
                        const displayValue = formatConvertedValue(optimized.value, optimized.unit)

                        return (
                          <div
                            key={index}
                            className={`flex items-center justify-between py-2.5 px-2.5 rounded-lg transition-colors duration-150 hover:bg-accent/40 ${
                              index !== visibleIngredients.length - 1 ? 'border-b border-border/30' : ''
                            }`}
                          >
                            <span className="font-medium text-sm">{ingredient.name}</span>
                            <span className="text-sm text-muted-foreground font-mono tabular-nums ml-3 shrink-0">
                              {displayValue}
                            </span>
                          </div>
                        )
                      })}
                    </div>

                    {isOverLimit && (
                      <button
                        type="button"
                        onClick={() => setShowAllIngredients(!showAllIngredients)}
                        className="w-full mt-3 py-2.5 flex items-center justify-center gap-2 rounded-xl text-sm font-medium text-primary bg-primary/5 dark:bg-primary/10 hover:bg-primary/10 dark:hover:bg-primary/20 border border-primary/15 transition-all duration-200 hover:shadow-sm active:scale-[0.98] group"
                      >
                        <span>
                          {showAllIngredients ? 'Show less' : `Show ${hiddenCount} more`}
                        </span>
                        <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${showAllIngredients ? 'rotate-180' : 'group-hover:translate-y-0.5'}`} />
                      </button>
                    )}
                  </>
                )
              })()}
            </div>
          )}

          {/* Nutrition */}
          {hasNutrition && (
            <div className="rounded-2xl border border-border/60 bg-white/60 dark:bg-white/[0.03] backdrop-blur-xl shadow-sm p-5 transition-all duration-300 hover:shadow-md">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-xl bg-orange-500/10 dark:bg-orange-500/20">
                  <Flame className="h-5 w-5 text-orange-500" />
                </div>
                <h2 className="text-lg font-bold">Nutrition</h2>
                <span className="text-xs text-muted-foreground ml-auto">per serving</span>
              </div>

              <div className="space-y-4">
                {recipe.nutritionInfo!.calories !== undefined && recipe.nutritionInfo!.calories > 0 && (
                  <div className="text-center p-3.5 rounded-xl bg-gradient-to-br from-orange-500/10 to-red-500/10 dark:from-orange-500/20 dark:to-red-500/20 border border-orange-500/20">
                    <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                      {recipe.nutritionInfo!.calories}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 font-medium uppercase tracking-wider">Calories</div>
                  </div>
                )}

                {recipe.nutritionInfo!.protein !== undefined && recipe.nutritionInfo!.protein > 0 && (
                  <div>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="font-medium">Protein</span>
                      <span className="text-muted-foreground font-mono">{recipe.nutritionInfo!.protein}g</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted/60 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-700"
                        style={{ width: maxNutrient > 0 ? `${(recipe.nutritionInfo!.protein! / maxNutrient) * 100}%` : '0%' }}
                      />
                    </div>
                  </div>
                )}

                {recipe.nutritionInfo!.carbs !== undefined && recipe.nutritionInfo!.carbs > 0 && (
                  <div>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="font-medium">Carbs</span>
                      <span className="text-muted-foreground font-mono">{recipe.nutritionInfo!.carbs}g</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted/60 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-700"
                        style={{ width: maxNutrient > 0 ? `${(recipe.nutritionInfo!.carbs! / maxNutrient) * 100}%` : '0%' }}
                      />
                    </div>
                  </div>
                )}

                {recipe.nutritionInfo!.fat !== undefined && recipe.nutritionInfo!.fat > 0 && (
                  <div>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="font-medium">Fat</span>
                      <span className="text-muted-foreground font-mono">{recipe.nutritionInfo!.fat}g</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted/60 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-rose-500 to-pink-400 transition-all duration-700"
                        style={{ width: maxNutrient > 0 ? `${(recipe.nutritionInfo!.fat! / maxNutrient) * 100}%` : '0%' }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Family Preferences */}
          {recipe.familyPreferences && Object.keys(recipe.familyPreferences).length > 0 && (
            <div className="rounded-2xl border border-border/60 bg-white/60 dark:bg-white/[0.03] backdrop-blur-xl shadow-sm p-5 transition-all duration-300 hover:shadow-md">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-xl bg-pink-500/10 dark:bg-pink-500/20">
                  <Heart className="h-5 w-5 text-pink-500" />
                </div>
                <h2 className="text-lg font-bold">Family</h2>
              </div>
              <div className="space-y-2">
                {Object.entries(recipe.familyPreferences).map(([memberId, preference]) => (
                  <div
                    key={memberId}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-accent/30 hover:bg-accent/50 transition-colors duration-150"
                  >
                    <span className="font-medium text-sm">{memberId}</span>
                    <div className="flex items-center gap-1.5">
                      {getPreferenceIcon(preference)}
                      <span className="text-xs capitalize text-muted-foreground">{preference}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column — Instructions */}
        <div className="lg:col-span-3">
          {recipe.instructions && recipe.instructions.length > 0 && (
            <div className="rounded-2xl border border-border/60 bg-white/60 dark:bg-white/[0.03] backdrop-blur-xl shadow-sm p-5 transition-all duration-300 hover:shadow-md">
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20">
                  <ListChecks className="h-5 w-5 text-emerald-500" />
                </div>
                <h2 className="text-lg font-bold">Instructions</h2>
                <span className="text-xs text-muted-foreground ml-auto bg-muted/60 px-2.5 py-1 rounded-full">
                  {recipe.instructions.length} steps
                </span>
              </div>
              <div className="space-y-5">
                {recipe.instructions.map((instruction, index) => (
                  <div key={index} className="flex gap-4 group">
                    <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground flex items-center justify-center text-sm font-bold shadow-sm group-hover:shadow-md group-hover:scale-105 transition-all duration-200">
                      {index + 1}
                    </div>
                    <div className="flex-1 pt-1">
                      <p className="text-sm leading-relaxed text-foreground/90">{instruction}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
