// ── Dashboard Types (MOP-0030) ──
// Matches the get_dashboard_stats() RPC's JSON payload after
// snakeToCamel() mapping in src/services/api.ts.

import type { DayMealSlots } from './mealPlan'

export interface DashboardRecipeCounts {
  ownCount: number
  householdCount: number
  publicVisibleCount: number
}

export interface DashboardThisWeek {
  planId: string | null
  /** Today's slot entries (breakfast/lunch/dinner/snacks), or null if the
   *  caller has no meal plan at all. */
  todayMeals: DayMealSlots | null
}

export interface DashboardGroceryCategory {
  category: string
  checked: number
  total: number
}

export interface DashboardGroceryProgress {
  planId: string | null
  checked: number
  total: number
  categories: DashboardGroceryCategory[]
}

export interface DashboardMostCookedEntry {
  recipeId: string
  title: string
  count: number
}

export interface DashboardTopCuisine {
  cuisine: string
  count: number
}

export interface DashboardStats {
  recipeCounts: DashboardRecipeCounts
  thisWeek: DashboardThisWeek
  activePlanCount: number
  groceryProgress: DashboardGroceryProgress
  reactionsGiven: number
  mostCookedThisMonth: DashboardMostCookedEntry[]
  topCuisines: DashboardTopCuisine[]
}
