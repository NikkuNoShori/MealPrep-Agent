# MOP-0040: Recipe Grid Ad Placement & Monetization

| Field | Value |
|-------|-------|
| **MOP** | MOP-0040 |
| **Title** | Recipe Grid Ad Placement & Monetization |
| **Date Submitted** | 2026-10-16 |
| **Date Updated** | 2026-10-16 |
| **Date Completed** | — |
| **Submitted By** | surface-reviewer |
| **Status** | draft |

> Status vocabulary defined in [docs/prompts/MOP_STATUS_LIFECYCLE.md](../prompts/MOP_STATUS_LIFECYCLE.md). Valid values: `draft` / `evaluation` / `approved` / `planned` / `in_progress` / `verifying` / `complete` / `blocked` / `cancelled` / `deferred`.

---

## Summary

`src/pages/Recipes.tsx` reserves a 300px-wide column (`hidden 2xl:block w-[300px] shrink-0`, commented "reserved width only, not shown until an ad provider is wired up") for a future ad rail, but no ad system exists anywhere in the codebase behind it — no `AdSlot` component, no provider integration (AdSense or similar), no consent/privacy handling, and no placeholder content. This MOP covers picking a provider, building a real ad-slot component with reserved sizing (to avoid layout shift when ads load), adding consent handling, and deciding final ad placement (side rail only vs. in-grid).

---

## Scope Map

```
src/pages/Recipes.tsx
src/components/recipes/RecipeList.tsx
src/components/ads/**            # NEW
docs/<relevant>
```

---

## Scope of Work

### Phase 1: [Phase Name]
**Files affected:** [list of files]

[Description of what this phase accomplishes.]

### Phase 2: [Phase Name]
**Files affected:** [list of files]

[Description of what this phase accomplishes.]

---

## Priority

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| P0 | [item] | Small/Medium/Large | High/Medium/Low |
| P1 | [item] | Small/Medium/Large | High/Medium/Low |

---

## Verification

> **Lockticket acceptance criteria.** See [MOP_VERIFICATION_POLICY.md](../prompts/MOP_VERIFICATION_POLICY.md) — **`type: human` is forbidden** (blocks `complete`). Route domain tests via [DOMAIN_TEST_MATRIX.md](../prompts/DOMAIN_TEST_MATRIX.md). Run `/integrity-check` then `/verify-mop MOP-0040`.

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

  # Domain-specific — copy from DOMAIN_TEST_MATRIX.md for your Scope Map
  - id: domain-suite
    type: command
    run: npm run test:run -- src/path/__tests__/example.test.ts
    expect_exit: 0
```

Allowed assertion types: `file-exists`, `grep`, `command`, `test-passes`. **Not allowed:** `human`.

## Manual Follow-up (non-blocking)

> Optional human review **after** `complete`. Never gates status.

- [ ] [UX review, staging spot-check, etc.]

---

## Acceptance Criteria

- [ ] All `verification` block items pass (`/verify-mop`)
- [ ] `/integrity-check` passes for this MOP's domains
- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] Documentation updated per `/update-docs` procedure
- [ ] CHANGELOG entry added
- [ ] Related ADRs (if any) updated to `accepted`

---

## Related

- **ADRs:** none yet — provider selection and consent-handling approach likely warrant one before implementation starts (see ADR_AUTHORING_GUIDE.md)
- **MOPs:** none blocking
- **Audit / source:** found by a `ui-designer` subagent while investigating a recipe-card breakpoint regression (2026-10-16) — a merge (`41ca287`) had silently reverted part of the page-width change the ad rail depended on, causing cards to render at ~135px. See the fix commit and `docs/MOPs/MOP-0029-theme-token-layering-surface-presets.md`-adjacent CHANGELOG entry for 2026-10-16 for the regression itself (unrelated to this MOP's scope).

---

## Notes

- The existing reserved spacer (`src/pages/Recipes.tsx`, inside the grid/ad-rail flex row) is currently `hidden 2xl:block w-[300px] shrink-0` with `aria-hidden="true"` — purely layout reservation, zero content. This MOP should decide whether that reservation width/breakpoint is still correct once a real ad unit's actual dimensions are known (ad units typically come in fixed IAB sizes, e.g. 300x250, 300x600 — the current 300px width was chosen for grid math, not to match any specific ad unit).
- Consent/privacy handling is a hard requirement before any third-party ad script loads — this project has no existing cookie-consent or privacy-preference infrastructure to build on; that may itself need scoping as an early phase.
- Placement decision (side rail only vs. in-grid native ads) affects `RecipeList.tsx`'s grid logic, which was just reworked in the 2026-10-16 breakpoint fix (`grid-cols-[repeat(auto-fill,minmax(200px,1fr))]`) — coordinate with that current state rather than the pre-fix layout.
