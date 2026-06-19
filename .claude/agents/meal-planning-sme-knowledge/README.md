# Meal Planning SME Knowledge Base

Navigation for `meal-planning-sme`. Read before answering non-trivial questions.

## Canonical docs

| Doc | Purpose |
|-----|---------|
| [MOP-0004](../../docs/MOPs/MOP-0004.md) | Feature scope + acceptance criteria |
| [DATA_MODEL.md](../../docs/DATA_MODEL.md) | `meal_plans` table + JSONB shapes |
| [DOMAIN_TEST_MATRIX.md](../../docs/prompts/DOMAIN_TEST_MATRIX.md) | Integrity test routing |

## Key code paths

| Surface | Files |
|---------|-------|
| Planner page | `src/pages/MealPlanner.tsx` |
| Grocery + shopping | `src/components/meal-planning/GroceryCart.tsx`, `ShoppingMode.tsx` |
| History | `src/components/meal-planning/MealPlanHistory.tsx` |
| Recipe pick flow | `src/components/grocery/RecipeSelectorModal.tsx`, `ServingsModal.tsx`, `DayAssignmentModal.tsx` |
| Aggregation | `src/utils/ingredientAggregator.ts` |
| Types | `src/types/mealPlan.ts` |
| API | `src/services/api.ts` — `getMealPlans`, `createMealPlan`, `updateMealPlan`, `copyMealPlan` |

## Common failure modes

1. **Empty grocery after generate** — recipe IDs in `meals` JSONB don't match `recipeMap` (recipe not in user's loaded list, or `recipeId` empty for manual snack rows).
2. **Wrong quantities** — serving scale: `(entry.servings / recipe.servings)` in aggregator; verify both values.
3. **Duplicate units not merging** — different normalized units stay separate (by design); check `groceryKey(name, unit)`.
4. **Manual items lost on regenerate** — only `isManual` items should survive; check `handleGenerate` in GroceryCart.
5. **Plan not showing for week** — `weekPlan` filter: `startDate <= weekEnd && endDate >= weekStart`, status not `archived`.

## Tests

- `src/utils/__tests__/ingredientAggregator.test.ts`
- `api.test.ts` meal-plan describes
