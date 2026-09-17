# Handoff: Meal Planner UX Overhaul
**Date:** 2026-09-08  
**Session scope:** MealPlanner.tsx, MealPlanHistory.tsx, GroceryCart.tsx, SuggestWeekModal.tsx, api.ts

---

## What Was Shipped

### Plan Selector / WeekLabelDropdown
- **Replaced `PlanSelectorDropdown` pill** with `WeekLabelDropdown` — the week date range IS the dropdown trigger (click the date label in the toolbar to switch plans).
- Dropdown shows "Switch plan" section only when ≥ 2 plans exist.
- Always opens when actions are available (≥ 1 plan).
- **Per-plan `⋯` button** inside the dropdown: each plan row has an ellipsis that reveals Rename, Mark complete / Restore to active, and **Delete** (with confirmation dialog).
- Selected plan row uses `bg-white/10` for reliable dark-mode highlight.
- Panel background uses `hsl(var(--popover))` to match shadcn across themes.

### Active Plan Actions (now in WeekLabelDropdown `⋯`)
- **Rename** — inline Input replaces toolbar, saves on Enter / click-outside.
- **Mark complete** — confirmation dialog before transitioning to `completed`.
- **Restore to active** — shown for `completed` plans (no confirm needed).
- **Delete** — shown for all plans; confirmation dialog before calling `handleDeletePlan`.
- The old standalone `⋯` button block (bannerMenuRef / bannerMenuOpen) has been removed.

### Plan Status Filters (History vs. Active)
- `activePlans`: `(status === 'active' || 'draft') && endDate >= today`.
- `historyPlans`: `status === 'completed' || 'archived' || endDate < today` (stale plans correctly route to history).
- Dropdown shows only `activePlans`.

### MealPlanHistory Redesign
- **Grouped sections**: Active (stale) → Completed → Archived, each with dividers.
- **Sort**: newest-first within each group.
- **Status icons**: emerald `CheckCircle2` for completed, `PackageOpen` for archived, `CalendarCheck` for stale-active, `Clock` for draft.
- **Ellipsis per row**: Copy to new plan, Restore to active, Archive (completed only), Mark complete (stale only), Delete.
- **Detail overlay**: wide (`max-w-2xl`), solid `hsl(var(--popover))` background, two-column grid, footer actions.
- **Copy to new plan**: starts the day after source plan's `endDate`, runs for user's default duration (`newPlanDays` from config).

### Grocery Tab / Shopping Mode
- **Shopping Mode removed** entirely (toggle button, state, ShoppingMode import, conditional renders all cleaned up).
- Grocery tab remains, with Add Item and Regenerate always visible.

### Suggest Week Modal (MOP-0007 Phase 4)
- Button wired in toolbar (Sparkles icon), only shows when `weekPlan` exists.
- **Last-plan exclusion**: `historyPlans[0].meals` is parsed for recipe IDs → passed as `excludeRecipeIds: Set<string>` to `SuggestWeekModal`.
- Modal fetches 20 suggestions (instead of 10) when exclusions exist, filters client-side, shows top 10 of what remains.
- Displays note: "X recipes from your last plan hidden to keep things fresh."

### Delete: Optimistic UI + Empty State
- `useDeleteMealPlan` in `api.ts` uses `onMutate` optimistic removal — the plan disappears instantly from the list without waiting for a round-trip.
- When all plans are deleted: toolbar hides (gated on `isLoading || activePlan`), existing "No Plan CTA" shows with "Create Your First Plan" button.

### Other
- Dropdown now stays open when only 1 plan exists (was `> 1`, fixed to `>= 1`).
- Removed `bannerMenuOpen`, `bannerMenuRef`, and their effect hook (dead code after standalone `⋯` removal).

---

## Ideas Discussed but NOT Yet Implemented

| Idea | Notes |
|---|---|
| **Grocery tab empty state** | When no plan selected or plan has no meals, grocery tab shows a plain empty area — could use a "Add ingredients" prompt or a pointer to the meal plan. |
| **Plan list: New Plan button in WeekLabelDropdown** | User might want "New Plan" inside the dropdown list at the bottom, in addition to the header button. Not discussed explicitly but natural next step. |
| **History: archive icon** | `PackageOpen` is fine but could use a more distinct icon. Noted as debatable. |
| **WeekLabelDropdown: show all plans (not just active)** | Currently dropdown only shows `activePlans`. If user has only completed plans, dropdown is empty. Could optionally show completed plans in a separate section. |
| **Mobile swipe to switch plans** | The week nav arrows work, but mobile UX for multi-plan households wasn't addressed. |
| **MOP-0014: Household Write Atomicity** | Still pending, never started. |
| **MOP-0026: Security Auditor Agent** | Scaffolded but not implemented. |

---

## Files Changed This Session
| File | Change summary |
|---|---|
| `src/pages/MealPlanner.tsx` | WeekLabelDropdown with per-plan `⋯`; delete confirm; empty state gate; removed bannerMenu* |
| `src/components/meal-planning/MealPlanHistory.tsx` | Full rewrite: grouped sections, status icons, detail overlay, ellipsis actions |
| `src/components/meal-planning/GroceryCart.tsx` | Shopping Mode removed |
| `src/components/meal-planning/SuggestWeekModal.tsx` | Last-plan exclusion via `excludeRecipeIds` prop |
| `src/services/api.ts` | `useDeleteMealPlan` with optimistic `onMutate` removal |
