// ── Ingredient Aggregation Utility (MOP-0004 P1) ──
// Takes meal plan meals + recipe data, aggregates ingredients into a grocery list.

import type { GroceryItem, MealPlanMeals, PlannedMealEntry } from '@/types/mealPlan';
import { convertValuePrecise, optimizeUnit, type Unit } from './unitConverter';

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

// ── Cross-Unit Merging (weight & volume only) ──
//
// "200g flour" and "1 cup flour" cannot be safely merged — grams are mass,
// cups are volume, and converting between them requires an ingredient's
// density, which this app doesn't have. But "200g" and "0.5lb" of the same
// ingredient ARE the same physical quantity and should merge into one line.
// So: ingredients merge across units within the same category (weight, or
// volume) by converting to a common base unit via unitConverter.ts; units
// outside those categories (countable items — piece, clove, pinch, etc.)
// keep the previous exact-unit grouping, unchanged.

const WEIGHT_UNITS = new Set(['g', 'kg', 'oz', 'lb']);
const VOLUME_UNITS = new Set(['ml', 'l', 'cup', 'tbsp', 'tsp']);

type UnitCategory = 'weight' | 'volume' | 'other';

function unitCategory(normalizedUnit: string): UnitCategory {
  if (WEIGHT_UNITS.has(normalizedUnit)) return 'weight';
  if (VOLUME_UNITS.has(normalizedUnit)) return 'volume';
  return 'other';
}

// Converts an already-normalized weight/volume unit's amount into the
// category's canonical base unit (grams for weight, milliliters for
// volume) so quantities in different units can be summed. Cross-system
// conversions (oz/lb <-> g/kg, cup/tbsp/tsp <-> ml) go through
// unitConverter.ts's real conversion factors; the remaining kg->g and
// l->ml steps are exact metric-prefix scaling, not new conversion logic.
function toCanonicalAmount(
  amount: number,
  normalizedUnit: string,
  category: UnitCategory,
): { amount: number; unit: 'g' | 'ml' } {
  if (category === 'weight') {
    if (normalizedUnit === 'g') return { amount, unit: 'g' };
    if (normalizedUnit === 'kg') return { amount: amount * 1000, unit: 'g' };
    // oz/lb are valid Unit members of WEIGHT_UNITS, narrowed by unitCategory().
    const { value, unit } = convertValuePrecise(amount, normalizedUnit as Unit, 'metric');
    return unit === 'kg' ? { amount: value * 1000, unit: 'g' } : { amount: value, unit: 'g' };
  }
  if (category === 'volume') {
    if (normalizedUnit === 'ml') return { amount, unit: 'ml' };
    if (normalizedUnit === 'l') return { amount: amount * 1000, unit: 'ml' };
    const { value } = convertValuePrecise(amount, normalizedUnit as Unit, 'metric');
    return { amount: value, unit: 'ml' };
  }
  return { amount, unit: normalizedUnit as 'g' | 'ml' };
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
  const normalizedUnit = normalizeUnit(unit);
  const category = unitCategory(normalizedUnit);
  // Weight and volume ingredients group by category (merging across units,
  // e.g. g + lb); everything else groups by its exact unit as before.
  const keyPart = category === 'other' ? normalizedUnit : category;
  return `${normalizeName(name)}|${keyPart}`;
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
      const unitCat = unitCategory(normalizedUnit);

      const existing = grouped.get(ingKey);
      if (existing) {
        if (scaledAmount !== null) {
          if (unitCat !== 'other' && existing.unit !== normalizedUnit) {
            // Units genuinely differ within the same category (e.g. an
            // earlier recipe used "g", this one uses "lb") — convert both
            // sides to the canonical base unit (g/ml) to merge correctly.
            // existing.amount may already be canonical from a prior merge;
            // g/ml are themselves the canonical units, so re-canonicalizing
            // them is a no-op via toCanonicalAmount's early-return branches.
            const existingCanonical = toCanonicalAmount(existing.amount || 0, existing.unit, unitCat);
            const incomingCanonical = toCanonicalAmount(scaledAmount, normalizedUnit, unitCat);
            existing.amount = existingCanonical.amount + incomingCanonical.amount;
            existing.unit = incomingCanonical.unit;
          } else {
            // Same unit already — add directly, no conversion, no rounding
            // loss, and the original unit (e.g. "tbsp") is preserved exactly.
            existing.amount = (existing.amount || 0) + scaledAmount;
          }
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
    // Merged weight/volume totals are summed in the canonical base unit
    // (g/ml) — pick a nicer display unit now that the total is final (e.g.
    // 1500g displays as 1.5kg), matching how a shopper would actually list it.
    let displayAmount = val.amount;
    let displayUnit = val.unit;
    if (displayAmount !== null && (val.unit === 'g' || val.unit === 'ml')) {
      const optimized = optimizeUnit(displayAmount, val.unit);
      displayAmount = optimized.value;
      displayUnit = optimized.unit;
    }

    // Round the FINAL summed-across-recipes total, once — never per-recipe
    // before summing, or partial fractions would each round independently
    // (0.3 + 0.3 + 0.3 would become 1+1+1=3 instead of ceil(0.9)=1).
    let finalAmount: number | null = null;
    let rawAmount: number | undefined;
    if (displayAmount !== null) {
      if (unitCategory(displayUnit) === 'other') {
        // Discrete/countable ingredients (piece, whole, clove, egg, unitless
        // produce, ...) can't be bought fractionally: round UP so the plan's
        // requirement is always met — needing 1.5 apples means buying a
        // full 2nd one, since 1.0 wouldn't cover the recipe. A tiny epsilon
        // guards against float-sum noise (e.g. 1.9999999999998) rounding up
        // to one more than actually needed.
        const EPSILON = 1e-9;
        finalAmount = displayAmount <= 0 ? 0 : Math.ceil(displayAmount - EPSILON);
        const roundedRaw = Math.round(displayAmount * 100) / 100;
        // Only surface the exact figure when rounding actually changed
        // something — an item that was already a whole number has nothing
        // extra to show.
        if (roundedRaw !== finalAmount) rawAmount = roundedRaw;
      } else {
        // Weight/volume: fractional amounts are completely normal to buy
        // (1.5 lb, 0.5 cup) — keep the existing 2-decimal display rounding.
        finalAmount = Math.round(displayAmount * 100) / 100;
      }
    }

    items.push({
      id: crypto.randomUUID(),
      name: val.name,
      amount: finalAmount,
      unit: displayUnit,
      category: val.category,
      sourceRecipes: Array.from(val.sourceRecipes),
      isManual: false,
      isChecked: false,
      isRemoved: false,
      notes: val.notes.length > 0 ? val.notes.join('; ') : undefined,
      ...(rawAmount !== undefined ? { rawAmount } : {}),
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
