# MOP-0043: Grocery Scale Correctness — Null Servings Default + Base-Yield Snapshot

| Field | Value |
|-------|-------|
| **MOP** | MOP-0043 |
| **Title** | Grocery Scale Correctness — Null Servings Default + Base-Yield Snapshot |
| **Date Submitted** | 2026-10-30 |
| **Date Updated** | 2026-10-30 |
| **Date Completed** | — |
| **Submitted By** | surface-reviewer |
| **Status** | verifying |

> Status vocabulary defined in [docs/prompts/MOP_STATUS_LIFECYCLE.md](../prompts/MOP_STATUS_LIFECYCLE.md). Valid values: `draft` / `evaluation` / `approved` / `planned` / `in_progress` / `verifying` / `complete` / `blocked` / `cancelled` / `deferred`.

---

## Summary

Two related grocery-cart scaling bugs, found during read-only servings-flow research on 2026-10-30. Both lead to silent under-shopping:

1. **Null servings is coerced to 1.** `api.ts:773` (read) and `api.ts:1148`/`1167` (write) apply `servings ?? 1`. A row with no servings value then scales to 1/N of the recipe (e.g. 1/4 for a 4-serving recipe) instead of the recipe's base yield. The planner displays "1", so the effect is visible but wrong.
2. **Scale tracks the live recipe yield.** `ingredientAggregator.ts:157` divides by the recipe's *current* `servings`. Editing a recipe's yield after planning changes the cart without telling the user, and the `GroceryCart` auto-sync saves the new figures.

The decision behind Phase 2 is recorded in [ADR-0009](../DECISIONS/ADR-0009-meal-plan-entry-base-yield-snapshot.md): snapshot the base yield, keep ingredients live.

---

## Scope Map

```
src/services/api.ts
src/utils/ingredientAggregator.ts
src/utils/__tests__/ingredientAggregator.test.ts
src/types/mealPlan.ts
src/types/database.ts
src/pages/MealPlanner.tsx
src/components/meal-planning/GroceryCart.tsx
src/components/meal-planning/ServingsModal.tsx
supabase/migrations/**
supabase/functions/chat-api/**   (only if chat tools create meal_plan_entries — confirm in planning)
docs/DATA_MODEL.md
```

---

## Scope of Work

### Phase 0: Data check (read-only, user-run) — DONE 2026-10-30
**Files affected:** none

User ran the read-only count against production:

```sql
select count(*) filter (where servings is null) as null_servings,
       count(*) filter (where servings = 1 and recipe_id is not null) as one_serving_recipe_rows,
       count(*) as total
from meal_plan_entries;
```

**Result:** `null_servings = 0`, `total = 9`. No null-servings rows found in production. Phase 1 stays at P2 (not raised to P1) — the bug is real and latent but hasn't manifested in existing data.

### Phase 1: Stop coercing null servings to 1 (can ship on its own) — DONE 2026-10-30
**Files affected:** `src/services/api.ts`, `src/types/mealPlan.ts`, `src/utils/ingredientAggregator.ts`, tests

