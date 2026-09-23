# MOP-0030: Dashboard Redesign — Real-Data Widgets

| Field | Value |
|-------|-------|
| **MOP** | MOP-0030 |
| **Title** | Dashboard Redesign — Real-Data Widgets |
| **Date Submitted** | 2026-09-22 |
| **Date Updated** | 2026-09-22 (scope of work planned) |
| **Date Completed** | — |
| **Submitted By** | Nick Neal |
| **Status** | evaluation |

> Status vocabulary defined in [docs/prompts/MOP_STATUS_LIFECYCLE.md](../prompts/MOP_STATUS_LIFECYCLE.md). Valid values: `draft` / `evaluation` / `approved` / `planned` / `in_progress` / `verifying` / `complete` / `blocked` / `cancelled` / `deferred`.

---

## Summary

The current `/dashboard` page (`src/pages/Dashboard.tsx`) shows stats that are silently broken or misleading: the "Recipes" count is capped at whatever `limit` was passed to `useRecipes()` (currently 10) rather than a true total, "This week" is just the 7 most-recent meal plans by `start_date` rather than plans actually overlapping the current week, and "Grocery" is an arbitrarily-chosen single plan's unchecked-item count rather than a real progress stat. This MOP replaces the stat row with a widget-based dashboard — KPI strip (recipe count including household-shared, active plans, reactions given, household size), Today (this week's actual meals), Grocery cart (checked/total progress with category breakdown), Most-cooked this month, and Top cuisines — backed by a new efficient aggregation RPC rather than the current pattern of fetching capped/paginated lists just to read `.length`.

Widget content and visual direction were designed and approved in a prior session (see mockups referenced in §Related). Visual styling uses the app's current live palette (stone/primary/amber/teal) — the botanical-kitchen bones (dashed rules, italic serif widget labels) without the mock terracotta/olive colors, which are tracked separately under MOP-0029.

**Sequencing note:** shipping this MOP on the current live palette is the last trigger condition gating MOP-0029 Phases 4/6/7/8/9 (theme token plumbing + preset authoring). Do not entangle the two change sets.

---

## Scope Map

```
src/pages/Dashboard.tsx
src/services/api.ts
supabase/migrations/<new>_get_dashboard_stats.sql
supabase/functions/_shared/**          # if RPC needs edge-function wrapping
src/components/dashboard/**            # new widget components
docs/DATA_MODEL.md                     # document new RPC
docs/API.md                            # document new client method
```

---

## Scope of Work

> **Phase dependency order.** 1 → 2 → (3, 4 parallel) → 5.

### Phase 1: `get_dashboard_stats()` RPC
**Files affected:** `supabase/migrations/<next>_get_dashboard_stats.sql`

Single `SECURITY DEFINER` / `SET search_path = public` Postgres function, following the `get_household_recipes()` pattern (migration 025), returning one JSON payload in one round trip:

