# MOP-0025: Household Dietary & Allergy Profiles UI

| Field | Value |
|-------|-------|
| **MOP** | MOP-0025 |
| **Title** | Household Dietary & Allergy Profiles UI |
| **Date Submitted** | 2026-09-05 |
| **Date Updated** | 2026-09-05 |
| **Date Completed** | — |
| **Submitted By** | Nick Neal |
| **Status** | draft |

> Status vocabulary defined in [docs/prompts/MOP_STATUS_LIFECYCLE.md](../prompts/MOP_STATUS_LIFECYCLE.md).

---

## Summary

MOP-0003 (Dietary Profiles & Allergen Detection) has been in `draft` since March 2026. This MOP supersedes or complements it by focusing specifically on the surface the user can see and manage: a per-household-member profile that captures allergies, dietary restrictions (vegan, gluten-free, etc.), and preference dislikes. These profiles feed the allergy auto-tagger (MOP-0024), the randomizer exclusion rules (MOP-0023), and future AI-driven meal suggestions. This MOP scopes the full-stack: data model, API, and Settings UI.

---

## Scope Map

```
supabase/migrations/
src/pages/Settings.tsx
src/components/household/
src/components/settings/
src/services/api.ts
src/types/household.ts
docs/
```

---

## Scope of Work

### Phase 1: Reconcile with MOP-0003
**Files affected:** `docs/MOPs/MOP-0003.md`, `docs/MOPs/REGISTRY.md`

Read MOP-0003 in full. Determine overlap with this MOP and MOP-0024. Either:
- Mark MOP-0003 `cancelled` with a note pointing to MOP-0024 + MOP-0025 as its successors, or
- Narrow MOP-0003's remaining scope to anything not covered here (e.g., LLM-based dietary suggestion features)

Document the decision in both MOP files.

### Phase 2: Data model — dietary profile per family member
**Files affected:** `supabase/migrations/NNNN_dietary_profiles.sql` (write, do not deploy), `src/types/household.ts`

Extend `family_members` (coordinating with MOP-0024 Phase 1 to avoid duplicate migrations):

```sql
allergies          text[]  DEFAULT '{}'  -- FDA Big-9 + free-text
dietary_flags      text[]  DEFAULT '{}'  -- 'vegan','vegetarian','gluten-free','dairy-free','halal','kosher','keto','paleo'
dislikes           text[]  DEFAULT '{}'  -- ingredient/cuisine dislikes (informational, not safety-critical)
```

RLS mirrors existing `family_members` policies.

### Phase 3: Dietary profile API
**Files affected:** `src/services/api.ts`, `src/types/household.ts`

Add to `apiClient`:
- `getFamilyMemberProfiles(householdId)` — returns members with allergies + dietary_flags + dislikes
- `updateFamilyMemberProfile(memberId, profile)` — patches the three arrays

### Phase 4: Member profile UI in Settings
**Files affected:** `src/pages/Settings.tsx`, `src/components/household/MemberProfileCard.tsx` (new)

In the Household → Members section, each member card expands to reveal:
- **Allergies** (safety — red): chip multi-select from FDA Big-9 + free-text add. Changes trigger immediate re-scan prompt (see MOP-0024 Phase 4).
- **Dietary flags** (preference — amber): chip multi-select from the standard list above.
- **Dislikes** (soft — grey): free-text tags for ingredients or cuisines to avoid in suggestions.

Visual design: collapsed member cards show a summary "2 allergies · vegan · gluten-free". Expanded card shows full chip editors.

### Phase 5: Profile summary in Meal Planner sidebar
**Files affected:** `src/pages/MealPlanner.tsx`, `src/components/meal-planning/HouseholdDietSummary.tsx` (new)

Small "Household diet" summary panel in the Meal Planner (collapsible, below the week navigator). Shows each member's allergy count and top dietary flags as chips. Tapping a member opens their profile card (Settings deep-link or inline sheet). This keeps dietary context visible while planning without requiring a Settings round-trip.

---

## Priority

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| P0 | Phase 1 — reconcile MOP-0003 | Small | Medium |
| P0 | Phase 2 — data model | Small | High |
| P1 | Phase 3 — API | Small | High |
| P1 | Phase 4 — member profile UI | Medium | High |
| P2 | Phase 5 — planner sidebar summary | Small | Medium |

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

  - id: migration-file-exists
    type: grep
    path: supabase/migrations
    pattern: "dietary_flags"
    expect: present

  - id: member-profile-card-exists
    type: file-exists
    path: src/components/household/MemberProfileCard.tsx

  - id: api-has-update-profile
    type: grep
    path: src/services/api.ts
    pattern: "updateFamilyMemberProfile"
    expect: present
```

## Manual Follow-up (non-blocking)

- [ ] QA: adding a new allergy to a member triggers re-scan prompt
- [ ] QA: dietary flags visible in Meal Planner household summary panel
- [ ] Confirm MOP-0003 disposition is documented and registry updated

---

## Acceptance Criteria

- [ ] All `verification` block items pass
- [ ] MOP-0003 is either cancelled or narrowed with documented rationale
- [ ] `family_members` has `allergies`, `dietary_flags`, `dislikes` columns in migration
- [ ] Settings UI shows all three profile sections per member
- [ ] Allergy changes surface re-scan prompt (links to MOP-0024 Phase 4)
- [ ] API round-trip works for all three fields
- [ ] Meal Planner shows household diet summary panel
- [ ] Documentation updated per `/update-docs`
- [ ] CHANGELOG entry added

---

## Related

- **MOPs:** MOP-0003 (predecessor — resolve in Phase 1), MOP-0024 (allergy tagging consumes `allergies` from this data model), MOP-0023 (randomizer consumes `dietary_flags` and `allergies` for exclusion)
- **Coordinate:** MOP-0024 Phase 1 and this MOP Phase 2 touch the same `family_members` table — write as one combined migration or sequence them explicitly to avoid conflicts

---

## Notes

Dislikes are intentionally non-safety-critical — they're hints to the AI suggestion system and randomizer ("try to avoid"), not hard exclusions. Allergies are hard exclusions. Dietary flags (vegan, gluten-free, etc.) are hard exclusions in the randomizer but soft in the recipe library view (visible as filter chips, not warnings). This distinction must be clearly communicated in the UI.
