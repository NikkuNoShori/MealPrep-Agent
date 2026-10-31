# MOP-0044: Single Household Membership — Deterministic Lookup, Invite-Accept Cleanup, UNIQUE(user_id)

| Field | Value |
|-------|-------|
| **MOP** | MOP-0044 |
| **Title** | Single Household Membership — Deterministic Lookup, Invite-Accept Cleanup, UNIQUE(user_id) |
| **Date Submitted** | 2026-10-30 |
| **Date Updated** | 2026-10-30 |
| **Date Completed** | — |
| **Submitted By** | surface-reviewer |
| **Status** | draft |

> Status vocabulary defined in [docs/prompts/MOP_STATUS_LIFECYCLE.md](../prompts/MOP_STATUS_LIFECYCLE.md).

---

## Summary

Accepting a household invite adds the user to the inviting household but never removes their auto-created solo household. Three RPCs then choose "the" household with `LIMIT 1` and no `ORDER BY`, so for an invited user the Household page, the Household recipe feed and the dashboard count can show the wrong (solo) household. They can also disagree with each other and with RLS, which allows any shared household. This is live in production for this project's own household (a second member joined by invite).

This MOP makes the lookup deterministic now (Phase 1), fixes the accept paths (Phase 2), cleans up existing data and enforces `UNIQUE (user_id)` (Phase 3), and keeps the invariant on leave/remove (Phase 4). The reasoning is in [ADR-0010](../DECISIONS/ADR-0010-one-household-per-user-invariant.md).

**Exposure:** under-display only. RLS is the more permissive layer and doesn't leak. Not a security finding.

---

## Scope Map

```
supabase/migrations/*household*
supabase/migrations/*invite*
supabase/migrations/*dashboard_stats*
supabase/functions/household-invite/**
src/services/api.ts (household section: getMyHousehold, respondToInvite, removeHouseholdMember)
src/pages/Household.tsx
src/pages/InviteAccept.tsx
docs/DATA_MODEL.md
```

---

## Scope of Work

### Phase 0: Measure (read-only, user-run)
**Files affected:** none (query supplied here)

The user runs this read-only diagnostic on production. **Claude does not run remote queries or modify the remote DB (HARD RULE).**

```sql
-- Users with >1 membership, with per-household member counts
SELECT hm.user_id, hm.household_id, hm.role, hm.joined_at,
       h.created_by = hm.user_id AS is_creator,
       (SELECT count(*) FROM household_members x WHERE x.household_id = hm.household_id) AS member_count,
       (SELECT count(*) FROM family_members f WHERE f.household_id = hm.household_id) AS dependent_count
FROM household_members hm
JOIN households h ON h.id = hm.household_id
WHERE hm.user_id IN (SELECT user_id FROM household_members GROUP BY user_id HAVING count(*) > 1)
ORDER BY hm.user_id, hm.joined_at;
```

The result decides Phase 3's backfill rules. Be especially careful with any row where both households have `member_count > 1`.

### Phase 1: Deterministic household selection (interim fix; can ship alone)
**Files affected:** new migration `0NN_deterministic_household_lookup.sql` (written locally only; the user deploys)

`CREATE OR REPLACE` the three live definitions, replacing each bare `LIMIT 1` with a shared ordering:
- `get_my_household()` — current body in migration 033:29-33
- `get_household_recipes()` — current body in migration 051:34-37
- `get_dashboard_stats()` — current body in migration 045:50-54

Ordering: prefer households where `member_count > 1`, then `hm.joined_at DESC`, then `hm.household_id` as the final tiebreaker. Consider pulling this into one `SECURITY DEFINER` helper, `my_primary_household_id()` with `search_path` pinned, so the three RPCs can't drift apart. Keep each function's grants and `search_path` exactly as they are today.

### Phase 2: Fix both invite-accept paths
**Files affected:** new migration (redefines `respond_to_household_invite`), `supabase/functions/household-invite/index.ts`

On accept, in one transaction:
1. Find the caller's current household(s).
2. If the current household is disposable per ADR-0010 §2 (caller is the only member, caller is `created_by`, no pending outgoing invites): re-parent its `family_members` to the joined household, then delete it.
3. If the current household has other members: raise `22023` with a readable message. Map it to a toast in `api.ts` / `InviteAccept.tsx`.
4. Insert the new membership (existing logic).

Today the edge-function token path upserts into `household_members` directly (index.ts ~300-315). Change it to call the same RPC, or a shared SQL function, so there is one implementation. Note: `handle_new_user()` (migration 023:88-92) already skips solo creation when an invite is auto-accepted at signup. No change needed there.

### Phase 3: Backfill + constraint
**Files affected:** new migration (written locally; the user deploys after reviewing Phase 0 output)

