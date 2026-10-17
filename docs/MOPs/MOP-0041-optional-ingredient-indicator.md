# MOP-0041: Optional Ingredient Indicator

| Field | Value |
|-------|-------|
| **MOP** | MOP-0041 |
| **Title** | Optional Ingredient Indicator |
| **Date Submitted** | 2026-10-16 |
| **Date Updated** | 2026-10-16 |
| **Date Completed** | — |
| **Submitted By** | surface-reviewer |
| **Status** | draft |

> Status vocabulary defined in [docs/prompts/MOP_STATUS_LIFECYCLE.md](../prompts/MOP_STATUS_LIFECYCLE.md). Valid values: `draft` / `evaluation` / `approved` / `planned` / `in_progress` / `verifying` / `complete` / `blocked` / `cancelled` / `deferred`.

---

## Summary

Ingredients like "freshly chopped parsley, if desired" extract with no indicator anywhere in the UI that they're optional — the "if desired"/"optional" qualifier either gets dropped or (after the sibling `notes`-rendering fix) shows as muted text under the name, but nothing lets a shopper quickly see "I can skip this at the store" or lets the grocery cart treat it differently. This MOP adds a dedicated `optional?: boolean` field to the ingredient shape — not a text convention like prefixing "(Optional)" into the ingredient name — because a boolean is machine-usable (grocery cart can skip/uncheck by default) where a name-embedded string is not, and because prefixing the name would corrupt every exact-match consumer of ingredient names (duplicate-detection, grocery aggregation, allergy-checker substring matching, embeddings/RAG).

---

## Scope Map

```
supabase/functions/_shared/recipe-schema.ts
supabase/functions/_shared/recipe-prompts.ts
supabase/functions/recipe-pipeline/stages/extract.ts
supabase/functions/recipe-pipeline/stages/transform.ts
src/types/index.ts
src/components/recipes/RecipeDetail.tsx
src/components/recipes/RecipeForm.tsx
src/components/chat/StructuredRecipeDisplay.tsx
src/utils/ingredientAggregator.ts
```

---

## Scope of Work

### Phase 1: Schema + extraction
**Files affected:** `_shared/recipe-schema.ts`, `_shared/recipe-prompts.ts`, `recipe-pipeline/stages/extract.ts`, `recipe-pipeline/stages/transform.ts`, `src/types/index.ts`

- Add `optional?: boolean` to the `Ingredient` interface in `recipe-schema.ts` and the frontend `Ingredient` in `src/types/index.ts`.
- No SQL migration needed — ingredients live in the `recipes.ingredients` JSONB column and pass through `load.ts` as-is; a new key is additive.
- Extend `RECIPE_FIELD_RULES` (`recipe-prompts.ts`) with a rule: ingredient lines containing "if desired," "optional," "to taste [as optional]," or similar set `optional: true` on that ingredient. Decide during planning whether "to taste" (salt/pepper) itself implies `optional: true` or is a separate concept (an ingredient can be required but have a to-taste quantity — e.g., salt is usually not skippable, just unmeasured). Recommendation: keep them separate; `optional` means "can be omitted entirely," `notes` carries the "to taste"/sizing text regardless.
- `transform.ts` passthrough: confirm `optional` survives normalization unchanged (same treatment as `notes`).

### Phase 2: Display
**Files affected:** `RecipeDetail.tsx`, `StructuredRecipeDisplay.tsx`

