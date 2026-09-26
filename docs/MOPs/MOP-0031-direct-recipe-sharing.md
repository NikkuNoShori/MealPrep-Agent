# MOP-0031: Direct Recipe Sharing

| Field | Value |
|-------|-------|
| **MOP** | MOP-0031 |
| **Title** | Direct Recipe Sharing |
| **Date Submitted** | 2026-09-22 |
| **Date Updated** | 2026-09-25 |
| **Date Completed** | 2026-09-25 |
| **Submitted By** | Nick Neal |
| **Status** | complete |

> Status vocabulary defined in [docs/prompts/MOP_STATUS_LIFECYCLE.md](../prompts/MOP_STATUS_LIFECYCLE.md). Valid values: `draft` / `evaluation` / `approved` / `planned` / `in_progress` / `verifying` / `complete` / `blocked` / `cancelled` / `deferred`.

---

## Summary

Add user-to-user direct recipe sharing without requiring a social graph. A user can share any of their recipes with another user by username or email lookup; the recipient gets an in-app notification and sees the shared recipe in a dedicated "Shared with me" section in the recipe library. Sharing is tracked in a `recipe_shares` junction table that supports read-state tracking and clean RLS enforcement.

---

## Scope Map

```
supabase/migrations/             (new recipe_shares table + RLS + RPCs)
src/services/api.ts              (share, unshare, list-shared-with-me endpoints)
src/pages/Recipes.tsx            (Shared with me tab/section)
src/components/recipe/           (share dialog, shared badge)
docs/DATA_MODEL.md
docs/API.md
```

---

## Scope of Work

### Phase 1: [Data model]
**Files affected:** `supabase/migrations/`

[New `recipe_shares` table: `(id, recipe_id, shared_by_user_id, shared_with_user_id, shared_at, seen_at)`. RLS: owner can insert/delete; recipient can SELECT and UPDATE `seen_at`. SECURITY DEFINER RPCs: `share_recipe(recipe_id, target_username_or_email)`, `unshare_recipe(recipe_id, shared_with_user_id)`, `mark_share_seen(share_id)`. Recipient lookup by username or email against `profiles`.]

### Phase 2: [API layer]
**Files affected:** `src/services/api.ts`

[`shareRecipe()`, `unshareRecipe()`, `getSharedWithMe()` — list shares where `shared_with_user_id = auth.uid()`, ordered by `shared_at desc`. `getUnseenShareCount()` for badge. All via RPC or supabase client; no raw `user_id` filters.]

### Phase 3: [Recipe library UI — "Shared with me" section]
**Files affected:** `src/pages/Recipes.tsx`, `src/components/recipe/`

[New feed mode tab "Shared with me" in the recipe library alongside My Recipes / Household / Public. Shows recipes shared directly with the current user. Badge on the tab for unseen count. Clicking a recipe marks the share as seen. Share dialog on recipe cards/detail page (owner only): search by username or email, confirm, send.]

---

## Priority

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| P0 | Phase 1 — data model + RLS + RPCs | Small | High |
| P1 | Phase 2 — API layer | Small | High |
| P2 | Phase 3 — recipe library UI | Medium | High |

---

## Verification

> **Lockticket acceptance criteria.** See [MOP_VERIFICATION_POLICY.md](../prompts/MOP_VERIFICATION_POLICY.md) — **`type: human` is forbidden** (blocks `complete`). Route domain tests via [DOMAIN_TEST_MATRIX.md](../prompts/DOMAIN_TEST_MATRIX.md). Run `/integrity-check` then `/verify-mop MOP-0031`.

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

  - id: recipe-shares-migration-exists
    type: file-exists
    path: supabase/migrations/

  - id: share-recipe-rpc-exists
    type: grep
    path: supabase/migrations/
    pattern: share_recipe
    expect: present

  - id: recipe-shares-rls-enabled
    type: grep
    path: supabase/migrations/
    pattern: recipe_shares
    expect: present

  - id: api-share-methods-exist
    type: grep
    path: src/services/api.ts
    pattern: shareRecipe|getSharedWithMe
    expect: present
```

## Manual Follow-up (non-blocking)

- [ ] Smoke test: share a recipe with a second test account and confirm it appears in "Shared with me"
- [ ] Confirm unseen badge clears on open
- [ ] Confirm owner can revoke a share and it disappears from recipient's list

---

## Acceptance Criteria

- [ ] All `verification` block items pass (`/verify-mop`)
- [ ] `/integrity-check` passes for this MOP's domains
- [ ] `recipe_shares` table exists with RLS enabled
- [ ] Sharing does not require a pre-existing follow/friend relationship
- [ ] Recipient lookup works by username and by email
- [ ] "Shared with me" feed mode visible in recipe library
- [ ] Unseen share count badge shown on tab
- [ ] Documentation updated per `/update-docs` procedure
- [ ] CHANGELOG entry added

---

## Related

- **ADRs:** none yet
- **MOPs:** none blocking
- **Audit / source:** mentioned 2026-09-21 during MOP-0028 session — user tried to share a recipe that wasn't public and got a 406

---

## Notes

No social graph (friends/follows) required for this MOP. Sharing is lookup-based: the sharer searches for the recipient by username or email at share time. A future MOP can add a follows graph and surface "people I follow" as quick-pick targets in the share dialog.

The `recipe_shares` table does not affect recipe visibility on the existing RLS policy — shared recipes appear in the recipient's "Shared with me" feed via a direct join on `recipe_shares`, not by relaxing the main recipes SELECT policy.
