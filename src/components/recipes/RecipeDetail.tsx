import React, { useState } from 'react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
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
  Heart,
  ThumbsUp,
  Minus,
  ThumbsDown,
  X,
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

  const getPreferenceIcon = (preference: string) => {
    switch (preference) {
      case 'love': return <Heart className="h-4 w-4 fill-red-500 text-red-500" />
      case 'like': return <ThumbsUp className="h-4 w-4 fill-green-500 text-green-500" />
      case 'neutral': return <Minus className="h-4 w-4 text-stone-500" />
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
              className="rounded-xl border-border/60 bg-background/80 backdrop-blur-sm hover:text-stone-900 dark:hover:text-white hover:-translate-y-0.5 transition-all duration-200 shadow-sm"
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

      {/* ── Quick Stats ── */}
      {(totalTime > 0 || recipe.servings || recipe.difficulty) && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mb-6 text-sm text-stone-500 dark:text-stone-400">
          {totalTime > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {totalTime} min total
            </span>
          )}
          {recipe.prepTime !== undefined && recipe.prepTime > 0 && (
            <span>{recipe.prepTime}m prep</span>
          )}
          {recipe.cookTime !== undefined && recipe.cookTime > 0 && (
            <span>{recipe.cookTime}m cook</span>
          )}
          {recipe.servings && (
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              {recipe.servings} servings
            </span>
          )}
          {recipe.difficulty && (
            <span className="capitalize">{recipe.difficulty}</span>
          )}
        </div>
      )}

      {/* ── Tags ── */}
      {recipe.tags && recipe.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-6">
          {recipe.tags.map((tag, index) => (
            <span
              key={index}
              className="px-2.5 py-0.5 rounded-md text-xs font-medium text-stone-500 dark:text-stone-400 bg-stone-100 dark:bg-white/[0.05]"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* ── Two-Column Content Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">
        {/* Left Column — Ingredients + Nutrition */}
        <div className="lg:col-span-2 space-y-6">
          {/* Ingredients */}
          {recipe.ingredients && recipe.ingredients.length > 0 && (
            <div className="rounded-2xl border border-border/60 bg-white/60 dark:bg-white/[0.03] backdrop-blur-xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">Ingredients</h2>
                <span className="text-xs text-stone-400 dark:text-stone-500">
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
                            className={`flex items-center justify-between py-2.5 px-2.5 rounded-lg transition-colors duration-150 ${
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
                        className="w-full mt-3 py-2.5 flex items-center justify-center gap-2 rounded-xl text-sm font-medium text-[#1D9E75]/70 dark:text-[#34d399]/70 hover:text-[#1D9E75] dark:hover:text-[#34d399] transition-all duration-200 active:scale-[0.98] group"
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
            <div className="rounded-2xl border border-border/60 bg-white/60 dark:bg-white/[0.03] backdrop-blur-xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">Nutrition</h2>
                <span className="text-xs text-stone-400 dark:text-stone-500">per serving</span>
              </div>

              <div className="space-y-3">
                {recipe.nutritionInfo!.calories !== undefined && recipe.nutritionInfo!.calories > 0 && (
                  <div className="flex items-baseline justify-between pb-3 border-b border-border/30">
                    <span className="text-sm text-stone-500 dark:text-stone-400">Calories</span>
                    <span className="text-2xl font-bold text-stone-900 dark:text-white tabular-nums">
                      {recipe.nutritionInfo!.calories}
                    </span>
                  </div>
                )}

                {recipe.nutritionInfo!.protein !== undefined && recipe.nutritionInfo!.protein > 0 && (
                  <div>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-stone-500 dark:text-stone-400">Protein</span>
                      <span className="font-medium text-stone-700 dark:text-stone-300 font-mono tabular-nums">{recipe.nutritionInfo!.protein}g</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-stone-100 dark:bg-white/[0.06] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-stone-400 dark:bg-stone-500 transition-all duration-700"
                        style={{ width: maxNutrient > 0 ? `${(recipe.nutritionInfo!.protein! / maxNutrient) * 100}%` : '0%' }}
                      />
                    </div>
                  </div>
                )}

                {recipe.nutritionInfo!.carbs !== undefined && recipe.nutritionInfo!.carbs > 0 && (
                  <div>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-stone-500 dark:text-stone-400">Carbs</span>
                      <span className="font-medium text-stone-700 dark:text-stone-300 font-mono tabular-nums">{recipe.nutritionInfo!.carbs}g</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-stone-100 dark:bg-white/[0.06] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-stone-400 dark:bg-stone-500 transition-all duration-700"
                        style={{ width: maxNutrient > 0 ? `${(recipe.nutritionInfo!.carbs! / maxNutrient) * 100}%` : '0%' }}
                      />
                    </div>
                  </div>
                )}

                {recipe.nutritionInfo!.fat !== undefined && recipe.nutritionInfo!.fat > 0 && (
                  <div>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-stone-500 dark:text-stone-400">Fat</span>
                      <span className="font-medium text-stone-700 dark:text-stone-300 font-mono tabular-nums">{recipe.nutritionInfo!.fat}g</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-stone-100 dark:bg-white/[0.06] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-stone-400 dark:bg-stone-500 transition-all duration-700"
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
            <div className="rounded-2xl border border-border/60 bg-white/60 dark:bg-white/[0.03] backdrop-blur-xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">Family</h2>
              </div>
              <div className="space-y-2">
                {Object.entries(recipe.familyPreferences).map(([memberId, preference]) => (
                  <div
                    key={memberId}
                    className="flex items-center justify-between p-2.5 rounded-xl"
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
            <div className="rounded-2xl border border-border/60 bg-white/60 dark:bg-white/[0.03] backdrop-blur-xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">Instructions</h2>
                <span className="text-xs text-stone-400 dark:text-stone-500">
                  {recipe.instructions.length} steps
                </span>
              </div>
              <div className="space-y-5">
                {recipe.instructions.map((instruction, index) => (
                  <div key={index} className="flex gap-4">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-stone-100 dark:bg-white/[0.06] flex items-center justify-center text-xs font-semibold text-stone-500 dark:text-stone-400">
                      {index + 1}
                    </div>
                    <div className="flex-1 pt-0.5">
                      <p className="text-sm leading-relaxed text-stone-700 dark:text-stone-300">{instruction}</p>
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
