/**
 * MOP-0007 Phase 2 — Similar Recipes Rail
 *
 * Renders a horizontally-scrollable row of up to 5 recipe cards whose
 * embeddings are closest to the current recipe's embedding. Backed by
 * the `find_similar_recipes` RPC via useFindSimilarRecipes hook.
 *
 * Design rules:
 *  - Hidden entirely when loading, when the recipe has no embedding, or
 *    when the query returns zero results (no "nothing found" state shown).
 *  - Cards are click-navigable: parent receives the selected recipe via
 *    onSelect so it can swap the detail view without a page nav.
 *  - Similarity score badge is informational only (shown on hover).
 */

import React from 'react'
import { Clock, ChefHat } from 'lucide-react'
import { useFindSimilarRecipes } from '@/services/api'

interface SimilarRecipesRailProps {
  recipeId: string
  onSelect: (recipe: any) => void
}

const difficultyLabel: Record<string, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
}

const difficultyColor: Record<string, string> = {
  easy: 'text-emerald-600 dark:text-emerald-400',
  medium: 'text-amber-600 dark:text-amber-400',
  hard: 'text-rose-600 dark:text-rose-400',
}

export const SimilarRecipesRail: React.FC<SimilarRecipesRailProps> = ({
  recipeId,
  onSelect,
}) => {
  const { data: similar, isLoading } = useFindSimilarRecipes(recipeId)

  // Hide the rail entirely — never show an empty state
  if (isLoading || !similar || similar.length === 0) return null

  return (
    <div className="mt-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-3 px-0.5">
        Similar Recipes
      </h2>

      {/* Horizontally scrollable rail — no page-level horizontal scroll */}
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-0.5 px-0.5 scrollbar-thin scrollbar-thumb-stone-200 dark:scrollbar-thumb-white/10">
        {similar.map((recipe: any) => {
          const hasImage = recipe.imageUrl && recipe.imageUrl !== 'none'
          const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0)

          return (
            <button
              key={recipe.id}
              onClick={() => onSelect(recipe)}
              className="
                flex-shrink-0 w-44 text-left
                rounded-xl border border-stone-200/60 dark:border-white/[0.06]
                bg-white/70 dark:bg-white/[0.03]
                hover:bg-white dark:hover:bg-white/[0.06]
                hover:border-stone-300/80 dark:hover:border-white/[0.12]
                hover:-translate-y-0.5
                transition-all duration-200 shadow-sm hover:shadow-md
                overflow-hidden group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500
              "
            >
              {/* Thumbnail */}
              <div className="relative h-24 bg-stone-100 dark:bg-white/[0.04]">
                {hasImage ? (
                  <img
                    src={recipe.imageUrl}
                    alt={recipe.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ChefHat className="h-7 w-7 text-stone-300 dark:text-stone-600" />
                  </div>
                )}

                {/* Similarity badge — shown on hover only */}
                {recipe.similarityScore !== undefined && (
                  <span className="
                    absolute top-1.5 right-1.5
                    opacity-0 group-hover:opacity-100
                    transition-opacity duration-150
                    bg-black/60 backdrop-blur-sm
                    text-white text-[10px] font-medium
                    px-1.5 py-0.5 rounded-md
                  ">
                    {Math.round(recipe.similarityScore * 100)}% match
                  </span>
                )}
              </div>

              {/* Card body */}
              <div className="p-2.5">
                <p className="text-xs font-semibold text-stone-800 dark:text-stone-100 line-clamp-2 leading-tight mb-1.5">
                  {recipe.title}
                </p>

                <div className="flex items-center gap-2 flex-wrap">
                  {totalTime > 0 && (
                    <span className="flex items-center gap-0.5 text-[10px] text-stone-500 dark:text-stone-400">
                      <Clock className="h-2.5 w-2.5" />
                      {totalTime}m
                    </span>
                  )}
                  {recipe.difficulty && difficultyLabel[recipe.difficulty] && (
                    <span className={`text-[10px] font-medium ${difficultyColor[recipe.difficulty] || 'text-stone-500'}`}>
                      {difficultyLabel[recipe.difficulty]}
                    </span>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
