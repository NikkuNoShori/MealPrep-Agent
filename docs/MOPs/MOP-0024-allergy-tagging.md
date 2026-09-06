# MOP-0024: Automatic Allergy Tagging on Recipe Import

| Field | Value |
|-------|-------|
| **MOP** | MOP-0024 |
| **Title** | Automatic Allergy Tagging on Recipe Import |
| **Date Submitted** | 2026-09-05 |
| **Date Updated** | 2026-09-05 |
| **Date Completed** | — |
| **Submitted By** | Nick Neal |
| **Status** | draft |

> Status vocabulary defined in [docs/prompts/MOP_STATUS_LIFECYCLE.md](../prompts/MOP_STATUS_LIFECYCLE.md).

---

## Summary

When a recipe is imported (via URL, text, video, or batch), its ingredients are automatically checked against every household member's allergy profile. Any match results in the recipe being tagged with `{MemberName} Allergy` (e.g., `Emma Allergy`) and the universal `ALLERGY WARNING` tag. These tags propagate to the recipe library and are consumed by the randomizer (MOP-0023) to exclude unsafe recipes from automated assignments. This MOP also covers the household allergy profile data model (if not already present from MOP-0003) and a UI to manage per-member allergies.

---

## Scope Map

```
supabase/functions/recipe-pipeline/stages/
supabase/functions/_shared/
supabase/migrations/
src/pages/Settings.tsx
src/components/household/
src/services/api.ts
src/types/
docs/
```

---

## Scope of Work

### Phase 1: Allergy profile data model
**Files affected:** `supabase/migrations/NNNN_allergy_profiles.sql` (write, do not deploy), `src/types/household.ts`

Check MOP-0003 (Dietary Profiles & Allergen Detection) — it is in `draft` status and may already specify this schema. If so, extract and implement just the allergy-list portion (not the full dietary profile system). 

Target schema addition on `family_members`:
```sql
allergies text[] DEFAULT '{}'  -- e.g. ['peanuts', 'tree nuts', 'shellfish', 'gluten']
```

Common allergy taxonomy (align with FDA Big-9): milk, eggs, fish, shellfish, tree nuts, peanuts, wheat, soybeans, sesame. Store as lowercase strings. Free-text entries allowed alongside the taxonomy.

RLS: household members can read all family member allergies in their household; only the household owner (or the profile owner) can write.

### Phase 2: Allergy management UI
**Files affected:** `src/pages/Settings.tsx`, `src/components/household/AllergyManager.tsx` (new)

In the Household section of Settings, show each family member with an editable allergy list:
- Chip-style multi-select from the FDA Big-9 taxonomy
- Free-text "add other" input for non-standard allergens
- Save button per member (or auto-save on blur)

Also show the user's own allergy profile (as a `family_members` row or on their `profiles` row — resolve during Phase 1 schema work).

### Phase 3: Allergy check in the recipe pipeline
**Files affected:** `supabase/functions/recipe-pipeline/stages/load.ts`, `supabase/functions/_shared/allergy-checker.ts` (new)

In the `load` stage (after transform, before INSERT), query `family_members.allergies` for all members in the recipe owner's household. Run `checkAllergies(ingredients, allergyProfiles)`:

```typescript
// _shared/allergy-checker.ts
export function checkAllergies(
  ingredients: { name: string; notes?: string }[],
  profiles: { memberName: string; allergies: string[] }[]
): { tags: string[]; warnings: string[] }
```

Logic: for each member, scan ingredient names + notes for each of their allergens (case-insensitive substring match, with a small synonym map: "peanut butter" → peanuts, "cream" → milk, etc.). If any match:
- Add `{MemberName} Allergy` to tags
- Add `ALLERGY WARNING` to tags (deduplicated)

Return the additional tags; the load stage merges them into the recipe's tag array before INSERT.

### Phase 4: Retroactive scan (existing library)
**Files affected:** `supabase/functions/allergy-scan/index.ts` (new one-shot edge function)

A callable edge function that scans all of a user's existing recipes against their current household allergy profiles and updates tags. Triggered from Settings with a "Re-scan my library for allergies" button. Rate-limited: one execution per hour per user. This is a one-shot administrative operation, not a background job.

### Phase 5: Allergy tag display in recipe library and card
**Files affected:** `src/components/recipes/RecipeCard.tsx`, `src/pages/Recipes.tsx`

Recipes tagged `ALLERGY WARNING` display a distinct visual indicator in the recipe card (red/amber banner or badge). The specific member name tags (`Emma Allergy`) are shown on the recipe detail page. Filtering: add an "Allergy-safe" toggle to the recipe library that hides all `ALLERGY WARNING` recipes (off by default — visibility of allergy items is the user's choice).

---

## Priority

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| P0 | Phase 3 — allergy check in pipeline | Medium | High |
| P0 | Phase 1 — data model | Small | High |
| P1 | Phase 2 — allergy management UI | Medium | High |
| P1 | Phase 5 — allergy tag display | Small | High |
| P2 | Phase 4 — retroactive scan | Medium | Medium |

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

  - id: allergy-checker-exists
    type: file-exists
    path: supabase/functions/_shared/allergy-checker.ts

  - id: allergy-warning-tag-applied
    type: grep
    path: supabase/functions/_shared/allergy-checker.ts
    pattern: "ALLERGY WARNING"
    expect: present

  - id: allergy-checker-unit-tests
    type: command
    run: npm run test:run -- src/__tests__/allergy-checker.test.ts
    expect_exit: 0

  - id: migration-file-exists
    type: grep
    path: supabase/migrations
    pattern: "allergies"
    expect: present
```

## Manual Follow-up (non-blocking)

- [ ] QA: import a recipe containing "peanut butter" with a household member allergic to peanuts — confirm `ALLERGY WARNING` and `{Name} Allergy` tags appear
- [ ] QA: recipe with no allergen matches receives no allergy tags
- [ ] Review synonym map coverage for the FDA Big-9

---

## Acceptance Criteria

- [ ] All `verification` block items pass
- [ ] `family_members.allergies` column exists in migration (not deployed — user deploys)
- [ ] Allergy manager UI saves and reads per-member allergy lists
- [ ] Pipeline load stage calls `checkAllergies` and merges tags before INSERT
- [ ] Recipe imported with matching ingredient is tagged `ALLERGY WARNING` + `{Name} Allergy`
- [ ] Recipe card shows allergy warning badge when tagged
- [ ] Retroactive scan button in Settings triggers the one-shot function
- [ ] Documentation updated per `/update-docs`
- [ ] CHANGELOG entry added

---

## Related

- **MOPs:** MOP-0003 (Dietary Profiles & Allergen Detection — review before Phase 1 to avoid schema conflicts), MOP-0023 (randomizer consumes `ALLERGY WARNING` tag), MOP-0021 (multi-week view — allergy badge visible in planner cells in a future pass)
- **Blocked by:** Nothing — can start with Phase 1 immediately, but coordinate with MOP-0003 owner on schema

---

## Notes

The allergy check runs in the Deno edge function (recipe-pipeline) which has service-role Supabase access, so querying `family_members` is straightforward. The synonym map for ingredient name → allergen matching is the main accuracy risk — start with exact substring match and expand from real-world false-negative reports. Never suppress a potential match (false positives are acceptable; false negatives are a safety issue). The `ALLERGY WARNING` tag is the canonical exclusion signal; member-specific tags are informational.
