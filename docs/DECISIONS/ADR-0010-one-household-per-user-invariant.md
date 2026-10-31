# ADR-0010: One Household per User — Enforce the Invariant the App Already Assumes

**Status:** proposed
**Created:** 2026-10-30
**Author:** Nick Neal
**Last reviewed:** 2026-10-30
**Related MOP:** MOP-0044

## Context

The schema allows a user to belong to many households. `household_members` is only `UNIQUE (household_id, user_id)` (`20260312000000_009_household_and_visibility.sql:31-38`). Nothing stops one `user_id` from appearing in two households.

The rest of the app assumes each user has exactly one household:

| Surface | How it picks "the" household | File |
|---|---|---|
| `get_my_household()` (Household page, member list, RBAC flags) | `SELECT ... FROM household_members WHERE user_id = auth.uid() LIMIT 1`, no `ORDER BY` | `20260906000003_033_get_my_household_rbac_fields.sql:29-33` |
| `get_household_recipes()` ("Household" feed on /recipes) | same pattern | `20261018000000_051_fix_household_recipes_total_count_cap.sql:34-37` |
| `get_dashboard_stats()` household recipe count | same pattern | `20261002000000_045_get_dashboard_stats_child_tables.sql:50-54` |
| UI (Household page, Settings, tour copy in MOP-0042) | renders a single household object | `src/services/api.ts:1621` and its consumers |

The recipes SELECT policy does **not** make that assumption. A `visibility = 'household'` recipe is readable if the author and the viewer share **any** household (`20260312000003_012_collection_sharing_inheritance.sql:19-27`).

Multiple memberships happen in normal use:

- `handle_new_user()` creates a solo household at signup unless an invite was auto-accepted during signup (`20260314500000_023_fix_trigger_missing_email.sql:88-92`).
- Accepting an invite **later** adds a second membership and never removes the solo one. There are two accept paths, and both behave this way:
  - RPC `respond_to_household_invite` (`20261004000000_050_fix_respond_to_household_invite_ambiguity.sql:70-72`)
  - the token-accept branch of the `household-invite` edge function (`supabase/functions/household-invite/index.ts:~300-315`, upsert into `household_members`)

This project's own production household has exactly this case: a second member who joined by invite after signing up.

**What goes wrong for that user:**
- Postgres doesn't guarantee row order for `LIMIT 1` without `ORDER BY`. The Household page may show their empty solo household (just them, as owner) instead of the shared one.
- The "Household" recipe feed may be empty or scoped to the wrong household.
- The dashboard's household count may disagree with both.
- The RPCs may disagree with each other on the same request cycle, and all of them can disagree with what RLS returns from a direct query.

**Exposure assessment:** this bug hides data the user is allowed to see. It does not show data they aren't allowed to see. RLS is the more permissive layer, and it's correct under multi-membership semantics. While the extra household is a single-member solo household, no recipe leaks to anyone new.

## Decision (proposed)

1. **A user belongs to exactly one household.** This is the product model the UI, copy and RPCs already use. The schema should enforce it rather than leave it as an unwritten assumption.
2. **Joining replaces the solo household.** When a user accepts an invite:
   - If their current household is a **disposable solo household**, remove it in the same transaction as the insert. Disposable means: the user is its only member, it has no pending outgoing invites, and the user is its `created_by`.
   - Before deleting, **re-parent** that household's `family_members` rows (dependents and dietary profiles; `ON DELETE CASCADE`, migration 009:92) to the household being joined, so they aren't silently destroyed. (See Open questions.)
   - If their current household has **other members**, refuse the accept with a clear error ("Leave or transfer your current household first"). Ownership transfer already exists (MOP-0014).
3. **Leaving re-creates a solo household.** When a user is removed from, or leaves, a shared household, give them a fresh solo household. This keeps "every user has exactly one household" true, so `get_my_household()` never returns `NULL` for an active user.
4. **Enforce with a constraint** once existing data is cleaned up: `UNIQUE (user_id)` on `household_members`. All three `LIMIT 1` lookups then become deterministic by construction.
5. **Until the constraint lands,** each single-household lookup uses a deterministic `ORDER BY`: prefer households with more than one member, then the most recent `joined_at`. This is the interim fix that makes the symptom go away right away (MOP-0044 Phase 1).
6. **RLS stays unchanged.** Once the invariant holds, "any shared household" and "the household" mean the same thing.

## Consequences

### Positive
- The Household page, the Household feed, the dashboard and RLS all agree.
- Tour copy in MOP-0042 ("Recipes you set to Household are visible to everyone listed here") becomes true.
- Removes a class of nondeterministic bugs: any future `LIMIT 1` household lookup is safe.
- The constraint documents the model in the schema, where future authors will see it.

### Negative
- Cleaning up existing data deletes solo households. This is destructive. It needs a read-only dry run the user runs first, and the user deploys it (HARD RULE).
- Re-parenting `family_members` can create duplicate dependents in the joined household (both partners added "Kid A"). Merging them is out of scope; duplicates are visible and can be fixed by hand.
- Rules out real multi-household membership (e.g. a user sharing with both a partner and a parent's household). That use case would need a household switcher and a visibility model per household.
- Changes behavior in two accept paths (RPC + edge function) plus the remove path. All of them must stay in sync.

## Alternatives considered

| Option | Why rejected |
|---|---|
| **A. Only add `ORDER BY` to the three RPCs** | Fixes what users see, not the root cause. Every new household lookup has to remember the rule. Solo households pile up and RLS still evaluates them. Kept as the interim step (Decision 5), not the end state. |
| **B. Support multi-household membership for real** (household switcher, active-household preference, scope RLS to the active household) | Big UX and RLS redesign, with no current user demand. Scoping RLS to an "active" household also adds session state to a policy that is stateless today. Revisit if demand appears. |
| **C. Don't create a solo household at signup; create it lazily** | Doesn't fix users who already have one, and the Household page and dietary profiles assume one exists. Could be added later; it's compatible with this decision. |
| **D. Narrow RLS to the household the RPC picked** | Makes RLS depend on a nondeterministic choice. Worse in every way. |

## Trigger for revisit

- A user asks to share recipes with two separate households at once → reopen Alternative B.

## Open questions

1. When joining, should `family_members` from the solo household move to the joined household (proposed) or be deleted? Or should the accept be blocked while the user has dependents?
2. Should the accept refuse, or offer to transfer, when the user's current household has other members?

## Related

- **MOP:** MOP-0044 (implementation), MOP-0014 (ownership-transfer RPC, reused for the "has other members" case), MOP-0042 (tour copy depends on this)
- **Files impacted:** migrations 023 (`handle_new_user`), 033, 045, 050, 051; `supabase/functions/household-invite/index.ts`; `src/services/api.ts` (`removeHouseholdMember`, `getMyHousehold`)
