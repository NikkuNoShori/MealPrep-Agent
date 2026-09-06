# MOP-0021: Multi-Week Meal Planner View

| Field | Value |
|-------|-------|
| **MOP** | MOP-0021 |
| **Title** | Multi-Week Meal Planner View |
| **Date Submitted** | 2026-09-05 |
| **Date Updated** | 2026-09-05 |
| **Date Completed** | — |
| **Submitted By** | Nick Neal |
| **Status** | draft |

> Status vocabulary defined in [docs/prompts/MOP_STATUS_LIFECYCLE.md](../prompts/MOP_STATUS_LIFECYCLE.md).

---

## Summary

The current Meal Planner calendar is hard-coded to a single 7-day week. This MOP extends it to support multi-week plans (2, 4, or N weeks) within a single plan object, renders each slot section (Breakfast, Lunch, Dinner, Snacks) as rows of 7 day columns, and shows additional weeks as collapsed rows that expand on click. The plan data model (JSONB keyed by date string) already supports arbitrary date ranges — this is primarily a UI rendering change with minor plan-creation UX additions.

---

## Scope Map

```
src/pages/MealPlanner.tsx
src/components/meal-planning/
src/types/mealPlan.ts
src/services/api.ts
docs/
```

---

## Scope of Work

### Phase 1: Multi-week data support
**Files affected:** `src/types/mealPlan.ts`, `src/services/api.ts`, `src/pages/MealPlanner.tsx`

The `meal_plan` record's `meals` JSONB is already a map of `{ "YYYY-MM-DD": { breakfast: [...], ... } }` — date range is implied by the keys present. Add explicit `start_date` and `end_date` columns (or derive them from the plan's meals keys) so the UI knows what range to render without guessing. When creating a plan, the user supplies a start and end date (or accepts the default from their period config — see MOP-0022). The week navigator currently computes `weekDates` from a `currentWeek` state anchored to Monday. Generalize this to compute `planDates` — all dates from `start_date` to `end_date` — and partition them into rows of 7 for rendering.

### Phase 2: Meals-view multi-row grid
**Files affected:** `src/pages/MealPlanner.tsx`, `src/components/meal-planning/WeekRow.tsx` (new)

In the Meals view, each slot section (Breakfast, Lunch, Dinner, Snacks) renders its day columns as rows of 7. Week 1 (days 1–7) is always visible. Weeks 2–N are collapsed behind an expand toggle per slot section — clicking "Show more weeks" reveals the next row of 7, up to the plan's full length. Each day cell shows the date label (`Mon 1`) and the meals assigned to that slot. The existing per-cell add/remove interactions remain intact. Extract the 7-column day grid into a reusable `WeekRow` sub-component so each week row in each slot section shares layout code.

### Phase 3: Days view multi-week pagination
**Files affected:** `src/pages/MealPlanner.tsx`

In the Days view (the card-per-day view), the current week navigator (prev/next arrows) already works across weeks. For multi-week plans, the navigator should additionally indicate which week of the plan is currently shown (e.g. "Week 2 of 4") and clamp navigation to the plan's date range.

### Phase 4: Create plan UX — date range picker
**Files affected:** `src/pages/MealPlanner.tsx`, `src/components/meal-planning/CreatePlanModal.tsx` (new or inline form)

The "New Plan" flow currently creates a plan with an implicit 1-week range. Replace the inline title form with a small modal or expanded inline form that lets the user:
- Set a plan title
- Pick start date (default: next Monday, or from period config — MOP-0022)
- Pick end date or duration (1 week / 2 weeks / 4 weeks / custom)
The selected range is stored as `start_date` / `end_date` on the plan record (requires a migration — write it, do not deploy).

### Phase 5: Revert swap-dates misfeature
**Files affected:** `src/pages/MealPlanner.tsx`, `src/components/meal-planning/PlannerSettingsMenu.tsx`

The "Swap dates" option implemented in commit `4016d10` was based on a misunderstanding of the request. Remove the `swapMode` / `swapFirstDate` state, `handleSwapDateClick`, `cancelSwapMode`, and the swap banner. Keep `PlannerSettingsMenu` as the extensible shell — it will be re-populated with legitimate options as future phases of this and other MOPs ship. The settings menu `active` prop and the `ArrowLeftRight` import can be removed or kept dormant.

---

## Priority

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| P0 | Phase 5 — revert swap misfeature | Small | Medium |
| P1 | Phase 1 — multi-week data + start/end dates | Medium | High |
| P1 | Phase 2 — meals-view multi-row grid | Medium | High |
| P2 | Phase 3 — days-view week indicator | Small | Medium |
| P2 | Phase 4 — create plan date range picker | Medium | High |

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

  - id: swap-state-removed
    type: grep
    path: src/pages/MealPlanner.tsx
    pattern: "swapMode"
    expect: absent

  - id: week-row-component-exists
    type: file-exists
    path: src/components/meal-planning/WeekRow.tsx

  - id: plan-dates-computed
    type: grep
    path: src/pages/MealPlanner.tsx
    pattern: "planDates"
    expect: present
```

## Manual Follow-up (non-blocking)

- [ ] Visual QA: 4-week plan renders correctly at 1280px and 375px (mobile)
- [ ] Confirm expand/collapse animation feels snappy at 28+ day plans

---

## Acceptance Criteria

- [ ] All `verification` block items pass
- [ ] `/integrity-check` passes for meal-planning domain
- [ ] Single-week plans render identically to today (no regression)
- [ ] 2-week and 4-week plans render 2 and 4 rows of 7 in meals view
- [ ] Week 1 always visible; weeks 2+ collapsed behind expand toggle per slot
- [ ] Days view shows "Week N of N" indicator for multi-week plans
- [ ] "New Plan" flow exposes start/end date or duration picker
- [ ] Swap-dates state completely removed from MealPlanner.tsx
- [ ] Documentation updated per `/update-docs`
- [ ] CHANGELOG entry added

---

## Related

- **MOPs:** MOP-0022 (configurable default plan period — feeds the date picker defaults here), MOP-0023 (randomizer uses the multi-week date range)
- **Notes:** `start_date` / `end_date` columns require a migration file (write only — user deploys). Check MOP-0011 (normalize meal_plans to child tables) before designing the schema addition — if MOP-0011 ever executes, these columns move.

---

## Notes

The `meals` JSONB keyed by date string already handles arbitrary ranges. The main risk is the week-navigator assuming 7 days — audit all references to `weekDates` (7-element array) and replace with `planDates` partitioned into weeks. The Days view's horizontal scroll + snap behavior was tuned for exactly 7 cards; multi-week in Days view will need pagination (prev/next week within the plan) rather than showing all days at once.
