# MOP-0028: Bulk Recipe Actions — Multi-Select Visibility, Folder Assignment, Delete, and Sharing

| Field | Value |
|-------|-------|
| **MOP** | MOP-0028 |
| **Title** | Bulk Recipe Actions — Multi-Select Visibility, Folder Assignment, Delete, and Sharing |
| **Date Submitted** | 2026-09-21 |
| **Date Updated** | 2026-09-21 |
| **Date Completed** | 2026-09-21 |
| **Submitted By** | Nick Neal |
| **Status** | complete |

> Status vocabulary defined in [docs/prompts/MOP_STATUS_LIFECYCLE.md](../prompts/MOP_STATUS_LIFECYCLE.md). Valid values: `draft` / `evaluation` / `approved` / `planned` / `in_progress` / `verifying` / `complete` / `blocked` / `cancelled` / `deferred`.

---

## Summary

Add multi-select mode to the recipe library so users can act on multiple recipes at once. Actions: set visibility in bulk (private / household / public), add selected recipes to a collection, and delete multiple recipes in one confirmation. All bulk writes go through SECURITY DEFINER RPCs (single round trip, atomic, RLS-safe via `auth.uid()`). Replaces the current one-at-a-time flow for visibility changes, collection assignment, and recipe deletion, which is tedious for large libraries.

---

## Scope Map

```
src/components/recipes/RecipeList.tsx
src/components/recipes/RecipeCard.tsx
src/services/api.ts
src/services/__tests__/api.test.ts
supabase/migrations/20260921000000_038_bulk_recipe_actions.sql
docs/API.md
docs/DATA_MODEL.md
docs/CHANGELOG.md
```

---

## Scope of Work

### Phase 1: Multi-select UI
**Files affected:** `src/components/recipes/RecipeList.tsx`, `src/components/recipes/RecipeCard.tsx`

Add `isSelectMode`, `selectedIds` state to `RecipeList`. Pass `isSelected` and `onSelect` props down to `RecipeCard`.

**Entry points:**
- **Desktop:** A checkbox appears in the top-left corner of each card on hover. Clicking it enters select mode and selects that card.
- **Mobile (touch):** Long-press (500ms `pointerdown` timer) on any card enters select mode and selects that card. Use `onPointerDown`/`onPointerUp`/`onPointerCancel` — not `onTouchStart` — so it works on all pointer types.

**Select mode toolbar** (replaces normal toolbar while `selectedIds.size > 0`):
- Count chip: `N selected`
- **Set visibility** button → popover with 3 options (Private / Household / Public)
- **Add to folder** button → collection picker dropdown
- **Delete** button → confirmation dialog ("Delete N recipes? This cannot be undone.")
- **Deselect all** / × to exit select mode

**Card in select mode:**
- Clicking anywhere on the card toggles selection (does NOT navigate to recipe detail)
- Selected state: ring/overlay on card, checkbox checked top-left
- Normal click/nav behavior restored when select mode is off

**Edge cases:**
- Navigating away (route change) exits select mode and clears selection
- Maximum selection: 100 recipes (beyond that, show a toast and stop adding)

### Phase 2: Bulk action RPCs (migration 038)
**Files affected:** `supabase/migrations/20260921000000_038_bulk_recipe_actions.sql`, `src/services/api.ts`

Three `SECURITY DEFINER` RPCs in one migration. All validate `auth.uid()` and operate on arrays.

```sql
-- 1. bulk_update_recipe_visibility
--    Updates visibility for all recipes in the array owned by the caller.
--    Silently skips any IDs the caller does not own (no error).
create or replace function public.bulk_update_recipe_visibility(
  p_recipe_ids uuid[],
  p_visibility text   -- 'private' | 'household' | 'public'
) returns int  -- number of rows updated
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_visibility not in ('private', 'household', 'public') then
    raise exception 'invalid visibility value' using errcode = '22023';
  end if;
  update recipes
    set visibility = p_visibility
    where id = any(p_recipe_ids)
      and user_id = auth.uid();
  return found::int;  -- 1 if any rows updated, 0 otherwise
end; $$;

-- 2. bulk_delete_recipes
--    Deletes all recipes in the array owned by the caller.
--    Silently skips IDs the caller does not own.
create or replace function public.bulk_delete_recipes(
  p_recipe_ids uuid[]
) returns int  -- number of rows deleted
language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  delete from recipes
    where id = any(p_recipe_ids)
      and user_id = auth.uid();
  get diagnostics v_count = row_count;
  return v_count;
end; $$;

-- 3. bulk_add_to_collection
--    Adds all recipe IDs to the target collection.
--    Caller must own the collection. Silently ignores duplicates.
create or replace function public.bulk_add_to_collection(
  p_collection_id uuid,
  p_recipe_ids    uuid[]
) returns int  -- number of rows inserted
language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  -- Verify caller owns the collection
  perform 1 from recipe_collections
    where id = p_collection_id and user_id = auth.uid();
  if not found then
    raise exception 'collection % not found or not owned by caller', p_collection_id
      using errcode = '42501';
  end if;
  insert into collection_recipes (collection_id, recipe_id)
    select p_collection_id, unnest(p_recipe_ids)
    on conflict do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end; $$;
```

**`api.ts` additions** (alongside existing single-recipe methods):
```typescript
bulkUpdateRecipeVisibility(recipeIds: string[], visibility: 'private' | 'household' | 'public'): Promise<number>
bulkDeleteRecipes(recipeIds: string[]): Promise<number>
bulkAddToCollection(collectionId: string, recipeIds: string[]): Promise<number>
```

Plus React Query hooks: `useBulkUpdateRecipeVisibility`, `useBulkDeleteRecipes`, `useBulkAddToCollection`.

