# MOP-0022: Configurable Default Meal Plan Period

| Field | Value |
|-------|-------|
| **MOP** | MOP-0022 |
| **Title** | Configurable Default Meal Plan Period |
| **Date Submitted** | 2026-09-05 |
| **Date Updated** | 2026-09-05 |
| **Date Completed** | — |
| **Submitted By** | Nick Neal |
| **Status** | draft |

> Status vocabulary defined in [docs/prompts/MOP_STATUS_LIFECYCLE.md](../prompts/MOP_STATUS_LIFECYCLE.md).

---

## Summary

Users should be able to define their default meal prep cadence once — "every 2 weeks starting on Sunday" — and have every new plan auto-populate its date range from that config. This MOP adds a `plan_period_config` JSONB field to `profiles` (or a `user_preferences` table), a Settings UI to configure it, and wires the config into the "New Plan" date picker introduced in MOP-0021 Phase 4.

---

## Scope Map

```
src/pages/MealPlanner.tsx
src/pages/Settings.tsx
src/components/meal-planning/
src/components/settings/PlanPeriodConfig.tsx
src/services/api.ts
src/types/
supabase/migrations/
docs/
```

---

## Scope of Work

### Phase 1: Data model — plan period config
**Files affected:** `supabase/migrations/NNNN_add_plan_period_config.sql` (write, do not deploy)

Add a `plan_period_config` JSONB column to the `profiles` table with a default of `null` (no config = fall back to 1-week starting Monday). Shape:

```jsonc
{
  "unit": "weeks",          // "days" | "weeks" | "months"
  "count": 2,               // integer ≥ 1
  "startOn": "sunday",      // "monday" | "sunday" | "today" | "specific-weekday"
  "specificWeekday": null   // 0–6 (JS day index) when startOn = "specific-weekday"
}
```

Add RLS: owner can read/write their own row (already covered by profiles RLS).

### Phase 2: API — read/write plan period config
**Files affected:** `src/services/api.ts`, `src/types/userPreferences.ts` (new)

Add `getPlanPeriodConfig()` and `setPlanPeriodConfig(config)` to `apiClient`. These read/write `profiles.plan_period_config` for the authenticated user. Add TypeScript types for the config shape.

### Phase 3: Settings UI
**Files affected:** `src/pages/Settings.tsx`, `src/components/settings/PlanPeriodConfig.tsx` (new)

Add a "Meal Planning" section to Settings with a `PlanPeriodConfig` form component:
- "My default prep period" — radio/select: 1 week / 2 weeks / 4 weeks / Custom
- "Starting on" — select: Monday / Sunday / Today / Specific weekday
- Preview line: "Your next plan will run Mon Sep 7 → Sun Sep 20" (computed live)
- Save button — calls `setPlanPeriodConfig`

### Phase 4: Wire into New Plan flow
**Files affected:** `src/pages/MealPlanner.tsx`, `src/components/meal-planning/CreatePlanModal.tsx`

When the user opens "New Plan," compute the suggested start/end dates from their `plan_period_config`. Pre-fill those dates in the date picker (MOP-0021 Phase 4). User can override — the config is a default, not a constraint.

### Phase 5: "Starting on X day/date" — anchor modes
**Files affected:** `src/components/settings/PlanPeriodConfig.tsx`, `src/services/api.ts`

Support two anchor modes in the config:
- **Relative anchor** (`startOn: "today" | "monday" | "sunday" | "specific-weekday"`): each new plan starts on the next occurrence of that anchor from today.
- **Fixed anchor** (`startOn: "specific-date"`, `anchorDate: "YYYY-MM-DD"`): plans roll forward from a fixed epoch — "every 2 weeks from Sep 1, 2026." This lets users who meal-prep on a fixed biweekly cycle always get the right fortnight.

---

## Priority

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| P1 | Phase 1 — migration | Small | High |
| P1 | Phase 2 — API layer | Small | Medium |
| P1 | Phase 3 — Settings UI | Medium | High |
| P1 | Phase 4 — wire into New Plan | Small | High |
| P2 | Phase 5 — fixed anchor mode | Medium | Medium |

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

  - id: config-type-exists
    type: file-exists
    path: src/types/userPreferences.ts

  - id: plan-period-config-component-exists
    type: file-exists
    path: src/components/settings/PlanPeriodConfig.tsx

  - id: api-has-set-config
    type: grep
    path: src/services/api.ts
    pattern: "setPlanPeriodConfig"
    expect: present

  - id: migration-file-exists
    type: grep
    path: supabase/migrations
    pattern: "plan_period_config"
    expect: present
```

## Manual Follow-up (non-blocking)

- [ ] Confirm live preview computes correct date range for each anchor mode
- [ ] QA: config persists across logout/login

---

## Acceptance Criteria

- [ ] All `verification` block items pass
- [ ] Users with no config get 1-week Monday default (no regression)
- [ ] Saving a config round-trips correctly through Settings
- [ ] New Plan date picker pre-fills from config
- [ ] User can override the pre-filled dates without changing their config
- [ ] Live preview in Settings shows correct computed date range
- [ ] Documentation updated per `/update-docs`
- [ ] CHANGELOG entry added

---

## Related

- **MOPs:** MOP-0021 (multi-week view — consumes the date range this config produces), MOP-0023 (randomizer respects the plan period when filling a whole plan)
- **ADRs:** none yet — may warrant one if fixed-anchor date arithmetic gets complex

---

## Notes

Depends on MOP-0021 Phase 4 (date range picker in New Plan flow) being in place before Phase 4 of this MOP is useful. Can be built in parallel — Phase 3 (Settings UI) stands alone. Migration writes only — user deploys to Supabase.
