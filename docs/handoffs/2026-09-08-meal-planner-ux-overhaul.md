# Meal Planner UX Overhaul — 2026-09-08

## Summary
Full overhaul of the meal planner UI: replaced the plan selector pill with a `WeekLabelDropdown`, rewrote `MealPlanHistory` with grouped sections and per-row actions, removed Shopping Mode from the grocery tab, and wired the Suggest Week modal with last-plan exclusion. Session ended with all changes shipped.

## What changed (committed)

> Note: This entry was written before the git-verification rule was established. Commit hashes were not recorded. Cross-check `git log` for the authoritative list of commits from this date.

- `src/pages/MealPlanner.tsx` — replaced `PlanSelectorDropdown` with `WeekLabelDropdown`; per-plan `⋯` menu (Rename, Mark complete, Restore, Delete with confirm); empty state gate when all plans deleted; removed dead `bannerMenu*` state and ref
- `src/components/meal-planning/MealPlanHistory.tsx` — full rewrite: grouped sections (Active/stale → Completed → Archived), status icons, newest-first sort, detail overlay (max-w-2xl, two-column grid), per-row ellipsis actions (Copy, Restore, Archive, Mark complete, Delete), Copy to new plan starts day after source end date
- `src/components/meal-planning/GroceryCart.tsx` — Shopping Mode removed entirely (toggle, state, ShoppingMode import, conditional renders)
- `src/components/meal-planning/SuggestWeekModal.tsx` — last-plan exclusion via `excludeRecipeIds` prop; fetches 20 suggestions when exclusions exist, filters client-side, shows top 10
- `src/services/api.ts` — `useDeleteMealPlan` with optimistic `onMutate` removal

## Decisions and reasoning

- **WeekLabelDropdown shows only `activePlans`** — dropdown hides completed/archived plans to reduce noise. Known gap: if a user has only completed plans, the dropdown is empty. Accepted for now; full fix would add a "completed" section to the dropdown.
- **Shopping Mode removed** — deemed unnecessary complexity; grocery tab retains Add Item and Regenerate as always-visible actions.
- **Optimistic delete** — plan disappears instantly from the list on delete without waiting for a round-trip. Keeps the UI snappy; rollback on error not implemented (Supabase delete failures are rare).
- **Copy to new plan** starts the day after source plan's `endDate` using the user's default duration (`newPlanDays` from config). No UI to override the start date at copy time.

## Known issues / things that look wrong but aren't (or are)

- `PackageOpen` icon for archived plans — noted as debatable but left as-is.
- Dropdown empty when user has only completed plans — known gap, not a bug, deferred.

## Open questions for the user

- Should the WeekLabelDropdown optionally show completed plans in a separate section so users with no active plans aren't stranded?

## Suggested next steps

Deferred ideas from this session that were explicitly discussed but not implemented:

- Grocery tab empty state (prompt or pointer when no plan / no meals)
- "New Plan" button inside WeekLabelDropdown at the bottom of the list
- WeekLabelDropdown showing completed plans in a secondary section
- MOP-0014: Household Write Atomicity — still pending, never started
- MOP-0026: Security Auditor Agent — scaffolded but not implemented at time of writing
