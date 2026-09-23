/**
 * Single source of truth for domain -> accent-color mappings (MOP-0029
 * Phase 5 / COLOR_SCHEMA.md §6 "Accent-category tokens").
 *
 * The audit behind ADR-0006 found the breakfast/lunch/dinner/snacks color
 * map copy-pasted verbatim across MealPlanner.tsx and DayAssignmentModal.tsx,
 * plus further one-off duplicated maps for dashboard stat icons, admin
 * status icons, and meal-plan status icons. COLOR_SCHEMA.md §6 rule 2:
 * "Domain -> accent mappings live in exactly one module... Duplicating a
 * color map is a defect." NORMATIVE NOW.
 *
 * Per MOP-0029 Phase 5's explicit instruction, this module exports the
 * existing Tailwind literal values as-is ("import the literals first,
 * tokenize later"). A future phase (Phase 4, deferred) will point these at
 * --accent-cat-* CSS custom properties once that token family is authored;
 * until then these are NOT accent-category CSS tokens, just deduplicated
 * literals.
 */

import {
  Coffee,
  Sun,
  Moon,
  Cookie,
  ShoppingCart,
  type LucideIcon,
} from 'lucide-react'
import type { MealSlot } from '@/types/mealPlan'

/* ------------------------------------------------------------------ */
/*  Meal slots (breakfast / lunch / dinner / snacks)                   */
/*  Previously duplicated verbatim in MealPlanner.tsx (DAILY_SLOTS +    */
/*  inline snacks entry) and DayAssignmentModal.tsx (SLOT_CONFIG).      */
/* ------------------------------------------------------------------ */

export interface MealSlotAccent {
  key: MealSlot
  label: string
  icon: LucideIcon
  /** Text color, e.g. icon tint. */
  color: string
  /** Subtle tinted background (10% alpha), for chips/badges. */
  bg: string
  /** Solid background, for the active/selected state. */
  activeBg: string
  /** Gradient stop pair, for slot-header decorative fills. */
  gradientFrom: string
  gradientTo: string
}

export const MEAL_SLOT_ACCENTS: Record<MealSlot, MealSlotAccent> = {
  breakfast: {
    key: 'breakfast',
    label: 'Breakfast',
    icon: Coffee,
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
    activeBg: 'bg-amber-500',
    gradientFrom: 'from-amber-500/10',
    gradientTo: 'to-amber-500/5',
  },
  lunch: {
    key: 'lunch',
    label: 'Lunch',
    icon: Sun,
    color: 'text-orange-500',
    bg: 'bg-orange-500/10',
    activeBg: 'bg-orange-500',
    gradientFrom: 'from-orange-500/10',
    gradientTo: 'to-orange-500/5',
  },
  dinner: {
    key: 'dinner',
    label: 'Dinner',
    icon: Moon,
    color: 'text-indigo-500',
    bg: 'bg-indigo-500/10',
    activeBg: 'bg-indigo-500',
    gradientFrom: 'from-indigo-500/10',
    gradientTo: 'to-indigo-500/5',
  },
  snacks: {
    key: 'snacks',
    label: 'Snacks',
    icon: Cookie,
    color: 'text-pink-500',
    bg: 'bg-pink-500/10',
    activeBg: 'bg-pink-500',
    gradientFrom: 'from-pink-500/10',
    gradientTo: 'to-pink-500/5',
  },
}

/** Ordered list of the three per-day slots (excludes plan-level snacks). */
export const DAILY_MEAL_SLOTS: MealSlotAccent[] = [
  MEAL_SLOT_ACCENTS.breakfast,
  MEAL_SLOT_ACCENTS.lunch,
  MEAL_SLOT_ACCENTS.dinner,
]

/** Ordered list of all four slots, including plan-level snacks. */
export const ALL_MEAL_SLOTS: MealSlotAccent[] = [
  MEAL_SLOT_ACCENTS.breakfast,
  MEAL_SLOT_ACCENTS.lunch,
  MEAL_SLOT_ACCENTS.dinner,
  MEAL_SLOT_ACCENTS.snacks,
]

/**
 * Plan-level lists shown below the weekly calendar (MealPlanner.tsx).
 * `_snacks` reuses the snacks meal-slot accent; `_non_recipe` is its own
 * domain (not a meal slot).
 */
export const PLAN_LEVEL_LIST_ACCENTS = [
  {
    key: '_snacks',
    label: 'Snacks',
    icon: MEAL_SLOT_ACCENTS.snacks.icon,
    color: MEAL_SLOT_ACCENTS.snacks.color,
    description: 'Weekly snacks — not tied to a specific day',
  },
  {
    key: '_non_recipe',
    label: 'Non-Recipe Items',
    icon: ShoppingCart,
    color: 'text-teal-500',
    description: 'Extras like paper towels, foil, etc.',
  },
] as const

/* ------------------------------------------------------------------ */
/*  Meal-plan status (draft / active / completed / archived)            */
/*  Previously defined only in MealPlanHistory.tsx.                     */
/* ------------------------------------------------------------------ */

export type MealPlanStatusKey = 'draft' | 'active' | 'completed' | 'archived'

export interface MealPlanStatusAccent {
  label: string
  color: string
  bg: string
}

export const MEAL_PLAN_STATUS_ACCENTS: Record<MealPlanStatusKey, MealPlanStatusAccent> = {
  draft: {
    label: 'Draft',
    color: 'text-stone-500 dark:text-stone-400',
    bg: 'bg-stone-100 dark:bg-white/[0.04]',
  },
  active: {
    label: 'Active',
    color: 'text-primary-600 dark:text-primary-400',
    bg: 'bg-primary-50 dark:bg-primary-500/10',
  },
  completed: {
    label: 'Done',
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
  },
  archived: {
    label: 'Archived',
    color: 'text-stone-400 dark:text-stone-500',
    bg: 'bg-stone-100 dark:bg-stone-800/60',
  },
}

/* ------------------------------------------------------------------ */
/*  Household invite status (pending / accepted / declined / expired)   */
/*  Previously defined only in Admin.tsx.                               */
/* ------------------------------------------------------------------ */

export type InviteStatusKey = 'pending' | 'accepted' | 'declined' | 'expired'

export interface InviteStatusAccent {
  color: string
  badgeBg: string
}

export const INVITE_STATUS_ACCENTS: Record<InviteStatusKey, InviteStatusAccent> = {
  pending: {
    color: 'text-amber-500',
    badgeBg: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
  accepted: {
    color: 'text-primary-500',
    badgeBg: 'bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400',
  },
  declined: {
    color: 'text-red-500',
    badgeBg: 'bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-gray-400',
  },
  expired: {
    color: 'text-gray-400',
    badgeBg: 'bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-gray-400',
  },
}

/* ------------------------------------------------------------------ */
/*  Dashboard stat tiles (recipes / this-week / family / grocery)       */
/*  Previously defined only in Dashboard.tsx.                           */
/* ------------------------------------------------------------------ */

export const DASHBOARD_STAT_ACCENTS = {
  recipes: 'text-primary-600 dark:text-primary-400',
  thisWeek: 'text-amber-600 dark:text-amber-400',
  family: 'text-rose-500 dark:text-rose-400',
  grocery: 'text-teal-600 dark:text-teal-400',
} as const