1. For each user with multiple memberships: keep the shared household (`member_count > 1`), re-parent dependents from the disposable solo household, delete the solo household.
2. Abort with `RAISE EXCEPTION` if any user still has more than one membership after the cleanup (for example, two real households). That needs a manual decision and must not be guessed.
3. `ALTER TABLE household_members ADD CONSTRAINT household_members_user_id_key UNIQUE (user_id);`
4. Once the constraint is in, the Phase 1 ordering is harmless. Keep it as defense in depth.

Sequence this after MOP-0011's pending read-parity check, so there aren't two unverified production migrations in flight at once.

### Phase 4: Keep the invariant on leave/remove
**Files affected:** new migration (`leave_household` / `remove_household_member` RPC), `src/services/api.ts` (`removeHouseholdMember`, api.ts:1718-1723, currently a bare `.delete()`)

Removing a member, or a member leaving, must give that user a fresh solo household in the same transaction. Owners can't leave without transferring first (MOP-0014 RPC). After this, `get_my_household()` never returns `NULL` for an active user, so check what the frontend does with `NULL` and whether that branch is still needed.

### Phase 5: Tests + docs
**Files affected:** `src/services/__tests__/api.test.ts`, `src/pages/__tests__/Household.test.tsx`, `docs/DATA_MODEL.md`, `docs/RUNBOOK.md`

- Unit tests for the new `api.ts` error mapping (accept refused because the user's household has members) and for the remove path calling the RPC.
- `DATA_MODEL.md`: document the one-household invariant and the constraint.
- `RUNBOOK.md`: add the Phase 0 diagnostic query under household debugging.

---

## Priority

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| P1 | Phase 0 + Phase 1 (deterministic lookup) | Small | High: fixes the live symptom for the existing invited member; unblocks MOP-0042 household tour copy |
| P1 | Phase 2 (accept-path fix) | Medium | High: stops new duplicates |
| P2 | Phase 3 (backfill + UNIQUE) | Medium | Medium: makes it permanent; destructive, so it goes after review |
| P2 | Phase 4 (leave/remove) | Small–Medium | Medium |

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

  - id: household-domain-suite
    type: command
    run: npm run test:run -- src/services/__tests__/api.test.ts src/pages/__tests__/Household.test.tsx
    expect_exit: 0

  # PLACEHOLDER — finalize filenames when migrations are written
  - id: no-bare-limit1-household-lookup
    type: grep
    path: supabase/migrations/<phase1-migration>.sql
    pattern: "ORDER BY"
    expect: present

  - id: unique-user-constraint
    type: grep
    path: supabase/migrations/<phase3-migration>.sql
    pattern: "UNIQUE \\(user_id\\)"
    expect: present

  - id: edge-fn-uses-shared-accept
    type: grep
    path: supabase/functions/household-invite/index.ts
    pattern: "respond_to_household_invite"
    expect: present
```

## Manual Follow-up (non-blocking)

- [ ] After the user deploys: the invited member's Household page lists both members, and the Household feed matches a direct RLS query.

---

## Acceptance Criteria

- [ ] All `verification` block items pass (`/verify-mop`)
- [ ] `/integrity-check` passes for `household-sharing`
- [ ] `security-auditor migrations` run on the new migrations (they touch RLS-adjacent `SECURITY DEFINER` functions)
- [ ] No household lookup in a live function definition uses `LIMIT 1` without `ORDER BY`
- [ ] Both accept paths remove a disposable solo household and re-parent dependents
- [ ] `UNIQUE (user_id)` on `household_members` (after backfill)
- [ ] Leave/remove leaves every active user with exactly one household
- [ ] `DATA_MODEL.md` documents the invariant
- [ ] ADR-0010 → `accepted`
- [ ] CHANGELOG entry added

---

## Related

- **ADRs:** ADR-0010 (decision record)
- **MOPs:** MOP-0014 (ownership-transfer RPC, reused), MOP-0042 (Phase 6 household tour copy depends on Phase 1), MOP-0011 (sequence Phase 3 after its read-parity check)
- **Audit / source:** household-sme MOP-0042 Phase 6 scoping, 2026-10-30. Also noted earlier, without a MOP, in the 2026-10-19 chat-rag-sme `search_recipes_text` investigation (recorded in enhancement-backlog memory).

---

## Notes

- **HARD RULE:** every migration here is written locally only. The user runs Phase 0 and deploys Phases 1–4. No `supabase db push` / `--linked`.
- Superseded `LIMIT 1` definitions in migration 025 (lines 40, 204) are historical. Only the latest definitions (033, 045, 051) matter.
- `recipe-pipeline/stages/load.ts:56-59` already collects *all* the user's households for allergy checks, so it is unaffected.
