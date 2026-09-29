# MOP-0032: QoL Backlog Batch 1 — Extraction, Chat, Recipes, Planner, Grocery

| Field | Value |
|-------|-------|
| **MOP** | MOP-0032 |
| **Title** | QoL Backlog Batch 1 — Extraction, Chat, Recipes, Planner, Grocery |
| **Date Submitted** | 2026-09-28 |
| **Date Updated** | 2026-09-28 |
| **Date Completed** | — |
| **Submitted By** | Nick Neal |
| **Status** | draft |

> Status vocabulary defined in [docs/prompts/MOP_STATUS_LIFECYCLE.md](../prompts/MOP_STATUS_LIFECYCLE.md). Valid values: `draft` / `evaluation` / `approved` / `planned` / `in_progress` / `verifying` / `complete` / `blocked` / `cancelled` / `deferred`.

---

## Summary

Captures a batch of quality-of-life issues logged 2026-08-24 through 2026-09-27. Items span five domains: recipe extraction normalization (units, ingredient names, instruction noise), chat save flow (post-save link, in-chat editing, re-render bug), recipes page (search, filter UX, card icons), meal planner (redundant slot confirmation, title view), and grocery list (category toggle, "already owned" clear). Higher-complexity features (nutrition display, meal frequency tracking) are catalogued here but deferred to MOP-0033.

---

## Scope Map

```
supabase/functions/recipe-pipeline/**
supabase/functions/chat-api/**
src/components/meal-planning/**
src/components/grocery/**
src/pages/Recipes.tsx
src/pages/MealPlanner.tsx
src/services/api.ts
```

---

## Scope of Work

### Phase 1 — Extraction: Unit & Ingredient Name Normalization
**Files affected:** `supabase/functions/recipe-pipeline/_shared/prompts.ts` (or equivalent prompt/schema file), `supabase/functions/recipe-pipeline/stages/transform.ts`

Fixes four extraction quality issues identified in live testing:

1. **"piece" unit for countable items** — `1 piece onion` is invalid. When the extracted unit is `piece` (or blank) and the ingredient is a countable whole food (onion, potato, bell pepper, egg, etc.), normalize to integer-only quantity with no unit. This is an LLM prompt constraint + post-processing guard.

2. **Informal/modifier units** — `1 heaping teaspoon` should collapse to `1 teaspoon`. Strip informal modifiers (`heaping`, `scant`, `rounded`, `level`, `generous`) from unit strings before persisting.

3. **Shorthand unit expansion** — `c` → `cup`, `tbsp` → `tablespoon`, `tsp` → `teaspoon`, `oz` → `ounce`, `lb` → `pound`. Normalize at transform stage (LLM prompt + post-processing lookup table).

4. **Ingredient name clipping** — `feta` extracted instead of `feta cheese`; `ap flour` instead of `all-purpose flour`. The prompt must instruct the model to emit full canonical ingredient names. Add a post-process expansion map for common shorthands (`ap flour` → `all-purpose flour`, `evoo` → `extra virgin olive oil`, etc.). The map is a starting list — not exhaustive; will grow over time.

5. **"stalk" as carrot unit** — `stalk` is not a valid unit for carrots (or most produce). Same countable-item rule as (1): strip to integer quantity only.

6. **Instruction noise** — The model extracted `"enjoy"` as an instruction step from a photo recipe (tater tot casserole). Add a post-process filter that discards instruction steps that are ≤ 3 words, are purely a social phrase (enjoy, serve warm, etc.), or match a blocklist. Also add a prompt constraint: "Do not include serving suggestions, garnish comments, or social phrases as steps."

7. **Quantity type: support fractions and ranges** — Quantity is currently stored as integer/float, rejecting `1/4` and `4-6`. Schema change: `quantity` column becomes `varchar(20)`. Parsing logic: accept `1/4`, `0.25`, `4-6`, `2 1/2`. Display formatting: render fractions as-is from stored string. Migration required (non-breaking — `numeric` → `varchar(20)` with a `USING quantity::varchar` cast).

### Phase 2 — Chat: Post-Save Recipe Link
**Files affected:** `supabase/functions/chat-api/tools/handlers.ts`, `supabase/functions/chat-api/_shared/prompts.ts`

After the agent successfully saves a recipe, the confirmation message should include a hyperlink to the recipe detail page: `[View recipe →](/recipes/<id>)`. The `saveRecipe` handler already returns the new recipe `id` — pass it into the success message template.

### Phase 3 — Chat: In-Chat Recipe Edit Before Save
**Files affected:** `supabase/functions/chat-api/tools/handlers.ts`, `supabase/functions/chat-api/tools/catalog.ts`, front-end chat message renderer

Allow the user to correct AI-parsed recipe data before saving. Two surfaces:

1. **Natural language corrections** — e.g. "add shredded cheese as an ingredient", "remove the 'enjoy' step". The agent handles these as edits to the in-memory extracted recipe object, then re-renders the recipe card. This requires the agent to hold the extracted recipe in tool state between turns and apply patch operations before `saveRecipe`.

