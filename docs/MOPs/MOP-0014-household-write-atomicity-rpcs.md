# MOP-0014: Household Write Atomicity — Convert `transferOwnership` and `respondToInvite` to SECURITY DEFINER RPCs

| Field | Value |
|-------|-------|
| **MOP** | MOP-0014 |
| **Title** | Household Write Atomicity — Convert `transferOwnership` and `respondToInvite` to SECURITY DEFINER RPCs |
| **Date Submitted** | 2026-06-01 |
| **Date Updated** | 2026-06-01 |
| **Date Completed** | — |
| **Submitted By** | surface-reviewer (origin: MOP-0005 Phase 1 round-1 agent) |
| **Status** | draft |

> Status vocabulary defined in [docs/prompts/MOP_STATUS_LIFECYCLE.md](../prompts/MOP_STATUS_LIFECYCLE.md).

---

## Summary

Two household write paths in `src/services/api.ts` perform sequential, non-atomic Supabase writes that can leave the database in an inconsistent state if the second write fails:

1. `transferOwnership(memberId, householdId)` — promotes target to `owner`, then demotes self to `admin`. A failure between the two PATCHes leaves the household with **two simultaneous owners** (privilege-escalation-adjacent).
2. `respondToInvite(inviteId, accept)` — marks invite `accepted`, then inserts a `household_members` row. A failure between the two writes leaves the user believing they joined but with no membership row.

Both issues match the pattern already established by MOP-0002 / migration 025, which consolidated five high-traffic household methods into `SECURITY DEFINER` RPCs (referenced in MOP-0002 line 387). This MOP extends that pattern to the two remaining non-atomic write paths.

---

## Scope Map

```
src/services/api.ts
src/services/__tests__/api.test.ts
supabase/migrations/<NNN>_household_write_atomicity_rpcs.sql   # written locally, NOT pushed
docs/CHANGELOG.md
docs/API.md
docs/DATA_MODEL.md
```

> **HARD RULE:** No `supabase db push` / no remote DB modification. Migration SQL is authored locally; user deploys.

---

## Scope of Work

### Phase 1: Author migration SQL (local-only)
**Files affected:** `supabase/migrations/<next-number>_household_write_atomicity_rpcs.sql`

Create two `SECURITY DEFINER` RPC functions, each wrapping its writes in an implicit transaction (Postgres functions are atomic by default — any unhandled exception rolls back all writes inside the function body).

**Authorization checks** must be performed inside each RPC body since `SECURITY DEFINER` bypasses RLS. Pattern: check `auth.uid()` against expected role in `household_members` before mutating.

```sql
-- Suggested shape (to be reviewed/adjusted at implementation time)

create or replace function public.transfer_household_ownership(
  p_member_id uuid,
  p_household_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id uuid := auth.uid();
  v_caller_role text;
begin
  if v_caller_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- Caller must currently be owner of the household
  select role into v_caller_role
  from household_members
  where household_id = p_household_id and user_id = v_caller_id;

  if v_caller_role is null or v_caller_role <> 'owner' then
    raise exception 'caller is not owner of household %', p_household_id
      using errcode = '42501';
  end if;

  -- Target must be an existing member of this household
  perform 1 from household_members
  where id = p_member_id and household_id = p_household_id;
  if not found then
    raise exception 'member % is not in household %', p_member_id, p_household_id
      using errcode = '22023';
  end if;

  update household_members set role = 'owner' where id = p_member_id;
  update household_members
    set role = 'admin'
    where household_id = p_household_id and user_id = v_caller_id;
end;
$$;

revoke all on function public.transfer_household_ownership(uuid, uuid) from public;
grant execute on function public.transfer_household_ownership(uuid, uuid) to authenticated;


create or replace function public.respond_to_household_invite(
  p_invite_id uuid,
  p_accept boolean
) returns table (
  household_id uuid,
  household_name text,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id uuid := auth.uid();
  v_invite household_invites%rowtype;
  v_new_status text;
begin
  if v_caller_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into v_invite from household_invites where id = p_invite_id;
  if not found then
    raise exception 'invite % not found', p_invite_id using errcode = '22023';
  end if;

  -- Caller must be the invite addressee (matched by lowercased email).
  -- Per user directive 2026-06-01: invites are scoped by email, not user_id,
  -- because invites are sent before the recipient has an account.
  if lower(coalesce(v_invite.invitee_email, '')) <> lower(coalesce((
    select email from auth.users where id = v_caller_id
  ), '')) then
    raise exception 'caller is not the invitee for invite %', p_invite_id
      using errcode = '42501';
  end if;

  if v_invite.status <> 'pending' then
    raise exception 'invite % is not pending (current: %)', p_invite_id, v_invite.status
      using errcode = '22023';
  end if;

  v_new_status := case when p_accept then 'accepted' else 'declined' end;

  update household_invites
    set status = v_new_status
    where id = p_invite_id;

  if p_accept then
    insert into household_members (household_id, user_id, role)
    values (v_invite.household_id, v_caller_id, 'member')
    on conflict (household_id, user_id) do nothing;
  end if;

  return query
    select h.id, h.name, v_new_status
    from households h
    where h.id = v_invite.household_id;
end;
$$;

revoke all on function public.respond_to_household_invite(uuid, boolean) from public;
grant execute on function public.respond_to_household_invite(uuid, boolean) to authenticated;
```

> Implementer must verify the actual schema of `household_invites` (the addressee email column name — `invitee_email` is the assumed name; confirm against migrations) and `household_members` (unique constraint shape for the `on conflict`) before finalizing.

