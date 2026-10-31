# MOP-0045: Honor the Default Recipe Visibility Setting on Every Client Save Path

| Field | Value |
|-------|-------|
| **MOP** | MOP-0045 |
| **Title** | Honor the Default Recipe Visibility Setting on Every Client Save Path |
| **Date Submitted** | 2026-10-30 |
| **Date Updated** | 2026-10-30 |
| **Date Completed** | — |
| **Submitted By** | surface-reviewer |
| **Status** | draft |

> Status vocabulary defined in [docs/prompts/MOP_STATUS_LIFECYCLE.md](../prompts/MOP_STATUS_LIFECYCLE.md).

---

## Summary

Settings says "Visibility applied to newly saved recipes" (`src/pages/Settings.tsx:459`), backed by `profiles.default_recipe_visibility` (migration 048). Only the two server-side save paths read it:
- `recipe-pipeline/stages/load.ts:106-112`
- `chat-api/tools/handlers.ts:856-862`

Every client-side save path ignores it:

| Save path | Current behavior | File |
|---|---|---|
| Chat extraction save card | `useState<RecipeVisibility>("private")` | `src/components/chat/StructuredRecipeDisplay.tsx:332` |
| Batch import card | `useState<RecipeVisibility>("private")` | `src/components/chat/BatchImportCard.tsx:107` |
| Batch import save | `entry.visibility ?? "private"` | `src/components/chat/BatchImportPanel.tsx:208` |
| Manual recipe form | no visibility field at all, so the column default `'private'` applies (migration 009:61) | `src/components/recipes/RecipeForm.tsx:656` |
| `createRecipe` | inserts whatever it's given; doesn't look up a default | `src/services/api.ts:293+` |

A user who sets "household" as their default gets `private` from the chat save card, batch import and manual entry, and nothing tells them. **It fails closed** (more private than intended), so nothing is exposed. It is a broken stated promise, though, and it feeds the visibility confusion behind a real user report this session.

No ADR is needed. The decision (honor the setting everywhere) was already made in migration 048 and the Settings copy. This MOP only finishes implementing it.

---

## Scope Map

```
src/components/chat/StructuredRecipeDisplay.tsx
src/components/chat/BatchImportCard.tsx
src/components/chat/BatchImportPanel.tsx
src/components/recipes/RecipeForm.tsx
src/services/api.ts (createRecipe, profile hook)
src/components/chat/__tests__/**
src/services/__tests__/api.test.ts
```

---

## Scope of Work

### Phase 1: One default-resolution point
**Files affected:** `src/services/api.ts`

- Add a small hook, e.g. `useDefaultRecipeVisibility()`, that reads the profile's `defaultRecipeVisibility` and falls back to `'private'`. Remove the `(profile as any)` cast in `Settings.tsx:462` if the generated types allow it.
- In `createRecipe`: when `data.visibility` is `undefined`, resolve the caller's profile default before inserting. This is the safety net so any future caller that omits visibility still gets the setting. An explicit value is always respected.

### Phase 2: Seed the pickers from the setting
**Files affected:** `StructuredRecipeDisplay.tsx`, `BatchImportCard.tsx`, `BatchImportPanel.tsx`

- Start each picker from the resolved default instead of `"private"`.
- **Async gotcha:** `useState(initial)` only reads `initial` once, and the profile query may resolve after the card mounts. Sync the picker to the default until the user touches it (a `userTouched` ref), so a late-arriving profile never overwrites a choice the user already made.
- `BatchImportPanel.tsx:208`: replace `?? "private"` with `?? defaultVisibility`, or omit the field so Phase 1's fallback applies.

### Phase 3: Manual form
**Files affected:** `RecipeForm.tsx`

Two options:
- (a) Add a `VisibilityPicker` to create mode, seeded the same way as Phase 2.
- (b) Omit visibility and rely on Phase 1's `createRecipe` fallback.

(a) is more consistent with the chat cards; (b) is smaller. **Open question for the user.**

### Phase 4: Tests
**Files affected:** `src/components/chat/__tests__/`, `src/services/__tests__/api.test.ts`

- `createRecipe` with visibility omitted → uses the profile default. With an explicit value → that value wins.
- Save card renders with the default `household` when the profile says so, and keeps the user's choice when the profile loads late.

---

## Priority

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| P2 | Phases 1–2, 4 | Small | Medium: fixes a stated-but-broken setting on the two main save paths |
| P2 | Phase 3 | Small | Low–Medium |

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

  - id: chat-components-suite
    type: command
    run: npm run test:run -- src/components/chat/__tests__
    expect_exit: 0

  - id: no-hardcoded-private-save-card
    type: grep
    path: src/components/chat/StructuredRecipeDisplay.tsx
    pattern: 'useState<RecipeVisibility>\("private"\)'
    expect: absent

  - id: no-hardcoded-private-batch-card
    type: grep
    path: src/components/chat/BatchImportCard.tsx
    pattern: 'useState<RecipeVisibility>\("private"\)'
    expect: absent

  - id: no-hardcoded-private-batch-panel
    type: grep
    path: src/components/chat/BatchImportPanel.tsx
    pattern: 'visibility \?\? "private"'
    expect: absent
```

## Manual Follow-up (non-blocking)

- [ ] Set the default to Household in Settings, save a recipe from chat, and confirm the picker started on Household.

---

## Acceptance Criteria

- [ ] All `verification` block items pass (`/verify-mop`)
- [ ] `/integrity-check` passes for `chat-rag` and `recipes-library`
- [ ] Every client save path starts from the profile default; an explicit user choice always wins
- [ ] `createRecipe` applies the profile default when visibility is omitted
- [ ] `security-auditor api` run (touches `src/services/api.ts`)
- [ ] CHANGELOG entry added

---

## Related

- **ADRs:** none needed (the decision was made in migration 048)
- **MOPs:** MOP-0042 (if a tour step describes "Default Visibility" in Settings, it needs this fix first), MOP-0019 (batch import), MOP-0028 (bulk visibility)
- **Audit / source:** household-sme MOP-0042 Phase 6 scoping, 2026-10-30

---

## Notes

- No migration and no remote DB change.
- Adjacent, separate backlog items (enhancement-backlog memory): the non-owner visibility picker false-success toast and the collection-sharing visibility leak. Not in scope here.