2. **Re-render bug fix** — When the user requests an edit, the chat currently renders raw XML (`<extracted_recipe>…</extracted_recipe>`) instead of the recipe card component. Root cause: the message renderer does not detect the `extracted_recipe` XML tag in an agent reply and route it to the card component. Fix the renderer to strip/replace the XML envelope and display the card.

3. **Save error fix** — "Unable to associate with your account" error after editing. Likely a `user_id` not being forwarded through the edit→save path. Investigate and fix.

### Phase 4 — Recipes Page: Search Fix
**Files affected:** `src/pages/Recipes.tsx`, `src/services/api.ts`, possibly `supabase/functions/chat-api/tools/handlers.ts`

Search returns no results for queries like "chicken". Diagnose whether the issue is in:
- Frontend query not being sent
- API layer filter not matching
- Database text search / embedding search not returning results
- RLS silently filtering results

Fix the root cause. Add a unit test asserting that a search for a known recipe title returns at least one result.

### Phase 5 — Recipes Page: Filter UX + Card Icons
**Files affected:** `src/pages/Recipes.tsx`, `src/components/recipe/RecipeCard.tsx` (or equivalent)

1. **Click-to-close filter menu** — The filter/sort panel has no dismiss affordance. Clicking outside the panel (or pressing Escape) should close it. Standard focus-trap / outside-click pattern.

2. **Recipe card icons not visible** — Icons on recipe cards are invisible (screenshot confirmed). Likely a color token issue (icon color same as background). Inspect and fix.

3. **All-recipes tab** — Verify whether the recipes page already shows all recipes (private + household-shared + own public). If a dedicated "All" tab or filter bucket is missing, add one. Distinct from the recipe library feature — this is a flat list view within the existing recipes page.

4. **Multi-select + share audit** — Confirm whether bulk multi-select and share was shipped (MOP-0028). If present, verify it works. If missing the "share with household" action specifically, add it.

### Phase 6 — Meal Planner: Remove Redundant Slot Confirmation
**Files affected:** `src/components/meal-planning/AddToPlanButton.tsx`, `src/pages/MealPlanner.tsx`

When the user clicks the `+` icon on a specific day/slot in the weekly calendar, the slot (breakfast/lunch/dinner) is already determined by which row they clicked. The subsequent modal that asks them to re-confirm the slot is redundant. Skip the slot-selection step when the calling context already supplies a slot.

Pass the pre-selected `slot` from the calendar cell through to `AddToPlanButton` (or the recipe selector modal). If `slot` is already set, bypass the meal-type picker and go straight to the recipe selector.

### Phase 7 — Meal Planner: Meal Title View
**Files affected:** `src/pages/MealPlanner.tsx`, possibly a new `MealTitleView` component

Add a third calendar view mode alongside "meals" (the weekly grid) and "days" (the stacked day rows): a **title view** that shows the same date structure but replaces recipe photos/thumbnails with just the recipe title text. Compact, scannable at a glance. Toggle from the existing view-mode toolbar.

### Phase 8 — Grocery List: Category Toggle + "Already Owned"
**Files affected:** `src/components/grocery/GroceryCart.tsx`, `src/components/grocery/GroceryList.tsx` (or equivalent), `src/services/api.ts`, possibly a migration for an `is_owned` column

1. **Category toggle** — Add a toggle switch (grid/list style, matching other pages) that switches between "grouped by category" (current behavior) and "flat list" (all items sorted alphabetically, no category headers). Persist the user's preference in `localStorage`.

2. **"Already owned" clear** — Allow marking an ingredient as already owned, which removes it from the grocery list view entirely. Distinct from "purchased" (which may strikethrough but keep visible). Options:
   - Reuse `is_removed` flag on `grocery_list_items` (currently soft-delete via chat agent)
   - Or add `is_owned boolean default false` column and filter it out of the default view
   - Recommendation: reuse `is_removed = true` with a UI label "Already have it" for this action, since the effect is identical. Verify with Nick before implementing.

### Phase 9 — Settings: Default Recipe Visibility
**Files affected:** `src/pages/Settings.tsx`, `src/services/api.ts`, `supabase/functions/recipe-pipeline/_shared/` (reads the setting at save time)

Add a user setting for default recipe visibility on import: `private` (current hardcoded default), `household`, or `public`. The setting is stored in `user_settings` (or equivalent profile table). The recipe-pipeline edge function reads this setting when persisting a new recipe and applies it as the default `visibility` value. The user can still override per-recipe at save time.

---

## Priority

