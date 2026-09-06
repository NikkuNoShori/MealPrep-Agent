/**
 * MOP-0019 — Per-URL recipe card for the BatchImportPanel.
 *
 * extracting / error states render compact inline skeletons.
 * done / saved states delegate entirely to RecipeCard (preview mode),
 * which renders the identical list-view layout as the recipe library.
 */

import React, { useState } from "react";
import {
  AlertCircle,
  BookOpen,
  ListOrdered,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { RecipeCard } from "@/components/recipes/RecipeCard";

export interface BatchCardEntry {
  index: number;
  url: string;
  status: "extracting" | "done" | "error" | "saved";
  recipe?: any;
  error?: string;
}

interface BatchImportCardProps {
  entry: BatchCardEntry;
  onSave: (entry: BatchCardEntry) => Promise<void>;
  onRetry: (entry: BatchCardEntry) => void;
  isSaving: boolean;
}

/** Pull a clean human-readable message from a raw error string (may be JSON). */
function cleanError(raw: string | undefined): string {
  if (!raw) return "Unknown error";
  try {
    const json = raw.replace(/^HTTP \d+:\s*/, "");
    const parsed = JSON.parse(json);
    const firstMsg = parsed?.errors?.[0]?.message ?? parsed?.message ?? parsed?.error;
    if (firstMsg) return String(firstMsg);
  } catch { /* not JSON */ }
  return raw.replace(/^HTTP \d+:\s*/, "").slice(0, 200);
}

/**
 * Safely dig the recipe object out of whatever shape the pipeline returned.
 * The SSE result event may carry a PipelineResult ({ success, recipe }) or
 * a plain recipe object directly.
 */
function getRecipeObj(raw: any): any {
  if (!raw) return null;
  if (raw.success !== undefined && raw.recipe) return raw.recipe;
  if (raw.recipes && Array.isArray(raw.recipes) && raw.recipes.length > 0) return raw.recipes[0];
  return raw;
}

export function BatchImportCard({ entry, onSave, onRetry, isSaving }: BatchImportCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { url, status, error } = entry;

  const recipe = getRecipeObj(entry.recipe);

  const displayUrl = (() => {
    try { return new URL(url).hostname; } catch { return url.slice(0, 40); }
  })();

  // ── Extracting ──────────────────────────────────────────────────────────────
  if (status === "extracting") {
    return (
      <div data-testid={`batch-card-${entry.index}`}>
        <div className="flex items-stretch gap-4 p-3 rounded-2xl bg-white/60 dark:bg-white/[0.03] border border-stone-200/60 dark:border-white/[0.06] animate-pulse">
          {/* Image placeholder */}
          <div className="relative w-28 h-28 rounded-xl flex-shrink-0 bg-gradient-to-br from-gray-100 to-gray-200/80 dark:from-gray-800 dark:to-gray-700" />
          {/* Content skeleton */}
          <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
            <div>
              <div className="h-4 w-48 rounded bg-stone-200 dark:bg-white/10" />
              <div className="h-3 w-32 rounded bg-stone-100 dark:bg-white/[0.06] mt-2" />
              <div className="h-3 w-40 rounded bg-stone-100 dark:bg-white/[0.06] mt-1.5" />
            </div>
            <div className="flex gap-2 mt-auto">
              <div className="h-3 w-10 rounded bg-stone-100 dark:bg-white/[0.06]" />
              <div className="h-3 w-12 rounded bg-stone-100 dark:bg-white/[0.06]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────────
  if (status === "error") {
    return (
      <div data-testid={`batch-card-${entry.index}`}>
        <div className="flex items-stretch gap-4 p-3 rounded-2xl border border-destructive/40 bg-destructive/[0.06]">
          {/* Image placeholder — red tint */}
          <div className="relative w-28 h-28 rounded-xl flex-shrink-0 bg-gradient-to-br from-rose-100/60 to-rose-200/40 dark:from-rose-900/20 dark:to-rose-800/20 flex items-center justify-center">
            <AlertCircle className="h-8 w-8 text-destructive/60" />
          </div>
          <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
            <div>
              <h3 className="font-semibold text-[15px] text-destructive leading-snug truncate">
                {displayUrl}
              </h3>
              <p className="text-[13px] text-stone-500 dark:text-stone-400 line-clamp-2 mt-1 leading-relaxed">
                {cleanError(error)}
              </p>
            </div>
            <div className="mt-auto">
              <Button variant="ghost" size="sm" className="text-xs px-2 h-7" onClick={() => onRetry(entry)}>
                Retry
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Done + Saved — delegate to RecipeCard in preview mode ───────────────────
  const title: string = recipe?.title ?? displayUrl;
  const description: string | undefined = recipe?.description ?? undefined;
  const imageUrl: string | undefined = recipe?.image_url ?? recipe?.imageUrl ?? undefined;
  const ingredients: any[] = Array.isArray(recipe?.ingredients) ? recipe.ingredients : [];
  const instructions: string[] = Array.isArray(recipe?.instructions) ? recipe.instructions : [];
  const hasDetails = ingredients.length > 0 || instructions.length > 0;

  const prepTime: number = recipe?.prep_time ?? recipe?.prepTime ?? 0;
  const cookTime: number = recipe?.cook_time ?? recipe?.cookTime ?? 0;
  // Use total_time from recipe if present; otherwise sum prep + cook.
  const totalTime: number = (recipe?.total_time ?? recipe?.totalTime) || (prepTime + cookTime);
  const servings: number | undefined = recipe?.servings ?? undefined;
  const difficulty: "easy" | "medium" | "hard" | undefined =
    recipe?.difficulty === "easy" || recipe?.difficulty === "medium" || recipe?.difficulty === "hard"
      ? recipe.difficulty
      : undefined;
  const tags: string[] = Array.isArray(recipe?.tags) ? recipe.tags : [];
  const cuisine: string | undefined = recipe?.cuisine ?? undefined;

  const isSaved = status === "saved";

  // Map pipeline fields onto RecipeCard's recipe prop shape.
  // prepTime + cookTime are passed so RecipeCard can compute totalTime internally.
  // When total_time is available but prep/cook aren't, we split it evenly so the
  // chip still shows the right number (RecipeCard sums prepTime + cookTime).
  const mappedPrepTime = prepTime;
  let mappedCookTime = cookTime;
  if (totalTime > 0 && prepTime === 0 && cookTime === 0) {
    // total_time only — put it all in cookTime so the sum equals totalTime.
    mappedCookTime = totalTime;
  }

  const recipeForCard = {
    title,
    description,
    imageUrl,
    prepTime: mappedPrepTime || undefined,
    cookTime: mappedCookTime || undefined,
    servings,
    difficulty,
    cuisine,
    tags: tags.length > 0 ? tags : undefined,
  };

  return (
    <div data-testid={`batch-card-${entry.index}`}>
      <RecipeCard
        recipe={recipeForCard}
        viewMode="list"
        previewActions={{
          onSave: () => onSave(entry),
          isSaving,
          saved: isSaved,
          onExpand: hasDetails ? () => setExpanded((v) => !v) : undefined,
          expanded,
          hasDetails,
        }}
      />

      {/* Expandable ingredients + instructions — rendered below the card */}
      {expanded && hasDetails && (
        <div className="mt-0.5 rounded-xl border border-stone-200/60 dark:border-white/[0.06] overflow-hidden">
          <RecipeDetails ingredients={ingredients} instructions={instructions} />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RecipeDetails sub-component
// ─────────────────────────────────────────────────────────────────────────────

function RecipeDetails({
  ingredients,
  instructions,
}: {
  ingredients: any[];
  instructions: string[];
}) {
  return (
    <div className="px-3 pb-3 pt-2.5 space-y-3 bg-stone-50 dark:bg-white/[0.02]">
      {ingredients.length > 0 && (
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500 mb-1.5">
            <BookOpen className="h-3 w-3" />
            Ingredients
          </p>
          <ul className="space-y-0.5">
            {ingredients.map((ing, i) => {
              const name = typeof ing === "string" ? ing : (ing.name ?? ing.ingredient ?? "");
              const amount = ing.amount ?? ing.quantity ?? "";
              const unit = ing.unit ?? "";
              const label = [amount, unit].filter(Boolean).join(" ");
              return (
                <li key={i} className="text-[13px] flex gap-2 text-stone-700 dark:text-stone-300">
                  {label && (
                    <span className="shrink-0 text-stone-400 dark:text-stone-500 tabular-nums w-16 text-right">{label}</span>
                  )}
                  <span className="min-w-0">{name}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {instructions.length > 0 && (
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500 mb-1.5">
            <ListOrdered className="h-3 w-3" />
            Instructions
          </p>
          <ol className="space-y-1.5">
            {instructions.map((step, i) => (
              <li key={i} className="text-[13px] flex gap-2 text-stone-700 dark:text-stone-300">
                <span className="shrink-0 text-stone-400 dark:text-stone-500 tabular-nums font-medium w-4 text-right">{i + 1}.</span>
                <span className="min-w-0 leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