> **HARD RULE:** Migration authored locally only — user deploys. Phase 1 UI may land before the migration is deployed (buttons can be wired but no-op on RPC 404 until migration is live).

### Phase 3: Tests
**Files affected:** `src/services/__tests__/api.test.ts`

Cover at minimum:
- `bulkUpdateRecipeVisibility`: happy path (returns row count), rejects invalid visibility value, rejects unauthenticated caller
- `bulkDeleteRecipes`: happy path (returns row count), empty array is a no-op, rejects unauthenticated caller
- `bulkAddToCollection`: happy path, rejects when caller does not own collection, ignores duplicates (no error)
- All three make exactly **one** network call each (RPC, not fan-out)

---

## Priority

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| P1 | Phase 1 — Multi-select UI (RecipeList + RecipeCard) | Medium | High — UX unlock |
| P1 | Phase 2 — Bulk RPCs (migration + api.ts methods) | Small | High — atomic writes |
| P2 | Phase 3 — Tests | Small | Medium |

---

## Verification

```yaml
verification:
  - id: migration-file-present
    type: file-exists
    path: supabase/migrations/20260921000000_038_bulk_recipe_actions.sql

  - id: rpc-visibility-defined
    type: grep
    path: supabase/migrations/20260921000000_038_bulk_recipe_actions.sql
    pattern: 'create or replace function public.bulk_update_recipe_visibility'
    expect: present

  - id: rpc-delete-defined
    type: grep
    path: supabase/migrations/20260921000000_038_bulk_recipe_actions.sql
    pattern: 'create or replace function public.bulk_delete_recipes'
    expect: present

  - id: rpc-collection-defined
    type: grep
    path: supabase/migrations/20260921000000_038_bulk_recipe_actions.sql
    pattern: 'create or replace function public.bulk_add_to_collection'
    expect: present

  - id: rpcs-use-auth-uid
    type: grep
    path: supabase/migrations/20260921000000_038_bulk_recipe_actions.sql
    pattern: 'auth\.uid\(\)'
    expect: present

  - id: api-bulk-visibility-uses-rpc
    type: grep
    path: src/services/api.ts
    pattern: "supabase\\.rpc.*bulk_update_recipe_visibility"
    expect: present

  - id: api-bulk-delete-uses-rpc
    type: grep
    path: src/services/api.ts
    pattern: "supabase\\.rpc.*bulk_delete_recipes"
    expect: present

  - id: api-bulk-collection-uses-rpc
    type: grep
    path: src/services/api.ts
    pattern: "supabase\\.rpc.*bulk_add_to_collection"
    expect: present

  - id: select-mode-state-in-recipe-list
    type: grep
    path: src/components/recipes/RecipeList.tsx
    pattern: 'isSelectMode|selectedIds'
    expect: present

  - id: card-accepts-select-props
    type: grep
    path: src/components/recipes/RecipeCard.tsx
    pattern: 'isSelected|onSelect'
    expect: present

  - id: tests-pass
    type: command
    run: npm test -- src/services/__tests__/api.test.ts
    expect_exit: 0

  - id: lint-clean
    type: command
    run: npm run lint
    expect_exit: 0

  - id: build-clean
    type: command
    run: npm run build
    expect_exit: 0
```

## Manual Follow-up (non-blocking)

- [ ] **UX smoke test**: enter select mode on desktop (hover+click checkbox) and mobile (long-press); confirm toolbar appears, actions fire correctly, exit via × works
- [ ] **Bulk delete confirmation**: verify the "Delete N recipes?" dialog is shown and cannot be bypassed
- [ ] **Post-migration deploy smoke**: verify all 3 RPCs are callable against the remote DB after migration 038 is deployed

---

## Acceptance Criteria

- [ ] All `verification` block items pass (`/verify-mop`)
- [ ] Multi-select mode enters on desktop hover-checkbox-click and mobile long-press (500ms)
- [ ] Select mode toolbar shows count + Visibility / Add to folder / Delete / × buttons
- [ ] Bulk visibility change, bulk add-to-collection, and bulk delete each issue exactly one `supabase.rpc()` call
- [ ] Delete requires confirmation dialog; cancelled delete leaves recipes untouched
- [ ] Existing per-recipe `deleteRecipe`, `updateRecipeVisibility`, `addRecipeToCollection` flows unchanged
- [ ] Maximum 100 recipes selectable at once (enforced in UI)
- [ ] Migration 038 authored locally; user deploys before RPC calls go live
- [ ] Documentation updated per `/update-docs` procedure
- [ ] CHANGELOG entry added
- [ ] No remote DB push performed by Claude

---

## Related

- **ADRs:** none
- **MOPs:** MOP-0002 (recipe visibility + collections schema), MOP-0007 (search bar — search results are a likely selection surface), MOP-0014 (SECURITY DEFINER RPC pattern precedent)
- **Audit / source:** User request 2026-09-21

---

## Notes

- `bulk_delete_recipes` silently skips recipes the caller doesn't own rather than erroring — consistent with the principle that bulk operations shouldn't fail noisily on partial ownership. The return count tells the caller how many were actually deleted.
- `bulk_add_to_collection` uses `ON CONFLICT DO NOTHING` so re-adding already-added recipes is safe.
- Long-press is implemented via `onPointerDown` + a 500ms `setTimeout` that is cancelled on `onPointerUp` / `onPointerCancel`. Do not use `onTouchStart` — it doesn't fire on trackpad long-press on hybrid devices.
- Phase 1 UI can be merged before migration 038 is deployed. The RPC calls will 404 cleanly; the `onError` handlers should show a toast ("Bulk actions require a database update — please contact the admin"). This is the same deploy-gate pattern as MOP-0014.
