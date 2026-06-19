# Household SME Knowledge Base

Navigation for `household-sme`.

## Canonical docs

| Doc | Purpose |
|-----|---------|
| [MOP-0002](../../docs/MOPs/MOP-0002.md) | Family sharing shipped scope |
| [MOP-0014](../../docs/MOPs/MOP-0014-household-write-atomicity-rpcs.md) | Atomic ownership transfer (draft) |
| [DATA_MODEL.md](../../docs/DATA_MODEL.md) | Tables + RLS |
| [API.md](../../docs/API.md) | Invite edge functions + RPCs |

## Key code paths

| Surface | Files |
|---------|-------|
| Household UI | `src/pages/Household.tsx`, `src/pages/InviteAccept.tsx` |
| API client | `api.ts` — `getMyHousehold`, invites, `transferOwnership`, family members |
| RPCs | `supabase/migrations/*025_rpc*` — `get_my_household`, `toggle_recipe_reaction` |
| Edge | `supabase/functions/household-invite/` |

## Visibility model

| Level | Who sees |
|-------|----------|
| `private` | Owner only |
| `household` | Members of owner's household |
| `public` | All authenticated users |

## Common failure modes

1. **Invitee doesn't see shared recipes** — invite accepted but `household_members` row missing; or recipe still `private`.
2. **Owner can't transfer** — MOP-0014 RPCs not deployed; multi-step client writes race.
3. **Dependent not visible** — `family_members.household_id` mismatch or `is_active = false`.
4. **RLS leak suspicion** — run integration suite with two test users; never test RLS with service role alone.

## Tests

- `api.test.ts` — household, invite, family member describes
- `src/integration/rls.test.ts` (opt-in)

## Handoff to platform-auth-sme

Login failures, OAuth loops, setup gate, username/profile issues → `platform-auth-sme`.
