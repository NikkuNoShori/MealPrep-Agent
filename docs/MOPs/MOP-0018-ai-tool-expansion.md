# MOP-0018: AI Tool Catalog Expansion — Save, Grocery, Household, Reactions

| Field | Value |
|-------|-------|
| **MOP** | MOP-0018 |
| **Title** | AI Tool Catalog Expansion — Save, Grocery, Household, Reactions |
| **Date Submitted** | 2026-09-04 |
| **Date Updated** | 2026-09-05 |
| **Date Completed** | 2026-09-05 |
| **Submitted By** | Nick Neal |
| **Status** | complete |

> Status vocabulary defined in [docs/prompts/MOP_STATUS_LIFECYCLE.md](../prompts/MOP_STATUS_LIFECYCLE.md).

---

## Summary

The AI chat agent can extract recipes from any source but cannot save them. It can add grocery items but cannot read or manage the list. It cannot create meal plans, react to recipes, or check allergen safety. This MOP closes those gaps systematically, starting with `save_recipe` (P0 MVP blocker) and working down the CRUD matrix.

**Reference artifact:** [AI Tool Catalog](https://claude.ai/code/artifact/f8a8ac09-c17a-4eb7-b604-3d5e228f1baa) — full inventory, CRUD gap analysis, priority ranking, scaling architecture, and security model.

---

## Why

Full user journey coverage requires the agent to complete 8 touchpoints:
1. Discover → **live** (search_recipes, get_household_recipes, find_similar_recipes)
2. Intake → **live** (extract_recipe_from_source, web_search_recipe)
3. **Save** → **MISSING** — agent can extract but never persist (P0)
4. Organize → partial (update_recipe, delete_recipe, is_favorite via update)
5. Plan → partial (get_meal_plan, assign_slot — cannot create plan or clear slot)
6. **Shop** → **MISSING read** — agent cannot see the list it manages
7. Cook → live (propose_substitution)
8. **Share/Safety** → **MISSING** — no allergen check, no reaction tools

---

## Scope Map

```
supabase/functions/chat-api/tools/
  save_recipe.ts              (new — P0)
  get_recipe.ts               (new — P1)
  create_meal_plan.ts         (new — P1)
  clear_meal_plan_slot.ts     (new — P1)
  get_grocery_list.ts         (new — P1)
  mark_grocery_item_purchased.ts (new — P2)
  remove_grocery_item.ts      (new — P2)
  check_recipe_safety.ts      (new — P0, called internally by extract too)
  update_member_allergens.ts  (new — P2)
  react_to_recipe.ts          (new — P2)
  get_recommendations.ts      (new — P2)
  scale_recipe.ts             (new — P2)
  dispatch.ts                 (register new tools)
  catalog.ts                  (add tool definitions to schema catalog)
supabase/functions/chat-api/agent-loop.ts
  (hook check_recipe_safety into extraction result post-processing)
supabase/functions/_shared/recipe-prompts.ts
  (update CHAT_AGENT_SYSTEM_PROMPT with new tool guidance)
```

Domain: `chat`, `recipes`, `grocery`, `household` per DOMAIN_TEST_MATRIX.md.

---

## Phase 1: `save_recipe` — **in_progress** (MVP blocker)

### What it does
- Accepts the recipe object returned by `extract_recipe_from_source` (or user-edited version)
- Runs server-side duplicate title check (exact + similarity)
- If duplicate detected: returns `{ status: "duplicate", existing_recipe_id, existing_title }` — agent surfaces to user for confirmation
- On confirm: inserts into `recipes` table, triggers embedding via `needs_reembed = true`
- Returns `{ status: "saved", recipe_id, title }`

### Tool schema
```typescript
{
  name: "save_recipe",
  description: "Save an extracted recipe to the library. Runs duplicate check first. Call only after extract_recipe_from_source returns a recipe the user wants to keep.",
  parameters: {
    type: "object",
    properties: {
      recipe: {
        type: "object",
        description: "The recipe object from extract_recipe_from_source. Must include title and ingredients.",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          ingredients: { type: "array", items: { type: "object" } },
          instructions: { type: "array", items: { type: "string" } },
          prepTime: { type: "number" },
          cookTime: { type: "number" },
          totalTime: { type: "number" },
          servings: { type: "number" },
          difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
          tags: { type: "array", items: { type: "string" } },
          cuisine: { type: "string" },
          source_url: { type: "string" },
          image_url: { type: "string" }
        },
        required: ["title", "ingredients"]
      },
      override_duplicate: {
        type: "boolean",
        description: "Pass true only after user confirms they want to save despite a detected duplicate.",
        default: false
      }
    },
    required: ["recipe"],
    additionalProperties: false
  }
}
```

### Security
- auth.uid() resolved from JWT — never accepted as argument
- RLS on recipes table enforces household scope
- Duplicate check runs via `search_recipes_semantic` RPC with similarity threshold 0.92
- Tool marked `destructive: false` (save is not destructive) — no confirmation gate, but duplicate prompts are rendered by the handler

---

## Phase 2: `check_recipe_safety` (P0 — proactive allergen check)

### What it does
- Calls `get_household_profile` internally (or accepts pre-fetched profile)
- Cross-references recipe ingredients against each member's `allergens` array
- Returns per-member warnings:
  ```json
  {
    "safe": false,
    "warnings": [
      { "member": "Alex", "allergens": ["peanuts"], "matched_ingredients": ["peanut oil"] }
    ]
  }
  ```
- Hooked into `extract_recipe_from_source` return path in agent-loop.ts — always runs post-extraction

### Agent prompt addition
```
- After extract_recipe_from_source returns a recipe, ALWAYS call check_recipe_safety. If warnings are present, surface them in **bold** before the save prompt: "⚠️ **ALLERGEN WARNING: This recipe contains peanuts, which Alex is allergic to. Double-check labels before serving.**"
```

---

## Phase 3: Grocery tools (P1)

### `get_grocery_list`
- Reads `meal_plans.grocery_list` JSONB for the active or specified plan
- Returns items with name, amount, unit, category, purchased status
- Read-only, no confirmation required

### `mark_grocery_item_purchased`
- Toggles `purchased: true/false` on a named item
- No confirmation (non-destructive toggle)

### `remove_grocery_item`
- Removes item by name or index from grocery_list JSONB
- Single item: immediate. Bulk (>3 items): confirmation gate

---

## Phase 4: Meal plan tools (P1)

### `create_meal_plan`
- Creates a new row in `meal_plans` with name, start_date, end_date, status: 'draft'
- Returns the new plan_id for chaining

### `clear_meal_plan_slot`
- Removes the recipe from a specific date + slot_type
- Single slot: immediate with soft warning. No hard confirmation (reversible via assign)

---

## Phase 5: Reaction + recommendation tools (P2)

### `react_to_recipe`
- Upserts a row in `recipe_reactions` for (recipe_id, family_member_id, reaction: 'like'|'dislike'|'neutral')
- Confirmation: "Mark this as liked for [member]?" — soft confirm in agent text

### `get_recommendations`
- Query `recipe_reactions` joined to `recipes` for the household or a named member
- Accepts: `{ member_name?: string, reaction?: 'like'|'dislike', limit?: number }`
- Returns ranked recipe list

---

## Phase 6: Household profile tools (P2)

### `update_member_allergens`
- Updates `family_members.allergens` array — add or remove allergens for a named member
- **Always destructive: true** — confirmation gate required
- Returns diff of what changed

---

## Security Checklist (all new tools)

- [ ] No user_id / household_id accepted as args — resolved server-side
- [ ] RLS enforced on all underlying tables (recipes, meal_plans, family_members, recipe_reactions)
- [ ] Destructive writes marked `destructive: true` in dispatch catalog
- [ ] JSON Schema `additionalProperties: false` on all tool param objects
- [ ] Rate limit: 20 AI-initiated writes per user per minute (to add in dispatch middleware — Gap)
- [ ] Audit log entry on every write (recipes, meal_plans, reactions) — future MOP

---

## Priority Table

| Phase | Tools | Priority | Effort |
|-------|-------|----------|--------|
| 1 | save_recipe | P0 (MVP) | M |
| 2 | check_recipe_safety | P0 (MVP) | S |
| 3 | get_grocery_list, mark_purchased, remove_item | P1 | S |
| 4 | create_meal_plan, clear_slot | P1 | S |
| 5 | react_to_recipe, get_recommendations | P2 | M |
| 6 | update_member_allergens, scale_recipe | P2 | S |

---

## Scaling Architecture Decision

**Chosen pattern:** Flat atomic tools (one function per action) + intent-gated exposure. At 26 total tools this remains inside the single-agent sweet spot. Tool names are domain-namespaced (`recipe_*`, `plan_*`, `grocery_*`, `household_*`) so the catalog self-documents. Compound action tools and a supervisor/specialist architecture are deferred until tool count exceeds 40.

---

## Verification

```yaml
verification:
  - id: save-recipe-handler-exists
    type: grep
    path: supabase/functions/chat-api/tools/handlers.ts
    pattern: 'save_recipe'
    expect: present

  - id: save-recipe-in-catalog
    type: grep
    path: supabase/functions/chat-api/tools/catalog.ts
    pattern: 'name: "save_recipe"'
    expect: present

  - id: grocery-tools-in-catalog
    type: grep
    path: supabase/functions/chat-api/tools/catalog.ts
    pattern: 'name: "get_grocery_list"'
    expect: present

  - id: check-safety-in-catalog
    type: grep
    path: supabase/functions/chat-api/tools/catalog.ts
    pattern: 'name: "check_recipe_safety"'
    expect: present

  - id: scale-recipe-in-catalog
    type: grep
    path: supabase/functions/chat-api/tools/catalog.ts
    pattern: 'name: "scale_recipe"'
    expect: present

  - id: lint-clean
    type: command
    run: npm run lint
    expect_exit: 0

  - id: build-clean
    type: command
    run: npm run build
    expect_exit: 0
```

---

## Acceptance Criteria

- [ ] All verification block items pass
- [ ] User can say "save this recipe" after extraction and agent saves it
- [ ] Duplicate recipes prompt confirmation before overwrite
- [ ] Allergen warnings appear automatically on extraction for affected household members
- [ ] User can ask "what's on my grocery list?" and receive the current list
- [ ] User can ask "mark milk as purchased" and the item is checked off
- [ ] User can say "Mark this recipe as one the kids love" and reaction is recorded
- [ ] `check_recipe_safety` is called by the agent on every recipe extraction, not only on explicit request
- [ ] CHANGELOG entry added

---

## Related

- **Reference artifact:** https://claude.ai/code/artifact/f8a8ac09-c17a-4eb7-b604-3d5e228f1baa
- **MOPs:** MOP-0003 (allergen detection — overlaps Phase 2), MOP-0007 (reactions as ranking signal — overlaps Phase 5), MOP-0008 (chat agent foundation)
- **SMEs:** `cooking-bot-architect` for tool schema review, `chat-rag-sme` for agent loop integration, `meal-planning-sme` for grocery and plan tool behavior
