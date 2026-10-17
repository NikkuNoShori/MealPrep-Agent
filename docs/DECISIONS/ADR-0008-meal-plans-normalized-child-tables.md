# ADR-0008: `meal_plans` Normalized into Child Tables

**Status:** accepted
**Created:** 2026-10-16
**Author:** Nick Neal
**Last reviewed:** 2026-10-16
**Related MOP:** MOP-0011 (verifying — implementation complete, one acceptance criterion pending live DB access)

## Context

[ADR-0001](ADR-0001-meal-plans-jsonb-shape.md) accepted `meal_plans.meals`/`grocery_list` as JSONB columns, conditional on a defined set of trigger conditions (MOP-0011 §Trigger Conditions). That ADR's own §Trigger for revisit states the decision should be re-affirmed or reviewed once a trigger fires.

On 2026-09-27, the trigger fired: MOP-0008 (chat tool-use migration) hit JSONB read-modify-write friction in `chat-api/tools/handlers.ts`'s meal-plan and grocery-list tool handlers, and `get_dashboard_stats()` (MOP-0030) required `jsonb_each`/`jsonb_array_elements` gymnastics to compute `this_week`, `grocery_progress`, and `most_cooked_this_month`. Both are explicitly named in ADR-0001's trigger list ("MOP-0008 tool friction," "Analytics requirement crossing JSONB query cost threshold").

MOP-0011 executed the normalization per its documented plan: a dual-write phase, a backfill, a read-path cutover, then dropping the JSONB columns.

## Decision

**Normalize `meal_plans.meals`/`grocery_list` into two child tables**, reversing ADR-0001's decision:

1. `meal_plan_entries` (migration `20261001000000_044_meal_plan_child_tables.sql`) — one row per planned meal assignment. Real FK to `recipes(id) ON DELETE SET NULL` (eliminates ADR-0001's "dangling reference" risk). Per-row RLS via a `SECURITY DEFINER` helper (`is_meal_plan_owner()`), not document-level last-write-wins.
2. `grocery_list_items` (same migration) — one row per grocery item, column shape matching the frontend `GroceryItem` type exactly.
3. `get_dashboard_stats()` rewritten (migration `20261002000000_045_get_dashboard_stats_child_tables.sql`) to JOIN the child tables directly instead of JSONB unnest.
4. `meal_plans.meals`/`grocery_list` JSONB columns dropped (migration `20261003000000_046_drop_meal_plan_jsonb_columns.sql`) after a dual-write + backfill phase confirmed both write paths stayed in sync.
5. Read paths (`src/services/api.ts`'s `getMealPlan`/`getMealPlans`) reconstruct the pre-migration `MealPlanMeals`/`GroceryList` shapes from the child tables in an assembly pattern, so UI consumers (`MealPlanner`, `GroceryCart`, `MealPlanHistory`, `ingredientAggregator`) needed zero changes — the storage model changed, the application-facing shape did not.

## Consequences

### Positive

- `recipe_id` is a real FK now — no more dangling references from a deleted recipe silently surviving inside JSONB (ADR-0001 Negative #2, resolved).
- Per-row RLS via `is_meal_plan_owner()` replaces document-level last-write-wins — two household members editing different meal slots/grocery items in the same plan no longer clobber each other's writes (ADR-0001 Negative #1, resolved).
- `get_dashboard_stats()`'s `most_cooked_this_month` and `grocery_progress` sections are now plain JOINs/GROUP BYs instead of `jsonb_each`/`jsonb_array_elements` gymnastics (ADR-0001 Negative #3, resolved) — the cost-growth concern that motivated the original "analytics requirement" trigger condition.
- `chat-api` tool handlers (`assign_recipe_to_meal_plan_slot`, `add_to_grocery_list`, etc.) now operate on row-shaped data directly, removing the read-modify-write race-condition risk ADR-0001 flagged as a trigger condition.

### Negative

- Two additional tables, two additional RLS policy sets, two additional `updated_at` triggers to maintain going forward — more schema surface than a single JSONB column.
- The assembly pattern in `api.ts` (`_assembleMealPlanShape`) is an extra layer between storage and the application-facing shape — a developer reading `getMealPlan` needs to understand both the child-table schema and the reconstruction logic, where previously the JSONB column was the shape.
- Migration risk was real and one-directional once migration 046 dropped the JSONB columns (no rollback without restoring from backup) — mitigated by the dual-write + backfill phase that preceded the drop, per MOP-0011's own phased design.

## Alternatives considered

Same three alternatives ADR-0001 evaluated when first rejecting proactive normalization — revisited here now that the trigger fired:

1. **Stay on JSONB, accept the growing cost.** Rejected — two of ADR-0001's five trigger conditions had now measurably fired (not hypothetically), which was exactly the signal ADR-0001 said should prompt normalization.
2. **Partial normalization** (grocery list only, keep `meals` JSONB). Rejected for the same reason ADR-0001 rejected it originally — two mental models for closely-related data.
3. **Read-side view layer** instead of normalizing storage. Rejected — doesn't solve the write-side problems (concurrent edits, FK integrity) that motivated the trigger in the first place; would have only addressed the analytics-query-cost trigger condition, not the other three.

## Related

- **ADR:** [ADR-0001](ADR-0001-meal-plans-jsonb-shape.md) — superseded by this ADR
- **MOP:** [MOP-0011](../MOPs/MOP-0011.md) — implementation plan, phases, and verification block
- **Files impacted:** `supabase/migrations/20261001000000_044_meal_plan_child_tables.sql`, `20261002000000_045_get_dashboard_stats_child_tables.sql`, `20261003000000_046_drop_meal_plan_jsonb_columns.sql`; `src/services/api.ts` (meal-plan methods, `_assembleMealPlanShape`); `supabase/functions/chat-api/tools/handlers.ts`; `docs/DATA_MODEL.md` (`meal_plan_entries`/`grocery_list_items` sections)