**Open questions from surface-reviewer — resolved 2026-06-01:**
- ✅ Invite addressee scoping: match by lowercased email (per user directive). SQL above updated.
- ⏳ Migration deploy ordering for Phase 2: see "Phase 2 deploy gate" in `## Notes`.

### Phase 2: Swap frontend callers
**Files affected:** `src/services/api.ts`

Replace both method bodies with single `supabase.rpc(...)` calls. Preserve existing return shapes so consumers (`useTransferOwnership`, `useRespondToInvite`) need no changes.

### Phase 3: Tests
**Files affected:** `src/services/__tests__/api.test.ts`

Cover at minimum:
- Happy path: both RPCs return expected shape.
- Authorization rejection (non-owner attempts transfer; non-invitee attempts respond).
- Idempotency / second-call behavior (re-accepting an already-accepted invite is rejected cleanly).
- The new methods make exactly one network call (verify via MSW spy / mock counter).

---

## Priority

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| P1 | Phase 1 — RPC migration SQL | Small | High (security-adjacent: closes dual-owner window) |
| P1 | Phase 2 — frontend swap | Small | High |
| P2 | Phase 3 — tests | Small | Medium |

---

## Verification

```yaml
verification:
  - id: migration-file-present
    type: file-exists
    path: supabase/migrations/*_household_write_atomicity_rpcs.sql

  - id: rpc-transfer-defined
    type: grep
    path: supabase/migrations/*_household_write_atomicity_rpcs.sql
    pattern: 'create or replace function public.transfer_household_ownership'
    expect: present

  - id: rpc-respond-defined
    type: grep
    path: supabase/migrations/*_household_write_atomicity_rpcs.sql
    pattern: 'create or replace function public.respond_to_household_invite'
    expect: present

  - id: api-transfer-uses-rpc
    type: grep
    path: src/services/api.ts
    pattern: "supabase\\.rpc.*transfer_household_ownership"
    expect: present

  - id: api-transfer-no-double-patch
    type: grep
    path: src/services/api.ts
    pattern: "// Promote target to owner"
    expect: absent

  - id: api-respond-uses-rpc
    type: grep
    path: src/services/api.ts
    pattern: "supabase\\.rpc.*respond_to_household_invite"
    expect: present

  - id: api-respond-no-double-write
    type: grep
    path: src/services/api.ts
    pattern: "// Update invite status"
    expect: absent

  - id: tests-pass
    type: command
    run: npm test -- src/services/__tests__/api.test.ts
    expect_exit: 0

  - id: lint-clean
    type: command
    run: npm run lint
    expect_exit: 0

  - id: human-rpc-authz-review
    type: human
    description: Reviewer confirms each RPC body performs explicit caller authorization (auth.uid() + role check) since SECURITY DEFINER bypasses RLS.
    target: Both RPCs reject calls from non-owner / non-invitee callers with errcode 42501.
    hard_gate: true
```

---

## Acceptance Criteria

- [ ] All `verification` block items pass
- [ ] Migration file authored locally; user has deployed it before Phase 2 lands in main
- [ ] `transferOwnership` and `respondToInvite` each issue exactly one Supabase call
- [ ] Existing `useTransferOwnership` and `useRespondToInvite` hook consumers require no signature change
- [ ] Documentation updated per `/update-docs` procedure (`docs/API.md` notes the new RPCs; `docs/DATA_MODEL.md` lists them in the SECURITY DEFINER inventory)
- [ ] CHANGELOG entry added
- [ ] No remote DB push performed by Claude

---

## Related

- **MOPs:** MOP-0002 (established the SECURITY DEFINER RPC pattern, migration 025), MOP-0005 (surfaced these findings while writing api.ts tests), MOP-0006 (generated Supabase types — new RPCs should be reflected once regenerated)
- **ADRs:** none (extends an existing implementation pattern; no new architectural decision)
- **Audit / source:** MOP-0005 Phase 1 round-1 agent surface report (2026-06-01)

---

## Notes

- **Why one MOP, not two:** Both findings have the same fix shape (sequential writes → single SECURITY DEFINER RPC), the same scope map, and depend on the same migration deploy. Splitting would double the doc overhead without separating any decision.
- **Why P1, not P0:** The dual-owner window in `transferOwnership` requires a specific second-PATCH failure (network drop or RLS reject) mid-transfer. No evidence of in-the-wild occurrence; no known exploit chain that triggers it on demand. But the surface is privilege-escalation-adjacent and the fix is small and well-understood — fits this sprint, not "stop the world."
- **HARD RULE compliance:** This MOP authors migration SQL locally only. Deployment is the user's responsibility. Phase 2 frontend swap must not land in `main` before the migration is deployed, or `supabase.rpc(...)` calls will 404.
- **Not addressed here:** Finding 3 (`getRecipeReactions` "Unknown" fallback) was classified as `trivial-fix` and is **kicked to a follow-up commit** (per user directive 2026-06-01). One-line type widening to `string | null` + UI null-tolerance. Not part of any MOP.

- **Phase 2 deploy gate (user directive pending):** The frontend swap in Phase 2 must not land in `main` until the migration is deployed to the remote DB, or `supabase.rpc(transfer_household_ownership, ...)` and `respond_to_household_invite` will 404. The user (who owns deploys per HARD RULE) must confirm one of:
  - **(a) Deploy-first:** user deploys the migration, then the implementer merges Phase 2 PR
  - **(b) Feature-flag:** Phase 2 lands behind a flag (off by default), user deploys migration, then flips the flag
  - **(c) Single-PR with deploy step:** Phase 2 PR description includes deploy instructions; user runs migration as part of merge ritual
  - User picks at implementation start. Default recommendation: **(a)** — simplest, no flag scaffolding, lowest risk.