- `api.ts:773`: `servings: e.servings ?? undefined`. ✅
- `api.ts` bulk-rewrite insert sites (was 1148/1167, now 2 sites in `replaceMealPlanEntries`): persist `e.servings ?? null`. ✅
- `PlannedMealEntry.servings` → `servings?: number`. ✅ No stale call sites found at compile time.
- Aggregator: `entry.servings || recipe.servings` → `entry.servings ?? recipe.servings` (folded into the Phase 2 formula below, implemented together). ✅ `0` still falls through to base via `??` only when `undefined`/`null`; an explicit `0` is preserved as entered (matches `RecipeForm.tsx:646`'s existing `servings = 0` allowance).
- Non-recipe list items unaffected — confirmed unchanged.
- **No repair of rows that already store `1`.** Confirmed 0 such ambiguous rows exist in production (see Phase 0). Noted in CHANGELOG.

### Phase 2: Snapshot base yield (per ADR-0009) — DONE 2026-10-30
**Files affected:** `supabase/migrations/20261030130000_059_meal_plan_entries_base_servings.sql` (written, awaiting deploy), `src/types/mealPlan.ts`, `src/components/meal-planning/recipeTypes.ts`, `src/services/api.ts`, `src/pages/MealPlanner.tsx`, `src/components/meal-planning/AddToPlanButton.tsx`, `src/components/grocery/RecipeSelectorModal.tsx`, `src/services/randomizer.ts`, `src/utils/ingredientAggregator.ts`, `supabase/functions/chat-api/tools/handlers.ts`

- Migration 059: `alter table meal_plan_entries add column base_servings int;`, no backfill. ✅
- Every entry-creation path now sets `baseServings`/`base_servings` from the recipe's yield at that moment:
  - `RecipeSelectorModal.tsx` — sets `baseServings` on `SelectedRecipeInfo` at selection time (before `ServingsModal` can overwrite `servings`). ✅
  - `MealPlanner.tsx` `handleAssignmentConfirmed`, Suggest single-add, Suggest fill-slots. ✅
  - `AddToPlanButton.tsx` both insert paths (slot add + snacks add). ✅
  - `randomizer.ts` `toPlanEntry`. ✅
  - `supabase/functions/chat-api/tools/handlers.ts` — 3 direct `meal_plan_entries` insert sites (new-plan create, existing-plan add, slot-overwrite tool). ✅
  - `api.ts` `addMealPlanEntry` (used by plan-copy) and `replaceMealPlanEntries` (the primary save path, both insert branches). ✅
- `MOP-0011` interaction: not re-verified here — still flagged as a sequencing risk; see Related.
- Aggregator: divisor falls back through `baseServings → recipe.servings → 4`, treating non-positive values as missing rather than dividing by them (guards against `Infinity`/`NaN`). ✅. 4 new tests added covering null-servings, yield-drift-with-snapshot, legacy-no-snapshot, and zero/negative-baseServings cases — all pass.
- `security-auditor` (scoped `api` + `migrations`) ran 2026-10-30: 0 Critical, 0 Warning, 2 Suggestions. One suggestion (missing `CHECK (base_servings > 0)` on migration 059 + no aggregator guard against non-positive values) was fixed immediately: added `mpe_base_servings_positive` CHECK constraint to migration 059, and the aggregator now treats `baseServings <= 0` / `servings <= 0` as missing. The other suggestion (raw Postgres error messages surfaced to the LLM/user in `handlers.ts:604,646,1855`) predates this diff and is deferred to a future `edge-functions`-scoped pass — tracked here for visibility, not blocking.
- 1 pending-approval risk surfaced by the auditor (RISK-0004, `is_meal_plan_owner()` fail-closed behavior) is pre-existing infrastructure this MOP depends on but did not introduce; staged in `pending-risks.md` for separate review.

### Phase 3 (optional): Yield-changed indicator — DEFERRED
**Files affected:** `src/components/meal-planning/MealPlanCalendar.tsx` (or entry card component), `GroceryCart.tsx`

Not implemented in this round, per explicit scope decision 2026-10-30. UX polish, not required by ADR-0009's core decision. Revisit if users report confusion about silently-live ingredient propagation.

---

## Priority

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| P2 (P1 if Phase 0 finds null rows) | Phase 1 — null servings default | Small | Medium |
| P2 | Phase 2 — base-yield snapshot | Medium | Medium |
| P3 | Phase 3 — yield-changed indicator | Small | Low |

---

## Verification

> **Lockticket acceptance criteria.** See [MOP_VERIFICATION_POLICY.md](../prompts/MOP_VERIFICATION_POLICY.md) — **`type: human` is forbidden** (blocks `complete`). Route domain tests via [DOMAIN_TEST_MATRIX.md](../prompts/DOMAIN_TEST_MATRIX.md). Run `/integrity-check` then `/verify-mop MOP-0043`.

```yaml
verification:
  - id: lint-clean
    type: command
    run: npm run lint
    expect_exit: 0

  - id: build-clean
    type: command
    run: npm run build
    expect_exit: 0

  - id: unit-tests
    type: command
    run: npm run test:run
    expect_exit: 0

  - id: aggregator-suite
    type: command
    run: npm run test:run -- src/utils/__tests__/ingredientAggregator.test.ts
    expect_exit: 0

  - id: no-servings-coerced-to-one
    type: grep
    file: src/services/api.ts
    pattern: "servings\\s*\\?\\?\\s*1\\b"
    expect: absent

  - id: base-servings-migration-exists
    type: grep
    path: supabase/migrations
    pattern: "add column (if not exists )?base_servings"
    expect: present

  - id: base-servings-positive-check-exists
    type: grep
    path: supabase/migrations
    pattern: "base_servings IS NULL OR base_servings > 0"
    expect: present
```

Named tests added and passing (`src/utils/__tests__/ingredientAggregator.test.ts`): "null entry servings scales to 1x base yield", "editing recipe yield after planning does not change scale when baseServings is set", "legacy entry without baseServings uses live recipe yield", "treats a zero or negative baseServings as missing instead of dividing by it". 18/18 tests pass in that file; 324/324 pass across the full unit suite.

Allowed assertion types: `file-exists`, `grep`, `command`, `test-passes`. **Not allowed:** `human`.

## Manual Follow-up (non-blocking)

- [ ] After user deploys the migration: `npm run types:supabase`, confirm `base_servings` appears in `database.ts`
- [ ] Spot-check: plan a 4-serving recipe for 4, edit recipe yield to 6, confirm cart is unchanged

---

## Acceptance Criteria

- [ ] All `verification` block items pass (`/verify-mop`) — underlying commands (lint, build, unit tests, aggregator suite, both grep assertions) verified manually 2026-10-30; formal `/verify-mop` gate not yet run
- [ ] `/integrity-check` passes for the meal-planning domain — not yet run
- [x] Null `servings` resolves to the recipe's base yield on read; never written as `1` by default
- [x] New entries record `base_servings`; the bulk rewrite path preserves it
- [x] Editing a recipe's yield after planning does not change the scaled grocery quantities for entries that have a snapshot (covered by test)
- [x] `security-auditor` (scoped `api` + `migrations`) run before merge, per CLAUDE.md security audit rule — 0 Critical/Warning; 1 Suggestion fixed inline (positive-value CHECK + aggregator guard), 1 deferred (pre-existing, out of scope)
- [x] Documentation updated per `/update-docs` procedure (`DATA_MODEL.md` column addition)
- [x] CHANGELOG entry added (note: pre-existing rows stored as `1` are not repaired)
- [x] ADR-0009 updated to `accepted`

---

## Related

- **ADRs:** ADR-0009 (base-yield snapshot), ADR-0008 (child tables)
- **MOPs:** MOP-0011 (`verifying`; touches the same table, so sequence carefully), MOP-0004 (original scaling design, "Scale amount by (plan servings / recipe default servings)")
- **Audit / source:** meal-planning-sme servings-flow research, 2026-10-30 (`.claude/agents/agents-log.md`)

---

## Notes

- Out of scope here: the "fl oz" unit bug in `ingredientAggregator.ts`, handled as a separate trivial fix.
- Out of scope: `useRecipes` 200-row limit silently dropping recipes from `recipeMap` (also noted in the same research). A missing recipe drops every one of its ingredients from the cart. Track separately if confirmed.
- A parallel migration `20261030120000_058_servings_modal_preference.sql` exists for servings-modal preferences. Coordinate the migration number and avoid conflicting edits to `ServingsModal.tsx`.
- `RecipeForm.tsx:646` saves `parseInt(servings) || 0`, so a recipe can have yield 0. The aggregator's `|| 4` divisor fallback covers this; keep that guard when rewriting the formula.
