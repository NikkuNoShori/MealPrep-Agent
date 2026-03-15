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

// meals JSONB: keyed by ISO date, then by meal slot
export interface MealPlanMeals {
  [date: string]: {
    breakfast?: PlannedMealEntry[];
    lunch?: PlannedMealEntry[];
    dinner?: PlannedMealEntry[];
    snacks?: PlannedMealEntry[];
  };
}

export interface GroceryItem {
  id: string;
  name: string;
  amount: number | null;
  unit: string;
  category: string;
  sourceRecipes: string[];
  isManual: boolean;
  isChecked: boolean;
  isRemoved: boolean;
  notes?: string;
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
