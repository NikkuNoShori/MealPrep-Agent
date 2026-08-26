// ── Meal Plan Types (MOP-0004) ──
// Matches the meal_plans table schema and JSONB structures

export type MealPlanStatus = 'draft' | 'active' | 'completed' | 'archived';
export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

export interface PlannedMealEntry {
  id: string;
  recipeId: string;
  recipeName: string;
  recipeImage?: string;
  servings: number;
  prepTime?: number;
  cookTime?: number;
  notes?: string;
}

// Daily slot structure for date-keyed entries
export interface DayMealSlots {
  breakfast?: PlannedMealEntry[];
  lunch?: PlannedMealEntry[];
  dinner?: PlannedMealEntry[];
  snacks?: PlannedMealEntry[];
}

// meals JSONB: ISO date keys → DayMealSlots, underscore keys → plan-level lists
export interface MealPlanMeals {
  [key: string]: DayMealSlots | PlannedMealEntry[];
}

export interface GroceryItem {
  id: string;
  name: string;
  /** The actionable/buyable quantity — for discrete items (piece, whole,
   * clove, ...) this is rounded UP from the exact recipe math so the
   * requirement is always covered. See rawAmount for the unrounded figure. */
  amount: number | null;
  unit: string;
  category: string;
  sourceRecipes: string[];
  isManual: boolean;
  isChecked: boolean;
  isRemoved: boolean;
  notes?: string;
  /** The exact, unrounded quantity the recipe math actually calls for —
   * only set when it differs from `amount` (i.e. only for discrete/
   * countable items that got rounded up). Weight/volume items and anything
   * that was already a whole number leave this undefined. Purely
   * informational — display only, never used in further calculations. */
  rawAmount?: number;
}

export interface GroceryList {
  items: GroceryItem[];
  lastGenerated: string;
}

export interface MealPlan {
  id: string;
  userId: string;
  title: string | null;
  startDate: string;
  endDate: string;
  meals: MealPlanMeals;
  groceryList: GroceryList | null;
  totalCost: number | null;
  status: MealPlanStatus;
  notes: string | null;
  createdBy: string | null;
  lastEditedBy: string | null;
  copiedFrom: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMealPlanInput {
  title?: string;
  startDate: string;
  endDate: string;
  meals?: MealPlanMeals;
  notes?: string;
  status?: MealPlanStatus;
}

export interface UpdateMealPlanInput {
  title?: string;
  startDate?: string;
  endDate?: string;
  meals?: MealPlanMeals;
  groceryList?: GroceryList;
  notes?: string;
  status?: MealPlanStatus;
}
