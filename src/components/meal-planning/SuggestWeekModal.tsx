/**
 * MOP-0007 Phase 4 — "Suggest meals for this week" modal
 *
 * Opens from the Meal Planner header. Calls get_recipe_recommendations
 * (no filters — ranked purely by rating/reaction/recency signal, per user
 * request 2026-10-19: "I don't want those options, I just want to click
 * the randomizer and it give me a recipe") and lets the user assign the
 * suggested recipes to empty slots in the current plan.
 *
 * Design:
 *  - "Fill empty slots" shortcut assigns the top N suggestions to unfilled
 *    dinner slots (or whichever slot the user picks) in one click
 *  - Individual cards can be clicked to assign to a specific slot via the
 *    existing DayAssignmentModal flow (passed in as onAssign callback)
 */

import React, { useState } from 'react'
import { X, Sparkles, Clock, ChefHat, Loader2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useGetRecipeRecommendations } from '@/services/api'

interface SuggestWeekModalProps {
  onClose: () => void
  /** Called when the user clicks a recipe card — parent opens slot picker */
  onAssign: (recipe: any) => void
  /** Called with an array of recipes for "fill empty slots" shortcut */
  onFillSlots: (recipes: any[]) => void
  /** How many empty dinner slots exist in the current plan week */
  emptySlotCount: number
  /**
   * Recipe IDs used in the most recent plan — excluded from suggestions
   * to avoid repeating last week's meals. Parent derives this from historyPlans[0].
   */
  excludeRecipeIds?: Set<string>
}

const difficultyLabel: Record<string, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }
const difficultyColor: Record<string, string> = {
  easy: 'text-emerald-800 dark:text-emerald-400',
  medium: 'text-amber-800 dark:text-amber-400',
  hard: 'text-rose-800 dark:text-rose-400',
}

// Extract all recipe IDs used in a meal plan's meals object
// (kept for potential future use; parent currently derives IDs and passes excludeRecipeIds)
function _extractPlanRecipeIds(meals: Record<string, any> | undefined): Set<string> {
  const ids = new Set<string>()
  if (!meals) return ids
  for (const [key, val] of Object.entries(meals)) {
    if (!val) continue
    if (key.startsWith('_') && Array.isArray(val)) {
      val.forEach((e: any) => e?.recipeId && ids.add(e.recipeId))
    } else if (typeof val === 'object' && !Array.isArray(val)) {
      for (const slotEntries of Object.values(val as Record<string, any[]>)) {
        if (Array.isArray(slotEntries)) {
          slotEntries.forEach((e: any) => e?.recipeId && ids.add(e.recipeId))
        }
      }
    }
  }
  return ids
}