| Priority | Phase | Item | Effort | Impact |
|----------|-------|------|--------|--------|
| P0 | 4 | Search broken — returns no results | Small | High |
| P0 | 3 | Re-render bug: XML shown instead of recipe card | Small | High |
| P0 | 3 | Save error: "unable to associate with your account" | Small | High |
| P1 | 1 | Unit normalization (piece, stalk, heaping, shorthand, fractions/ranges) | Medium | High |
| P1 | 1 | Ingredient name clipping (feta, ap flour) | Small | Medium |
| P1 | 1 | Instruction noise filter | Small | Medium |
| P1 | 6 | Remove redundant slot confirmation modal | Small | High |
| P2 | 5 | Recipe card icons invisible | Small | Medium |
| P2 | 5 | Click-to-close filter menu | Small | Low |
| P2 | 2 | Post-save recipe link in chat | Small | Medium |
| P2 | 8 | Grocery category toggle + already-owned | Medium | Medium |
| P2 | 9 | Default visibility setting | Small | Medium |
| P3 | 3 | In-chat recipe edit before save (natural language corrections) | Large | Medium |
| P3 | 5 | All-recipes tab audit | Small | Low |
| P3 | 5 | Multi-select + share audit | Small | Low |
| P3 | 7 | Meal title view | Medium | Low |

---

## Deferred to MOP-0033

The following items from the same backlog session require their own planning:

- **Nutrition / calorie display** — Display calories and macro info per recipe; toggle on/off. Requires pipeline extraction changes, schema additions, and UI. Scoped separately.
- **Meal frequency tracking** — Track how often each meal is eaten. Requires analytics infrastructure. Scoped separately.
- **Request meals within family group** — Social feature (send a meal suggestion to another household member). Scoped separately.

---

## Verification

> **Lockticket acceptance criteria.** See [MOP_VERIFICATION_POLICY.md](../prompts/MOP_VERIFICATION_POLICY.md) — **`type: human` is forbidden** (blocks `complete`). Run `/integrity-check` then `/verify-mop MOP-0032`.

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

  - id: search-returns-results
    type: command
    run: npm run test:run -- src/services/__tests__/api.test.ts
    expect_exit: 0

  - id: no-piece-unit-in-transform
    type: grep
    path: supabase/functions/recipe-pipeline
    pattern: "piece"
    expect: present
    note: confirm normalization guard references 'piece'

  - id: unit-shorthand-map-present
    type: grep
    path: supabase/functions/recipe-pipeline
    pattern: "\"c\""
    expect: present
    note: shorthand expansion map includes 'c' → 'cup'

  - id: post-save-recipe-link
    type: grep
    path: supabase/functions/chat-api/tools/handlers.ts
    pattern: "View recipe"
    expect: present

  - id: slot-preselect-no-modal
    type: grep
    path: src/components/meal-planning
    pattern: "slot.*preselect|preselect.*slot|skipSlotPicker|slotAlreadySet"
    expect: present

  - id: grocery-category-toggle
    type: grep
    path: src/components/grocery
    pattern: "categoryView|groupByCategory|flatList"
    expect: present

  - id: default-visibility-setting
    type: grep
    path: src/pages/Settings.tsx
    pattern: "defaultVisibility|default_visibility"
    expect: present
```

## Manual Follow-up (non-blocking)

- [ ] Spot-check unit normalization on 3 real recipes (URL extract, photo extract, text extract)
- [ ] Confirm "already owned" UX label with Nick before shipping Phase 8
- [ ] Verify multi-select share works end-to-end in staging after Phase 5 audit

---

## Acceptance Criteria

- [ ] All `verification` block items pass (`/verify-mop`)
- [ ] `/integrity-check` passes for this MOP's domains
- [ ] Search returns results for known recipe titles
- [ ] Recipe card XML re-render bug is resolved
- [ ] Recipe save error after chat edit is resolved
- [ ] Unit normalization: `piece`, `stalk`, `heaping`, shorthand (`c`, `tsp`, etc.) all handled
- [ ] Fractions (`1/4`) and ranges (`4-6`) accepted and stored as varchar
- [ ] Ingredient names not clipped (feta cheese, all-purpose flour)
- [ ] Post-save chat message includes link to recipe
- [ ] Slot pre-selected from calendar cell — no redundant modal
- [ ] Grocery list category/flat toggle works
- [ ] Default visibility setting persists and is read by pipeline
- [ ] Documentation updated per `/update-docs` procedure
- [ ] CHANGELOG entry added

---

## Related

- **MOPs:** MOP-0001 (Recipe Pipeline Improvements), MOP-0004 (Meal Planner & Grocery Cart), MOP-0018 (AI Tool Catalog Expansion), MOP-0028 (Bulk Recipe Actions)
- **Deferred:** MOP-0033 (Nutrition display, meal frequency tracking, family meal requests)
- **Source:** Nick Neal backlog session 2026-08-24 through 2026-09-27

---

## Notes

Phases 1 and 4 (extraction normalization and search fix) are independent and can be worked in parallel. Phases 2 and 3 are sequentially dependent (post-save link is trivial; in-chat editing is large and should be scoped further before starting). Phase 6 (slot confirmation) is a quick win and should be picked up alongside any Meal Planner session. Phase 8's "already owned" decision (reuse `is_removed` vs new column) needs a quick confirm from Nick before implementation.
