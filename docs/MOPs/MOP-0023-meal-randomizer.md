# MOP-0023: "I Don't Know" Meal Randomizer

| Field | Value |
|-------|-------|
| **MOP** | MOP-0023 |
| **Title** | "I Don't Know" Meal Randomizer |
| **Date Submitted** | 2026-09-05 |
| **Date Updated** | 2026-09-05 |
| **Date Completed** | — |
| **Submitted By** | Nick Neal |
| **Status** | draft |

> Status vocabulary defined in [docs/prompts/MOP_STATUS_LIFECYCLE.md](../prompts/MOP_STATUS_LIFECYCLE.md).

---

## Summary

A "I Don't Know" button in the Meal Planner randomly selects recipes from the user's library and assigns them to empty meal slots. The randomizer is configurable: filter by recipe visibility (personal / household / public), filter by tag or cuisine, and automatically exclude any recipe tagged `ALLERGY WARNING` (see MOP-0024). It operates at three granularities — single slot, full day, full plan period — and respects the household's allergy profiles so no unsafe recipe ever gets assigned.

---

## Scope Map

```
src/pages/MealPlanner.tsx
src/components/meal-planning/RandomizerConfig.tsx
src/components/meal-planning/PlannerSettingsMenu.tsx
src/services/api.ts
src/types/
docs/
```

---

## Scope of Work

### Phase 1: Randomizer algorithm (client-side)
**Files affected:** `src/services/randomizer.ts` (new), `src/services/api.ts`

Write a `selectRandomMeals(pool, slots, options)` function:
- `pool`: array of recipes already fetched (id, title, tags, visibility)
- `slots`: list of `{ dateStr, slotKey }` to fill
- `options`: `{ excludeAllergyWarning: boolean, visibility: ('personal'|'household'|'public')[], tags: string[], maxRepeat: number }`

Algorithm:
1. Filter pool by visibility and tags.
2. Remove any recipe tagged `ALLERGY WARNING` if `excludeAllergyWarning` is true (default: true always).
3. Shuffle the filtered pool (Fisher-Yates).
4. Assign one recipe per slot, cycling through the shuffled pool if the pool is smaller than the slot count. Respect `maxRepeat` — default 1 (same recipe not repeated within the same plan period).
5. Return `{ dateStr, slotKey, recipe }[]` assignments.

### Phase 2: Single-slot "I Don't Know" button
**Files affected:** `src/pages/MealPlanner.tsx`

Add a `?` / "I Don't Know" button inside each day-slot cell (both Days view and Meals view), alongside the existing `+ Add` button. Clicking it runs the randomizer for that one slot and immediately assigns the result via `updateMealPlan`. The button is hidden if a meal is already assigned to that slot (only fills empties, unless the user holds Shift to replace).

### Phase 3: Day-level randomizer
**Files affected:** `src/pages/MealPlanner.tsx`

Add an "I Don't Know" option to the day column header (Days view) that fills all empty slots for that day in one click. Shows a brief confirmation chip: "3 meals assigned" with an Undo button (one-step undo via local state before persist).

### Phase 4: Full-plan randomizer
**Files affected:** `src/pages/MealPlanner.tsx`, `src/components/meal-planning/PlannerSettingsMenu.tsx`

Add "Randomize whole plan" to `PlannerSettingsMenu`. Fills all empty slots across the entire plan period. Shows a modal preview of the proposed assignments before committing, allowing the user to re-roll individual slots or accept all.

### Phase 5: Randomizer config settings
**Files affected:** `src/components/meal-planning/RandomizerConfig.tsx` (new), `src/pages/Settings.tsx`

A "Randomizer" section in Settings (and accessible from the PlannerSettingsMenu) where the user configures:
- Visibility filter: which recipe pools to draw from (personal / household / public)
- Tag/cuisine filter: "only pick from tagged [weeknight, quick]"
- Max repeat: how many times the same recipe can appear in one plan period
- Allergy exclusion: always on (not configurable — safety default), but shows a list of which household members' allergies are active

Config stored in `profiles.randomizer_config` JSONB (migration file, do not deploy).

---

## Priority

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| P0 | Phase 1 — algorithm (allergy exclusion) | Small | High |
| P1 | Phase 2 — single-slot button | Small | High |
| P1 | Phase 3 — day-level randomizer | Small | High |
| P2 | Phase 4 — full-plan randomizer with preview | Medium | High |
| P2 | Phase 5 — config settings UI | Medium | Medium |

---

## Verification

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

  - id: randomizer-service-exists
    type: file-exists
    path: src/services/randomizer.ts

  - id: randomizer-excludes-allergy
    type: grep
    path: src/services/randomizer.ts
    pattern: "ALLERGY WARNING"
    expect: present

  - id: randomizer-unit-tests
    type: command
    run: npm run test:run -- src/services/__tests__/randomizer.test.ts
    expect_exit: 0
```

## Manual Follow-up (non-blocking)

- [ ] QA: allergy-tagged recipe never appears in randomizer output — spot-check with a household member allergy profile
- [ ] UX review: "I Don't Know" label vs icon — confirm it's discoverable without being intrusive

---

## Acceptance Criteria

- [ ] All `verification` block items pass
- [ ] `ALLERGY WARNING`-tagged recipes are never assigned by the randomizer regardless of config
- [ ] Single-slot button fills one empty cell and persists immediately
- [ ] Day-level fill provides one-step undo before persist
- [ ] Full-plan randomizer shows preview modal before committing
- [ ] Config persists across sessions
- [ ] Documentation updated per `/update-docs`
- [ ] CHANGELOG entry added

---

## Related

- **MOPs:** MOP-0024 (allergy tagging — required before Phase 1 is meaningful), MOP-0021 (multi-week view — the full-plan randomizer spans the whole date range), MOP-0022 (plan period config)
- **Blocked by:** MOP-0024 Phase 1 (allergy tags must exist before exclusion logic has anything to filter)

---

## Notes

The randomizer is intentionally client-side for low latency. The recipe pool is already loaded into React Query cache on the Recipes page; the Meal Planner may need a lightweight "all my recipes" query (id + title + tags + visibility only) to avoid loading full recipe objects just for randomization. Fisher-Yates shuffle must use `crypto.getRandomValues` (not `Math.random`) for uniform distribution. The "I Don't Know" label is intentional UX — approachable and honest about the feature's nature.