export const SuggestWeekModal: React.FC<SuggestWeekModalProps> = ({
  onClose,
  onAssign,
  onFillSlots,
  emptySlotCount,
  excludeRecipeIds,
}) => {
  const [assigned, setAssigned] = useState<Set<string>>(new Set())

  // Fetch extra to compensate for excluded recipes — if 5 might be excluded, ask for 15
  const fetchLimit = excludeRecipeIds && excludeRecipeIds.size > 0 ? 20 : 10

  // No filters — ranked by the RPC's rating/reaction/recency signal only.
  const { data: rawSuggestions = [], isLoading } = useGetRecipeRecommendations({
    limit: fetchLimit,
  })

  // Filter out last-plan recipes, keep top 10 of what remains
  const suggestions = React.useMemo(() => {
    if (!excludeRecipeIds || excludeRecipeIds.size === 0) return rawSuggestions.slice(0, 10)
    return rawSuggestions.filter((r: any) => !excludeRecipeIds.has(r.id)).slice(0, 10)
  }, [rawSuggestions, excludeRecipeIds])

  const excludedCount = rawSuggestions.length - rawSuggestions.filter((r: any) =>
    !excludeRecipeIds || !excludeRecipeIds.has(r.id)
  ).length

  const handleAssign = (recipe: any) => {
    onAssign(recipe)
    setAssigned(prev => new Set(prev).add(recipe.id))
  }

  const handleFill = () => {
    const toFill = suggestions.slice(0, emptySlotCount)
    onFillSlots(toFill)
    toFill.forEach(r => setAssigned(prev => new Set(prev).add(r.id)))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 modal-backdrop backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-lg bg-white dark:bg-[var(--rs-bg)] rounded-2xl shadow-2xl border border-surface-200/80 dark:border-white/[0.08] flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-surface-100 dark:border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-primary-50 dark:bg-primary-500/10">
              <Sparkles className="h-4 w-4 text-brand" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-fg">Suggest meals</h2>
              <p className="text-xs text-fg-muted">Scored by your taste history</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-fg-muted hover:text-fg-secondary transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {excludedCount > 0 && (
          <div className="px-5 py-2 border-b border-surface-100 dark:border-white/[0.06] flex-shrink-0">
            <p className="text-[10px] text-fg-muted">
              {excludedCount} recipe{excludedCount !== 1 ? 's' : ''} from your last plan hidden to keep things fresh
            </p>
          </div>
        )}

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 gap-2 text-fg-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Finding your best matches…</span>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
              <ChefHat className="h-8 w-8 text-fg-faint" />
              <p className="text-sm text-fg-muted">
                No recipes to suggest right now.<br />Add some recipes to your library first.
              </p>
            </div>
          ) : (
            suggestions.map((recipe: any) => {
              const hasImage = recipe.imageUrl && recipe.imageUrl !== 'none'
              const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0)
              const isAssigned = assigned.has(recipe.id)
              const score = Math.round((recipe.recommendationScore ?? 0) * 100)

              return (
                <button
                  key={recipe.id}
                  onClick={() => !isAssigned && handleAssign(recipe)}
                  disabled={isAssigned}
                  className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 ${
                    isAssigned
                      ? 'border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/5 opacity-60 cursor-default'
                      : 'border-surface-200/60 dark:border-white/[0.06] bg-white/60 dark:bg-white/[0.03] hover:bg-white dark:hover:bg-white/[0.06] hover:border-surface-300 dark:hover:border-white/[0.1] hover:-translate-y-0.5 shadow-sm hover:shadow-md'
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-surface-100 dark:bg-white/[0.04]">
                    {hasImage ? (
                      <img src={recipe.imageUrl} alt={recipe.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ChefHat className="h-5 w-5 text-fg-faint" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-fg truncate">{recipe.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {totalTime > 0 && (
                        <span className="flex items-center gap-0.5 text-[10px] text-fg-muted">
                          <Clock className="h-2.5 w-2.5" />{totalTime}m
                        </span>
                      )}
                      {recipe.difficulty && (
                        <span className={`text-[10px] font-medium ${difficultyColor[recipe.difficulty] ?? 'text-fg-muted'}`}>
                          {difficultyLabel[recipe.difficulty]}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Score / assigned */}
                  <div className="flex-shrink-0 flex items-center gap-2">
                    {isAssigned ? (
                      <Check className="h-4 w-4 text-emerald-800 dark:text-emerald-400" />
                    ) : (
                      <span className="text-[10px] font-medium text-fg-muted tabular-nums">
                        {score}%
                      </span>
                    )}
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Footer */}
        {suggestions.length > 0 && emptySlotCount > 0 && (
          <div className="px-5 py-4 border-t border-surface-100 dark:border-white/[0.06] flex-shrink-0 flex items-center justify-between gap-3">
            <p className="text-xs text-fg-muted">
              {emptySlotCount} empty dinner slot{emptySlotCount !== 1 ? 's' : ''} this week
            </p>
            <Button
              size="sm"
              onClick={handleFill}
              className="gap-1.5 rounded-xl text-xs"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Fill {Math.min(emptySlotCount, suggestions.length)} slot{Math.min(emptySlotCount, suggestions.length) !== 1 ? 's' : ''}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
