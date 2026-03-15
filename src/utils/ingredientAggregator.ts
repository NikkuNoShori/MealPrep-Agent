// ── Ingredient Aggregation Utility (MOP-0004 P1) ──
// Takes meal plan meals + recipe data, aggregates ingredients into a grocery list.

import type { GroceryItem, MealPlanMeals, PlannedMealEntry } from '@/types/mealPlan';

interface RecipeIngredient {
  name: string;
  amount: number | string | null;
  unit: string;
  category?: string;
  notes?: string;
}

interface RecipeData {
  id: string;
  title: string;
  servings: number;
  ingredients: RecipeIngredient[];
}

// ── Unit Normalization ──

const UNIT_ALIASES: Record<string, string> = {
  tablespoon: 'tbsp', tablespoons: 'tbsp', tbs: 'tbsp', tbsps: 'tbsp',
  teaspoon: 'tsp', teaspoons: 'tsp', tsps: 'tsp',
  cup: 'cup', cups: 'cup',
  ounce: 'oz', ounces: 'oz',
  pound: 'lb', pounds: 'lb', lbs: 'lb',
  gram: 'g', grams: 'g',
  kilogram: 'kg', kilograms: 'kg',
  milliliter: 'ml', milliliters: 'ml',
  liter: 'l', liters: 'l', litre: 'l', litres: 'l',
  clove: 'clove', cloves: 'clove',
  piece: 'piece', pieces: 'piece', pcs: 'piece',
  slice: 'slice', slices: 'slice',
  can: 'can', cans: 'can',
  bunch: 'bunch', bunches: 'bunch',
  sprig: 'sprig', sprigs: 'sprig',
  pinch: 'pinch', pinches: 'pinch',
  dash: 'dash', dashes: 'dash',
  whole: 'whole',
  large: 'large',
  medium: 'medium',
  small: 'small',
};

function normalizeUnit(unit: string): string {
  const lower = unit.trim().toLowerCase();
  return UNIT_ALIASES[lower] || lower;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function parseAmount(amount: number | string | null | undefined): number | null {
  if (amount === null || amount === undefined) return null;
  if (typeof amount === 'number') return amount;
  // Handle fraction strings like "1/2", "1 1/2"
  const str = amount.toString().trim();
  if (!str) return null;
  // Simple fraction: "1/2"
  const fractionMatch = str.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fractionMatch) return parseInt(fractionMatch[1]) / parseInt(fractionMatch[2]);
  // Mixed number: "1 1/2"
  const mixedMatch = str.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixedMatch) return parseInt(mixedMatch[1]) + parseInt(mixedMatch[2]) / parseInt(mixedMatch[3]);
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

// ── Grocery Key ──
// Ingredients are grouped by normalized (name + unit) pair

function groceryKey(name: string, unit: string): string {
  return `${normalizeName(name)}|${normalizeUnit(unit)}`;
}

// ── Main Aggregation ──

export function aggregateIngredients(
  meals: MealPlanMeals,
  recipeMap: Map<string, RecipeData>,
): GroceryItem[] {
  const grouped = new Map<string, {
    name: string;
    amount: number | null;
    unit: string;
    category: string;
    sourceRecipes: Set<string>;
    notes: string[];
  }>();

  // Collect all PlannedMealEntry items from daily slots and plan-level lists
  const allEntries: PlannedMealEntry[] = [];
  for (const [key, dayMeals] of Object.entries(meals)) {
    if (!dayMeals || typeof dayMeals !== 'object') continue;
    if (key.startsWith('_')) {
      // Plan-level list (e.g. _snacks, _non_recipe) — direct array of entries
      if (Array.isArray(dayMeals)) {
        allEntries.push(...(dayMeals as PlannedMealEntry[]));
      }
    } else {
      // Daily slots — object with slot arrays
      for (const slotMeals of Object.values(dayMeals)) {
        if (Array.isArray(slotMeals)) {
          allEntries.push(...(slotMeals as PlannedMealEntry[]));
        }
      }
    }
  }

  for (const entry of allEntries) {
    const recipe = recipeMap.get(entry.recipeId);
    if (!recipe?.ingredients) continue;

    const scale = (entry.servings || recipe.servings) / (recipe.servings || 4);

    for (const ing of recipe.ingredients) {
      const ingKey = groceryKey(ing.name, ing.unit || '');
      const parsedAmount = parseAmount(ing.amount);
      const scaledAmount = parsedAmount !== null ? parsedAmount * scale : null;
      const normalizedUnit = normalizeUnit(ing.unit || '');

      const existing = grouped.get(ingKey);
      if (existing) {
        if (scaledAmount !== null) {
          existing.amount = (existing.amount || 0) + scaledAmount;
        }
        existing.sourceRecipes.add(recipe.title);
        if (ing.notes) existing.notes.push(ing.notes);
      } else {
        grouped.set(ingKey, {
          name: ing.name,
          amount: scaledAmount,
          unit: normalizedUnit,
          category: ing.category || 'other',
          sourceRecipes: new Set([recipe.title]),
          notes: ing.notes ? [ing.notes] : [],
        });
      }
    }
  }

  // Convert to GroceryItem[]
  const items: GroceryItem[] = [];
  for (const [, val] of grouped) {
    items.push({
      id: crypto.randomUUID(),
      name: val.name,
      amount: val.amount !== null ? Math.round(val.amount * 100) / 100 : null,
      unit: val.unit,
      category: val.category,
      sourceRecipes: Array.from(val.sourceRecipes),
      isManual: false,
      isChecked: false,
      isRemoved: false,
      notes: val.notes.length > 0 ? val.notes.join('; ') : undefined,
    });
  }

  // Sort by category, then name
  items.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.name.localeCompare(b.name);
  });

  return items;
}

// ── Category Display ──

export const CATEGORY_LABELS: Record<string, string> = {
  produce: 'Produce',
  protein: 'Protein & Meat',
  meat: 'Protein & Meat',
  dairy: 'Dairy',
  pantry: 'Pantry',
  grains: 'Grains & Bread',
  condiments: 'Condiments & Sauces',
  spices: 'Spices & Seasonings',
  frozen: 'Frozen',
  beverages: 'Beverages',
  other: 'Other',
};

export const CATEGORY_ORDER = [
  'produce', 'protein', 'meat', 'dairy', 'grains', 'pantry', 'condiments', 'spices', 'frozen', 'beverages', 'other',
];

export function groupByCategory(items: GroceryItem[]): Map<string, GroceryItem[]> {
  const groups = new Map<string, GroceryItem[]>();
  for (const item of items) {
    if (item.isRemoved) continue;
    const cat = item.category || 'other';
    const existing = groups.get(cat) || [];
    existing.push(item);
    groups.set(cat, existing);
  }
  // Sort groups by predefined order
  const sorted = new Map<string, GroceryItem[]>();
  for (const cat of CATEGORY_ORDER) {
    if (groups.has(cat)) sorted.set(cat, groups.get(cat)!);
  }
  // Add any remaining categories not in the predefined order
  for (const [cat, items] of groups) {
    if (!sorted.has(cat)) sorted.set(cat, items);
  }
  return sorted;
}
