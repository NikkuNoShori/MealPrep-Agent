# ADR-0005: Household Dietary Profile RBAC and Unified Profile UX

**Status:** accepted
**Created:** 2026-09-06
**Author:** Nick Neal
**Last reviewed:** 2026-09-06
**Related MOP:** MOP-0025

## Context

MOP-0025 added dietary restrictions and allergies to both `profiles` (account holders) and `family_members` (dependents). The initial UI surfaced these as two separate cards on the Household page, then a second iteration merged them into one card with a pinned "You" row.

Three problems emerged:

1. **Fragmented data model UX.** `household_members` (adults with accounts), `family_members` (dependents), and dietary data on both `profiles` and `family_members` are separate DB concepts surfaced as separate UI flows. Users experienced this as redundancy and confusion — "why is this empty row here by default?"

2. **No access control on dietary profile edits.** RLS on `family_members` allowed any household member to edit any dependent's profile. A mischievous household member (teenager, etc.) could alter anyone's dietary flags, causing real-world harm if allergy data was changed maliciously or carelessly.

3. **UX affordance mismatch.** Displaying empty sections (Restrictions, Allergies, Preferences) for every member by default added visual noise. Users should only see fields they've opted into filling out.

## Decision

### 1. Unified dietary profile UX

- The dietary profiles card shows **no row by default** — only profiles that have been explicitly created.
- The entry point is **"Add Dietary Profile"** (not "Add Member"), which presents:
  - A **member picker dropdown** populated with all household members (account holders) and existing dependents
  - An **"Add new person"** option for free-text entry (covers non-account members like children)
  - Selecting an existing member pre-fills and locks their name; picking "Add new" allows free text
- Each profile's detail sections — **Restrictions**, **Allergies**, **Preferences** — are **collapsed accordions** by default. Users expand only the sections relevant to that person.
- The pinned empty "You" row is removed. Your own dietary profile appears in the list only after you've explicitly added it.

### 2. Household RBAC for dietary profile edits

Two boolean flags are added to the `households` table:

| Column | Default | Meaning |
|--------|---------|---------|
| `allow_member_edits` | `false` | Members may edit other members' dietary profiles |
| `allow_member_child_edits` | `false` | Members may create/edit dependent (child) profiles |

**Access rules:**

| Actor | Own profile | Other member profiles | Dependent profiles |
|-------|-------------|----------------------|-------------------|
| Owner | ✅ always | ✅ always | ✅ always |
| Admin | ✅ always | ✅ always | ✅ always |
| Member | ✅ always | `allow_member_edits` flag | `allow_member_child_edits` flag |

- Enforcement is **dual-layer**: frontend hides controls when access is denied; RLS policies enforce at the DB level.
- RLS on `family_members` UPDATE is updated to call `get_household_role()` and check the household's flag columns.
- The household owner sees a **"Member Permissions"** section in the Household settings card with toggles for both flags.

### 3. DB changes (migration 032)

```sql
ALTER TABLE households
  ADD COLUMN IF NOT EXISTS allow_member_edits BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_member_child_edits BOOLEAN NOT NULL DEFAULT false;
```

RLS UPDATE policy on `family_members` is updated from bare `is_household_member()` to:

```sql
-- Members can update dependents only if allow_member_child_edits = true OR they are owner/admin
CREATE POLICY "family_members_update" ON family_members
  FOR UPDATE USING (
    get_household_role(household_id) IN ('owner', 'admin')
    OR (
      is_household_member(household_id)
      AND (SELECT allow_member_child_edits FROM households WHERE id = household_id)
    )
  );
```

A parallel policy guards `profiles` dietary columns — members can update only their own `dietary_restrictions`/`allergies`; household RLS on profiles does not change (self-only write is already correct).

## Consequences

### Positive
- Dietary profiles only appear when meaningful — no empty placeholder rows
- One clear entry point ("Add Dietary Profile") with a member picker that understands the household model
- RBAC prevents accidental or malicious dietary data corruption
- Owner/admin always retain full control regardless of flag state
- Flags default to `false` — households start in the most restrictive mode and opt into openness

### Negative
- Slightly more implementation complexity: member picker must query both `household_members` (via `profiles`) and `family_members`
- RLS policy for `family_members` becomes a function call — slightly higher query cost (negligible at this scale)
- New migration required before runtime RBAC enforcement is live; frontend guard is the only protection until deployed

## Alternatives considered

| Option | Why rejected |
|--------|-------------|
| Keep pinned "You" row | Confusing UX — empty profile on load implies mandatory data; users questioned its purpose |
| Single `allow_member_edits` flag covering both adults and children | Too coarse — parents may want to allow members to edit each other but still protect child profiles |
| RLS-only enforcement (no frontend guard) | Poor UX — users see controls that silently fail; frontend guard provides immediate feedback |
| Role-per-dependent (assign each child to a specific guardian) | Correct but significantly more complex; overkill for household scale. Revisit if multi-guardian assignment becomes a user request |

## Trigger for revisit

- If households grow beyond simple family units (e.g., roommate groups, care facilities), per-dependent guardian assignment may become necessary — revisit the "Role-per-dependent" alternative.
- If `get_household_role()` becomes a performance bottleneck on `family_members` queries, materialize the role check into a denormalized column.

## Related

- **MOP:** MOP-0025 (dietary profile schema + initial UI)
- **Files impacted:**
  - `src/pages/Household.tsx` — UX redesign
  - `src/services/api.ts` — member picker query, RBAC-aware mutation hooks, household settings mutations
  - `supabase/migrations/20260906000002_032_household_rbac_flags.sql` — new columns + updated RLS
  - `docs/DATA_MODEL.md` — update `households` and `family_members` RLS descriptions