- **Recipe counts** — true totals via `COUNT(*)`, not a page-limited fetch: `own_count` (`user_id = auth.uid()`), `household_count` (visibility = `household` within the caller's household), `public_visible_count`. Mirrors the OR-filter `getRecipesLight()` already uses (`src/services/api.ts:220-230`) but as a count, not a row fetch.
- **This week's meals** — the caller's `meal_plans` row(s) where `start_date <= CURRENT_DATE <= end_date`, returning that day's `meals->>CURRENT_DATE` slots (or the nearest plan if none overlaps exactly — match the empty-state design from the approved mockup).
- **Active plan count** — `COUNT(*) WHERE status = 'active'`.
- **Grocery progress** — from the active (or most-recent) plan's `grocery_list->'items'`: checked/total counts and a per-`category` breakdown, computed via `jsonb_array_elements` server-side rather than shipping the full item array to the client to filter.
- **Reactions given** — `COUNT(*)` from `recipe_reactions` where the reactor is the caller or a dependent they manage (mirrors the RLS policy shape in migration 017), scoped to the household.
- **Most-cooked this month** — aggregate `recipeId` occurrences across `meal_plans.meals` JSONB for plans with `start_date >= date_trunc('month', CURRENT_DATE)`, via `jsonb_each` (date keys) + `jsonb_array_elements` (per-slot entries). **Bound to the current month** — an all-time scan is not bounded and would grow linearly with plan history.
- **Top cuisines** — `GROUP BY cuisine` over the caller's visible recipes (reuse the recipe-visibility OR-filter), excluding `NULL`/empty `cuisine`. **Known data-quality caveat:** `cuisine` is free-text (`VARCHAR(100)`, no enum), so casing/spelling variants (`"italian"` vs `"Italian"`) will bucket separately. Normalize with `lower(trim(cuisine))` in the query and document that free-text cuisine entry can fragment counts — not a bug this MOP needs to fix, but must not be silently wrong.

Household size is **not** included — `useMyHousehold()` already returns `members`/`dependents`/`pending_invites` in one call at zero extra cost (§Notes).

### Phase 2: Wire the RPC into `api.ts`
**Files affected:** `src/services/api.ts`

Add `apiClient.getDashboardStats()` calling the new RPC via `supabase.rpc('get_dashboard_stats')`, following the existing `getMyHousehold()`/`getHouseholdRecipes()` call pattern. Add a `useDashboardStats()` React Query hook alongside the other `use*` hooks in the file. snake_case → camelCase mapping via the existing `snakeToCamel` utility.

### Phase 3: Widget components
**Files affected:** `src/components/dashboard/KpiStrip.tsx`, `src/components/dashboard/TodayWidget.tsx`, `src/components/dashboard/GroceryCartWidget.tsx`, `src/components/dashboard/MostCookedWidget.tsx`, `src/components/dashboard/TopCuisinesWidget.tsx` (new)

Extract each widget from the approved mockup into its own component, styled with the app's current live palette (stone/primary/amber/teal) — botanical-bones layout (dashed rules, italic serif widget labels via `font-family: 'Fraunces'`) without the mock terracotta/olive colors, which stay tracked under MOP-0029. Each widget owns its own loading/empty state; no widget blocks the others from rendering while its own data is in flight.

### Phase 4: Replace `Dashboard.tsx`
**Files affected:** `src/pages/Dashboard.tsx`

Replace the current stat-row + Recent-Recipes layout with `useDashboardStats()` and the Phase 3 widgets. Remove `useRecipes({ limit: 10 })` / `useMealPlans({ limit: 7 })` from the page — the new RPC replaces both capped fetches. Keep the quick-actions row (Add Recipe / Plan Week / AI Assistant) as-is; it already works correctly and isn't part of the stats problem.

### Phase 5: Documentation
**Files affected:** `docs/DATA_MODEL.md`, `docs/API.md`

Document the new RPC (§RPC catalog in DATA_MODEL.md, following the existing `get_my_household`/`get_household_recipes` entries) and the new `getDashboardStats()` client method in API.md.

---

## Priority

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| P1 | Phase 1 — `get_dashboard_stats()` RPC | Medium | High (fixes the core "stats are fake" problem) |
| P1 | Phase 2 — wire RPC into `api.ts` | Small | High (blocks Phases 3–4) |
| P1 | Phase 4 — replace `Dashboard.tsx` | Small | High (the visible payoff) |
| P2 | Phase 3 — widget components | Medium | High (user-visible, but can iterate after Phase 4 lands with placeholder styling) |
| P2 | Phase 5 — documentation | Small | Medium |

> This MOP has no `defer`-priority phases — unlike MOP-0029, none of this work is gated on external design input. All five presets' hex specs live in MOP-0029 for *later*; this MOP ships on the *current* live palette, which already exists.

---

## Verification

> **Lockticket acceptance criteria.** See [MOP_VERIFICATION_POLICY.md](../prompts/MOP_VERIFICATION_POLICY.md) — **`type: human` is forbidden** (blocks `complete`). Route domain tests via [DOMAIN_TEST_MATRIX.md](../prompts/DOMAIN_TEST_MATRIX.md). Run `/integrity-check` then `/verify-mop MOP-0030`.

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

  # Domain: meal-planning (meal plans, grocery cart) — DOMAIN_TEST_MATRIX.md
  - id: meal-planning-suite
    type: command
    run: npm run test:run -- src/services/__tests__/api.test.ts
    expect_exit: 0

  - id: ingredient-aggregator-suite
    type: command
    run: npm run test:run -- src/utils/__tests__/ingredientAggregator.test.ts
    expect_exit: 0

  # Phase 1 — RPC exists and follows the SECURITY DEFINER pattern
  - id: rpc-security-definer
    type: grep
    file: supabase/migrations/<next>_get_dashboard_stats.sql
    pattern: 'SECURITY DEFINER'
    expect: present

  - id: rpc-search-path-set
    type: grep
    file: supabase/migrations/<next>_get_dashboard_stats.sql
    pattern: 'SET search_path = public'
    expect: present

  # Phase 2 — client method + hook exist
  - id: api-client-method-exists
    type: grep
    file: src/services/api.ts
    pattern: 'getDashboardStats'
    expect: present

  # Phase 4 — Dashboard.tsx no longer fetches capped lists just to count them
  - id: no-capped-recipe-fetch-for-count
    type: grep
    file: src/pages/Dashboard.tsx
    pattern: 'useRecipes\(\{ limit: 10 \}\)'
    expect: absent

  - id: no-capped-mealplan-fetch-for-count
    type: grep
    file: src/pages/Dashboard.tsx
    pattern: 'useMealPlans\(\{ limit: 7 \}\)'
    expect: absent

  - id: dashboard-uses-new-hook
    type: grep
    file: src/pages/Dashboard.tsx
    pattern: 'useDashboardStats'
    expect: present
```

Allowed assertion types: `file-exists`, `grep`, `command`, `test-passes`. **Not allowed:** `human`.

> **Migration filename placeholder.** `<next>_get_dashboard_stats.sql` must be replaced with the real timestamped filename once Phase 1 creates it, before `/verify-mop` can evaluate the grep assertions.

## Manual Follow-up (non-blocking)

> Optional human review **after** `complete`. Never gates status.

- [ ] Visual spot-check against the approved dashboard-widget mockups
- [ ] Confirm RPC query cost is reasonable against a household with a large recipe/plan history

---

## Acceptance Criteria

- [ ] All `verification` block items pass (`/verify-mop`)
- [ ] `/integrity-check` passes for this MOP's domains
- [ ] Recipe count reflects a true total (own + household + public), not a page-limited count
- [ ] "This week" reflects plans actually overlapping the current date, not the N most-recent by start_date
- [ ] Grocery widget shows real checked/total progress, not an arbitrary single-plan unchecked count
- [ ] Most-cooked and top-cuisines widgets are computed server-side (RPC), not by fetching full plan/recipe history client-side
- [ ] Cuisine grouping normalizes case/whitespace (`lower(trim(cuisine))`) so `"Italian"`/`"italian"` don't fragment into separate buckets
- [ ] No dashboard stat requires fetching a full unpaginated list client-side just to read `.length`
- [ ] Documentation updated per `/update-docs` procedure
- [ ] CHANGELOG entry added
- [ ] Related ADRs (if any) updated to `accepted`

---

## Related

- **ADRs:** none yet
- **MOPs:** MOP-0029 (Theme Token Layering & Surface-Aware Presets) — Phases 4/6/7/8/9 are gated on this MOP shipping first, to avoid entangling two cross-cutting change sets
- **Audit / source:** dashboard-redesign design session, 2026-09-21 — widget content and visual mockups approved in conversation; not yet captured as standalone artifacts referenced by URL in this MOP

---

## Notes

- Widget set decided in the design session: KPI strip (total recipes w/ shared count, active plans, reactions given, household size), Today (current week's meals), Grocery cart (checked/total + category chips), Most-cooked this month, Top cuisines. Explicitly excluded: a "week streak" stat (no clear definition of what to track) and "recipes via chat" (no reliable attribution path from chat-extracted recipes back to a `source` column).
- The `get_household_recipes()` RPC (migration 025) is the only existing example of a true `COUNT(*)`-backed recipe total in this codebase — pattern to follow for the new RPC.
- `get_my_household()` already returns `members`, `dependents`, and `pending_invites` in one call at no extra cost — the KPI strip's household size can read directly from the existing `useMyHousehold()` hook without new plumbing.
- "Most-cooked" and "Top cuisines" require new aggregation (grouping meal-plan JSONB by `recipeId`, grouping `recipes.cuisine`) that doesn't exist anywhere in the codebase today. **Resolved during planning (Phase 1):** both are cheap enough for a single RPC call once bounded — most-cooked is scoped to the current month (not all-time) to keep the JSONB scan bounded, and top-cuisines normalizes free-text casing via `lower(trim(cuisine))`.
