/**
 * Meal Randomizer — MOP-0023
 *
 * selectRandomMeals() picks recipes from a pool and assigns them to empty
 * meal slots using a Fisher-Yates shuffle (crypto.getRandomValues).
 *
 * Safety guarantee: recipes tagged "ALLERGY WARNING" are ALWAYS excluded
 * regardless of other config settings.
 */

import type { MealSlot } from "@/types/mealPlan";

// ── Types ──────────────────────────────────────────────────────────────────────

export type RecipeVisibility = "private" | "household" | "public";

export interface RandomizerPoolRecipe {
  id: string;
  title: string;
  tags?: string[];
  visibility?: RecipeVisibility;
}

export interface SlotTarget {
  dateStr: string;
  slotKey: MealSlot;
}

export interface RandomizerOptions {
  /** Recipe visibilities to include. Default: all. */
  visibility?: RecipeVisibility[];
  /** If set, only recipes that have ALL of these tags are included. */
  tags?: string[];
  /**
   * Max times the same recipe may appear across all assigned slots.
   * Default: 1 (no repeats within the assigned batch).
   */
  maxRepeat?: number;
}

export interface RandomizerAssignment {
  dateStr: string;
  slotKey: MealSlot;
  recipe: RandomizerPoolRecipe;
}

// ── Fisher-Yates shuffle (crypto) ─────────────────────────────────────────────

function cryptoShuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    const j = buf[0] % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Select random recipes for the given slots.
 *
 * @param pool    All available recipes (already fetched).
 * @param slots   Slots to fill (only empty slots should be passed).
 * @param options Filtering + repeat config.
 * @returns       One assignment per slot (may be fewer if pool is empty).
 */
export function selectRandomMeals(
  pool: RandomizerPoolRecipe[],
  slots: SlotTarget[],
  options: RandomizerOptions = {}
): RandomizerAssignment[] {
  const { visibility, tags, maxRepeat = 1 } = options;

  // 1. Filter pool
  let filtered = pool.filter((r) => {
    // Safety: always exclude allergy-tagged recipes
    if (r.tags?.includes("ALLERGY WARNING")) return false;

    // Visibility filter
    if (visibility?.length && !visibility.includes(r.visibility ?? "private")) return false;

    // Tag filter: recipe must include ALL required tags
    if (tags?.length && !tags.every((t) => r.tags?.includes(t))) return false;

    return true;
  });

  if (!filtered.length || !slots.length) return [];

  // 2. Shuffle
  const shuffled = cryptoShuffle(filtered);

  // 3. Assign — track usage counts to respect maxRepeat
  const usageCount: Record<string, number> = {};
  const assignments: RandomizerAssignment[] = [];

  // Cycle through shuffled pool multiple times if needed, respecting maxRepeat
  const maxCycles = Math.ceil(slots.length / shuffled.length) + 1;
  const candidate = (idx: number) => shuffled[idx % shuffled.length];

  let poolIdx = 0;
  for (const slot of slots) {
    // Advance to find a recipe that hasn't hit maxRepeat
    let attempts = 0;
    while (attempts < shuffled.length * maxCycles) {
      const recipe = candidate(poolIdx);
      const count = usageCount[recipe.id] ?? 0;
      if (count < maxRepeat) {
        usageCount[recipe.id] = count + 1;
        assignments.push({ ...slot, recipe });
        poolIdx++;
        break;
      }
      poolIdx++;
      attempts++;
    }
  }

  return assignments;
}

/**
 * Build a PlannedMealEntry from a pool recipe (for inserting into weekPlan.meals).
 */
export function toPlanEntry(recipe: RandomizerPoolRecipe, servings = 4) {
  return {
    id: `rand-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    recipeId: recipe.id,
    recipeName: recipe.title,
    servings,
  };
}
