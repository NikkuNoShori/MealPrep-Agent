# MOP-0030: Dashboard Redesign — Real-Data Widgets

| Field | Value |
|-------|-------|
| **MOP** | MOP-0030 |
| **Title** | Dashboard Redesign — Real-Data Widgets |
| **Date Submitted** | 2026-09-22 |
| **Date Updated** | 2026-09-22 |
| **Date Completed** | — |
| **Submitted By** | Nick Neal |
| **Status** | draft |

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

> Not yet planned. Populate before moving to `evaluation`/`approved`.

### Phase 1: [Phase Name]
**Files affected:** [list of files]

[Description of what this phase accomplishes.]

### Phase 2: [Phase Name]
**Files affected:** [list of files]

[Description of what this phase accomplishes.]

---

## Priority

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| P0 | [item] | Small/Medium/Large | High/Medium/Low |
| P1 | [item] | Small/Medium/Large | High/Medium/Low |

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

  # Domain-specific — copy from DOMAIN_TEST_MATRIX.md for your Scope Map
  - id: domain-suite
    type: command
    run: npm run test:run -- src/path/__tests__/example.test.ts
    expect_exit: 0
```

Allowed assertion types: `file-exists`, `grep`, `command`, `test-passes`. **Not allowed:** `human`.

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
- "Most-cooked" and "Top cuisines" require new aggregation (grouping meal-plan JSONB by `recipeId`, grouping `recipes.cuisine`) that doesn't exist anywhere in the codebase today — confirm during planning whether this is cheap enough for a single RPC call or needs to be scoped down.
