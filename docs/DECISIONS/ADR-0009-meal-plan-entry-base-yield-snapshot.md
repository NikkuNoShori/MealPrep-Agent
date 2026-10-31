# ADR-0009: Meal Plan Entries Snapshot the Recipe's Base Yield at Plan Time

**Status:** accepted
**Created:** 2026-10-30
**Author:** Nick Neal
**Last reviewed:** 2026-10-30
**Related MOP:** MOP-0043

## Context

A meal plan entry stores an **absolute** servings count (`meal_plan_entries.servings`, `int`, nullable — migration `20261001000000_044_meal_plan_child_tables.sql:24`). The grocery cart turns that into a scale factor at read time:

```ts
// src/utils/ingredientAggregator.ts:157
const scale = (entry.servings || recipe.servings) / (recipe.servings || 4);
```

The divisor is the recipe's **current** `servings`, read live from the recipe list (`GroceryCart.tsx:58-70`). Nothing records what the recipe's yield was when the user planned it. `GroceryCart.tsx` also re-runs the aggregation automatically in a silent auto-sync (`computeMergedList`, lines 75-102) and saves the result if it differs. So edits to a recipe flow into every plan that uses it, with no notice to the user.

| Edit after planning | Today's effect on cart | User intent (likely) |
|---|---|---|
| Recipe yield 4 → 6, entry still says 4 | scale goes 1.0 → 0.67; cart under-shops by a third | "I still want enough for 4 people." The entry's quantity hasn't changed |
| Ingredient amount typo fixed (e.g. 20 cups → 2 cups) | cart corrects itself | Wanted. A correction should flow through |
| Ingredient added/removed | cart gains/loses the line | Usually wanted |

The two kinds of edit are different. Changing the **yield** changes the unit the entry's number is measured in, so the meaning of a stored value shifts without anyone touching it. Changing an **ingredient** changes the recipe's content, and the user normally wants that reflected.

Constraints:
- Schema changes are written as migration files only; the user deploys them (HARD RULE).
- `meal_plan_entries` is the subject of MOP-0011 (`verifying`, read-parity check still pending) and ADR-0008. A column added there must not disturb that parity check.

## Decision

1. **Snapshot the base yield, not the ingredients.** Add a nullable `base_servings int` to `meal_plan_entries`. It is written once, when the entry is created, from the recipe's `servings` at that moment.
2. **Scale against the snapshot.** `scale = entry.servings / (entry.baseServings ?? recipe.servings ?? 4)`. Old rows with no snapshot keep today's behavior (live divisor), so nothing changes retroactively for them.
3. **Ingredients stay live.** Corrections should propagate. We are not taking on per-entry ingredient snapshots (storage, staleness, a diverging copy for each plan).
4. **Null `servings` means "the recipe's base yield", not 1.** A missing value falls back to `base_servings`, then to `recipe.servings`. It is never coerced to `1` on read or write (see MOP-0043 Phase 1).
5. **Optional, later:** when the live `recipe.servings` differs from `base_servings`, show a small indicator on the entry ("recipe yield changed since planning"). This is UX polish and is not part of the core decision.

## Consequences

### Positive
- The number a user picked keeps its meaning. "4 servings" stays 4 servings' worth of food.
- Ingredient fixes still reach every plan automatically.
- Small schema change (one nullable column). Legacy rows are backward-compatible.

### Negative
- One more column to keep consistent across both write paths (`api.ts` add-entry around line 1037 and the bulk rewrite at lines 1135-1175). Missing either path quietly brings the bug back.
- Ingredient edits still change the cart silently. That is accepted on purpose, and the optional indicator only covers yield changes.
- Needs a migration the user deploys, plus regenerated `database.ts` types.

## Alternatives considered

| Option | Why rejected / deferred |
|---|---|
| **A. Store a multiplier instead of absolute servings** (`scale_factor`) | Fixes the yield drift with no live divisor. But the UI shows and edits "servings", not factors, and every reader would need to convert. A larger semantic change across `ServingsModal`, `MealPlanCalendar`, chat tools |
| **B. Snapshot the full ingredient list per entry** | Freezes typos and corrections, duplicates recipe data for every plan entry, and needs a staleness and refresh story. Too much for the problem |
| **C. Keep live behavior and warn when recipe yield is edited while it's in an active plan** | Moves the problem to edit time and doesn't fix existing plans. Could complement the decision, but doesn't replace it |
| **D. Do nothing** | Under-shopping happens silently. Rare (it needs a yield edit after planning) but invisible when it does happen |

## Trigger for revisit

- If users ask for "freeze my plan" semantics, meaning ingredient edits should NOT propagate, revisit option B.
- If chat-agent tools start editing recipe yields in bulk, which makes yield drift more common, promote the optional indicator (Decision 5) to required.

## Related

- **MOP:** MOP-0043 (implementation)
- **ADR:** ADR-0008 (meal_plans normalized child tables), ADR-0001 (original JSONB shape)
- **Files impacted:** `src/utils/ingredientAggregator.ts`, `src/services/api.ts`, `src/types/mealPlan.ts`, `src/pages/MealPlanner.tsx`, `src/components/meal-planning/GroceryCart.tsx`, new migration under `supabase/migrations/`