- `RecipeDetail.tsx`: when `ingredient.optional` is true, show a small muted "optional" tag/badge after the ingredient name (not a new column — per the user's own framing of the question, a dedicated column is unnecessary for a single boolean flag on an already-compact row).
- `StructuredRecipeDisplay.tsx` (chat preview): same treatment, sized for the more compact row.
- Keep `notes` rendering (shipped ahead of this MOP, see the 2026-10-16 ingredient-notes display fix) separate from the `optional` tag — `optional` answers "can I skip it," `notes` carries the qualifier text ("if desired," "to taste," container size). Don't collapse them into one field.

### Phase 3: Manual entry + editing
**Files affected:** `RecipeForm.tsx`

- Add an "Optional" checkbox/toggle per ingredient row in the manual add/edit form, wired to the new `optional` field.
- Audit `RecipeForm.tsx`'s existing custom-unit convention (qualifier stored directly in `unit`, e.g. `unit: "optional"` per the recipe-pipeline-sme diagnosis at `RecipeForm.tsx:359,698`) — decide whether to migrate that convention onto the new boolean field or leave it as a distinct legacy path. Recommendation: migrate, since having both a text-convention and a boolean-field path for the same concept re-creates the exact drift bug this MOP exists to fix.

### Phase 4: Grocery cart integration
**Files affected:** `src/utils/ingredientAggregator.ts`, grocery cart UI

- Grocery list generation should either exclude optional ingredients by default (with a UI toggle to include them) or include them with a visible "optional" marker in the cart itself. Decide during planning — this is the actual payoff of using a boolean over a text convention.

---

## Priority

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| P1 | Phase 1 — schema + extraction | Small | High — unblocks everything else |
| P1 | Phase 2 — display | Small | High — the user-visible payoff |
| P2 | Phase 3 — manual entry + editing | Small–Medium | Medium |
| P2 | Phase 4 — grocery cart integration | Small–Medium | Medium — the actual functional payoff of choosing a boolean field |

---

## Verification

> **Lockticket acceptance criteria.** See [MOP_VERIFICATION_POLICY.md](../prompts/MOP_VERIFICATION_POLICY.md) — **`type: human` is forbidden** (blocks `complete`). Route domain tests via [DOMAIN_TEST_MATRIX.md](../prompts/DOMAIN_TEST_MATRIX.md). Run `/integrity-check` then `/verify-mop MOP-0041`.

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

  - id: optional-field-in-schema
    type: grep
    file: supabase/functions/_shared/recipe-schema.ts
    pattern: 'optional\?:\s*boolean'
    expect: present

  - id: optional-field-in-frontend-type
    type: grep
    file: src/types/index.ts
    pattern: 'optional\?:\s*boolean'
    expect: present

  - id: edge-tests
    type: command
    run: npm run test:edge
    expect_exit: 0
```

Allowed assertion types: `file-exists`, `grep`, `command`, `test-passes`. **Not allowed:** `human`.

## Manual Follow-up (non-blocking)

> Optional human review **after** `complete`. Never gates status.

- [ ] Visual review: optional tag reads clearly in both light and dark mode, doesn't visually compete with the `notes` muted text when both are present on the same ingredient
- [ ] Spot-check a handful of real extracted recipes with "if desired"/"optional" phrasing to confirm the prompt rule fires correctly

---

## Acceptance Criteria

- [ ] All `verification` block items pass (`/verify-mop`)
- [ ] `/integrity-check` passes for this MOP's domains (recipe-pipeline, recipes-library)
- [ ] `optional?: boolean` exists on both the backend `_shared/recipe-schema.ts` `Ingredient` and frontend `src/types/index.ts` `Ingredient`
- [ ] Extraction sets `optional: true` for ingredients with "if desired"/"optional" phrasing in the source text
- [ ] RecipeDetail and the chat preview both show a visible optional indicator, distinct from the `notes` qualifier text
- [ ] Manual entry (RecipeForm) can set/unset the optional flag per ingredient
- [ ] Grocery cart aggregation has an explicit, documented behavior for optional ingredients (exclude-by-default-with-toggle, or include-with-marker — planning decides which)
- [ ] Documentation updated per `/update-docs` procedure
- [ ] CHANGELOG entry added

---

## Related

- **ADRs:** none yet. The shopping-unit-vs-total-size decision for container sizes (a related but distinct finding) was scoped to MOP-0034 Phase 5c instead, as a MOP-internal note rather than a standalone ADR, since it's a single prompt-rule decision — the same reasoning applies here: no ADR needed unless the optional-vs-notes field boundary decision turns out to be contested or revisited.
- **MOPs:** related to [MOP-0034](MOP-0034-screenshot-extraction-accuracy.md) Phase 5c (container-size loss, found in the same diagnosis session) and the 2026-10-16 ingredient-`notes`-display fix (shipped ahead of this MOP, outside any MOP — a quick frontend-only bug fix). **Naming collision risk:** [MOP-0038](MOP-0038-recipe-notes-and-chat-driven-draft-editing.md) Phase 1 adds a **recipe-level** `notes` column and explicitly scopes out per-ingredient annotation (`MOP-0038:72`). This MOP's `optional` field and the existing per-ingredient `notes` field are a different, already-shipped concept — keep the two `notes` concepts (recipe-level vs. per-ingredient) clearly distinguished in types and the API mapper when both MOPs are in flight.
- **Audit / source:** recipe-pipeline-sme diagnosis, 2026-10-16, from a user-reported screenshot showing "freshly chopped parsley, if desired" with no optional indicator anywhere in the UI.

---

## Notes

- The existing `RecipeForm.tsx` convention of storing a qualifier directly in `unit` (e.g. `unit: "optional"`, `unit: "to taste"`) for manually-entered ingredients is a second, independent place "optional" currently gets represented, alongside the now-shipped `notes`-based convention from LLM extraction. Phase 3 should resolve this drift, not add a third representation.
- `NO_AMOUNT_PATTERNS` in `extract.ts` already treats "optional" as a no-amount-producing note (per recipe-pipeline-sme's citation at `extract.ts:607`) — Phase 1 should reuse or extend this detection rather than duplicating a separate "is this optional" text-matching pass.
