/**
 * MOP-0007 Phase 4 — "Suggest meals for this week" modal
 *
 * Opens from the Meal Planner header. Calls get_recipe_recommendations with
 * optional filters (difficulty, max prep time, tags) and lets the user
 * assign the suggested recipes to empty slots in the current plan.
 *
 * Design:
 *  - Two-step UX: (1) filter preferences → (2) scored results
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
}

type Difficulty = 'easy' | 'medium' | 'hard' | ''
const PREP_OPTIONS = [
  { label: 'Any', value: undefined },
  { label: '≤ 15 min', value: 15 },
  { label: '≤ 30 min', value: 30 },
  { label: '≤ 45 min', value: 45 },
  { label: '≤ 60 min', value: 60 },
]

const difficultyLabel: Record<string, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }
const difficultyColor: Record<string, string> = {
  easy: 'text-emerald-600 dark:text-emerald-400',
  medium: 'text-amber-600 dark:text-amber-400',
  hard: 'text-rose-600 dark:text-rose-400',
}

export const SuggestWeekModal: React.FC<SuggestWeekModalProps> = ({
  onClose,
  onAssign,
  onFillSlots,
  emptySlotCount,
}) => {
  const [difficulty, setDifficulty] = useState<Difficulty>('')
  const [maxPrep, setMaxPrep] = useState<number | undefined>(undefined)
  const [assigned, setAssigned] = useState<Set<string>>(new Set())

  const { data: suggestions = [], isLoading } = useGetRecipeRecommendations({
    preferenceDifficulty: difficulty || undefined,
    maxPrepTimeMinutes: maxPrep,
    limit: 10,
  })

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
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-lg bg-white dark:bg-[#16171c] rounded-2xl shadow-2xl border border-stone-200/80 dark:border-white/[0.08] flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-stone-100 dark:border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-primary-50 dark:bg-primary-500/10">
              <Sparkles className="h-4 w-4 text-primary-500" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-stone-900 dark:text-white">Suggest meals</h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">Scored by your taste history</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Filters */}
        <div className="px-5 py-3 border-b border-stone-100 dark:border-white/[0.06] flex-shrink-0">
          <div className="flex flex-wrap gap-2 items-center">
            {/* Difficulty */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-stone-500 dark:text-stone-400">Difficulty:</span>
              {(['', 'easy', 'medium', 'hard'] as Difficulty[]).map(d => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    difficulty === d
                      ? 'bg-primary-500 text-white shadow-sm'
                      : 'bg-stone-100 dark:bg-white/[0.05] text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-white/[0.08]'
                  }`}
                >
                  {d === '' ? 'Any' : difficultyLabel[d]}
                </button>
              ))}
            </div>

            {/* Prep time */}
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-stone-400" />
              <select
                value={maxPrep ?? ''}
                onChange={e => setMaxPrep(e.target.value ? Number(e.target.value) : undefined)}
                className="text-xs rounded-lg border border-stone-200 dark:border-white/[0.08] bg-stone-50 dark:bg-white/[0.04] text-stone-700 dark:text-stone-300 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                {PREP_OPTIONS.map(o => (
                  <option key={o.label} value={o.value ?? ''}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 gap-2 text-stone-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Finding your best matches…</span>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
              <ChefHat className="h-8 w-8 text-stone-300 dark:text-stone-600" />
              <p className="text-sm text-stone-500 dark:text-stone-400">
                No recipes match those filters.<br />Try relaxing the difficulty or prep time.
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
                      : 'border-stone-200/60 dark:border-white/[0.06] bg-white/60 dark:bg-white/[0.03] hover:bg-white dark:hover:bg-white/[0.06] hover:border-stone-300 dark:hover:border-white/[0.1] hover:-translate-y-0.5 shadow-sm hover:shadow-md'
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-stone-100 dark:bg-white/[0.04]">
                    {hasImage ? (
                      <img src={recipe.imageUrl} alt={recipe.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ChefHat className="h-5 w-5 text-stone-300 dark:text-stone-600" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-stone-800 dark:text-stone-100 truncate">{recipe.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {totalTime > 0 && (
                        <span className="flex items-center gap-0.5 text-[10px] text-stone-500 dark:text-stone-400">
                          <Clock className="h-2.5 w-2.5" />{totalTime}m
                        </span>
                      )}
                      {recipe.difficulty && (
                        <span className={`text-[10px] font-medium ${difficultyColor[recipe.difficulty] ?? 'text-stone-500'}`}>
                          {difficultyLabel[recipe.difficulty]}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Score / assigned */}
                  <div className="flex-shrink-0 flex items-center gap-2">
                    {isAssigned ? (
                      <Check className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <span className="text-[10px] font-medium text-stone-400 dark:text-stone-500 tabular-nums">
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
          <div className="px-5 py-4 border-t border-stone-100 dark:border-white/[0.06] flex-shrink-0 flex items-center justify-between gap-3">
            <p className="text-xs text-stone-500 dark:text-stone-400">
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
